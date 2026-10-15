"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { anotar } from "@/lib/auditoria";
import { conSesion, esErrorPostgres } from "@/lib/db";
import { numeroDe } from "@/lib/finanzas/documentos";
import {
  RUTA_FACTURACION,
  RUTA_PROFORMAS,
  rutaMiProforma,
  rutaProforma,
} from "@/lib/finanzas/rutas";
import { fechaValida, LIMITES_FINANZAS, leerMotivo, leerRenglones } from "@/lib/finanzas/validar";
import { notificarA } from "@/lib/notificaciones";
import { requerirFinanzas } from "@/lib/sesion";
import { comoIdentificador, limpiarTexto } from "@/lib/validaciones";
import * as clientes from "@/models/clientes";
import * as proformas from "@/models/proformas";
import * as renglones from "@/models/renglones";
import type { EstadoFormulario } from "@/types";

/**
 * Las proformas, del lado de quien opera finanzas.
 *
 * Una proforma nace de un presupuesto aprobado (`generarProforma`, en
 * actions/presupuestos.ts) o de una recurrente a la que le toca. Mientras es
 * borrador se edita: titulo, notas, proyectos y renglones. Emitida, solo se
 * anula o se cambia su recurrencia. Nada se emite ni se factura solo.
 */

function revalidar(id: number): void {
  revalidatePath(RUTA_PROFORMAS);
  revalidatePath(rutaProforma(id));
  revalidatePath(RUTA_FACTURACION);
}

/**
 * Guarda un borrador: titulo, notas, proyectos y renglones. Con `emitir=si`,
 * ademas la emite en la misma transaccion: se emite exactamente lo que hay
 * en pantalla.
 */
export async function guardarProforma(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirFinanzas();

  const id = comoIdentificador(datos.get("id"));
  if (id === null) return { ok: false, mensaje: "No se encontro la proforma" };

  const emitir = datos.get("emitir") === "si";
  const titulo = limpiarTexto(datos.get("titulo"), LIMITES_FINANZAS.titulo);
  const notas = limpiarTexto(datos.get("notas"), LIMITES_FINANZAS.notas) || null;
  const proyectos = datos
    .getAll("proyectoId")
    .map(comoIdentificador)
    .filter((valor): valor is number => valor !== null);
  const lista = leerRenglones(datos);

  const errores = { ...lista.errores };
  if (!titulo) errores.titulo = "Ponle un titulo";
  if (emitir && !errores.renglones && lista.renglones.length === 0) {
    errores.renglones = "Anade al menos un renglon antes de emitirla";
  }

  if (Object.keys(errores).length > 0) return { ok: false, errores };

  let resultado: { error: string } | { emitida: boolean };

  try {
    resultado = await conSesion(usuario, async (tx) => {
      const actual = await proformas.buscarPorId(id, tx);
      if (!actual) return { error: "No se encontro la proforma" };
      if (actual.estado !== "borrador") return { error: "Ya no es un borrador: no se puede editar" };

      await proformas.editar(id, { titulo, notas }, tx);
      await proformas.ligarProyectos(id, proyectos, tx);
      await renglones.guardar("proforma", id, lista.renglones, tx);

      const guardada = await proformas.buscarPorId(id, tx);

      await anotar(tx, usuario, "proforma.editada", {
        entidadId: id,
        empresaId: actual.empresaId,
        antes: { titulo: actual.titulo, total: actual.total },
        despues: {
          titulo,
          total: guardada?.total ?? null,
          renglones: lista.renglones.length,
          proyectos: proyectos.length,
        },
      });

      if (!emitir) return { emitida: false };

      if (!(await proformas.emitir(id, usuario.id, tx))) {
        return { error: "No se pudo emitir: revisa que tenga renglones" };
      }

      await anotar(tx, usuario, "proforma.emitida", {
        entidadId: id,
        empresaId: actual.empresaId,
        despues: { total: guardada?.total ?? null },
      });

      // Quien ve las finanzas de la empresa se entera en la campana.
      const destinatarios = await clientes.conFinanzasDe(actual.empresaId, tx);
      await notificarA(
        tx,
        destinatarios.map((persona) => persona.id),
        {
          tipo: "proforma.emitida",
          titulo: `Tienes una proforma nueva: ${titulo}`,
          cuerpo: `${numeroDe("proforma", actual.numero)}.`,
          href: rutaMiProforma(id),
          empresaId: actual.empresaId,
        },
      );

      return { emitida: true };
    });
  } catch (error) {
    if (esErrorPostgres(error, "23514")) {
      return { ok: false, mensaje: "Un proyecto elegido no es de la empresa de la proforma" };
    }
    throw error;
  }

  if ("error" in resultado) return { ok: false, mensaje: resultado.error };

  revalidar(id);

  return { ok: true, mensaje: resultado.emitida ? "Proforma emitida" : "Proforma guardada" };
}

/** La anula con su motivo. Una borrador o una emitida; nunca vuelve. */
export async function anularProforma(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirFinanzas();

  const id = comoIdentificador(datos.get("id"));
  if (id === null) return { ok: false, mensaje: "No se encontro la proforma" };

  const motivo = leerMotivo(datos);
  if (!motivo) return { ok: false, errores: { motivo: "Escribe por que se anula" } };

  const resultado = await conSesion(usuario, async (tx) => {
    const actual = await proformas.buscarPorId(id, tx);
    if (!actual) return { error: "No se encontro la proforma" };

    if (!(await proformas.anular(id, motivo, usuario.id, tx))) {
      return { error: "Esta proforma ya no se puede anular" };
    }

    await anotar(tx, usuario, "proforma.anulada", {
      entidadId: id,
      empresaId: actual.empresaId,
      antes: { estado: actual.estado },
      despues: { motivo },
    });

    return { ok: true as const };
  });

  if ("error" in resultado) return { ok: false, mensaje: resultado.error };

  revalidar(id);

  return { ok: true, mensaje: "Proforma anulada" };
}

/**
 * Marca o desmarca la recurrencia: el contrato que se repite cada mes. La
 * fecha es cuando toca preparar la siguiente.
 */
export async function cambiarRecurrencia(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirFinanzas();

  const id = comoIdentificador(datos.get("id"));
  if (id === null) return { ok: false, mensaje: "No se encontro la proforma" };

  const recurrente = datos.get("recurrente") === "on";
  const proxima = String(datos.get("proximaEmision") ?? "").trim();

  if (recurrente && !fechaValida(proxima)) {
    return { ok: false, errores: { proximaEmision: "Indica cuando toca la siguiente" } };
  }

  const resultado = await conSesion(usuario, async (tx) => {
    const actual = await proformas.buscarPorId(id, tx);
    if (!actual) return { error: "No se encontro la proforma" };

    if (!(await proformas.cambiarRecurrencia(id, recurrente, recurrente ? proxima : null, tx))) {
      return { error: "Una proforma anulada no se repite" };
    }

    await anotar(tx, usuario, "proforma.recurrencia_cambiada", {
      entidadId: id,
      empresaId: actual.empresaId,
      antes: { recurrente: actual.recurrente, proximaEmision: actual.proximaEmision },
      despues: { recurrente, proximaEmision: recurrente ? proxima : null },
    });

    return { ok: true as const };
  });

  if ("error" in resultado) return { ok: false, mensaje: resultado.error };

  revalidar(id);

  return {
    ok: true,
    mensaje: recurrente ? "Se repetira cada mes" : "Ya no se repite",
  };
}

/**
 * Prepara la siguiente de una recurrente: una copia en borrador, con sus
 * renglones y proyectos, y la fecha de la proxima avanza un mes. Lleva a la
 * copia, para revisarla antes de emitirla.
 */
export async function prepararSiguiente(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirFinanzas();

  const id = comoIdentificador(datos.get("id"));
  if (id === null) return { ok: false, mensaje: "No se encontro la proforma" };

  let nueva: number | null;

  try {
    nueva = await conSesion(usuario, async (tx) => {
      const actual = await proformas.buscarPorId(id, tx);
      if (!actual) return null;

      const copia = await proformas.desde("recurrente", id, tx);

      await anotar(tx, usuario, "proforma.creada", {
        entidadId: copia,
        empresaId: actual.empresaId,
        despues: { recurrenteDe: numeroDe("proforma", actual.numero), total: actual.total },
      });

      return copia;
    });
  } catch (error) {
    if (esErrorPostgres(error, "23514")) {
      return { ok: false, mensaje: "Esta proforma no es una recurrente en curso" };
    }
    throw error;
  }

  if (nueva === null) return { ok: false, mensaje: "No se encontro la proforma" };

  revalidar(id);
  redirect(rutaProforma(nueva));
}
