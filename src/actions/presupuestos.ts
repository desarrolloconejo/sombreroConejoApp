"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { anotar } from "@/lib/auditoria";
import { correoDePresupuestoEnviado } from "@/lib/correos/plantillas";
import { conSesion, esErrorPostgres } from "@/lib/db";
import { encolarCorreo, entregarCorreos } from "@/lib/externos/correo";
import { DIAS_DE_VALIDEZ, numeroDe, sumarDias } from "@/lib/finanzas/documentos";
import {
  RUTA_FACTURACION,
  RUTA_PRESUPUESTOS,
  rutaMiPresupuesto,
  rutaPresupuesto,
  rutaProforma,
} from "@/lib/finanzas/rutas";
import { leerCabecera, leerMotivo, leerRenglones } from "@/lib/finanzas/validar";
import { avisarRespuestaPresupuesto } from "@/lib/finanzas/avisosPresupuesto";
import { notificarA, notificarAEjecutivosDe } from "@/lib/notificaciones";
import { formatoPor } from "@/lib/portal/briefs";
import { hoyEnCaracas } from "@/lib/portal/fases";
import { rutaBrief } from "@/lib/portal/rutas";
import { requerirFinanzas } from "@/lib/sesion";
import { comoIdentificador } from "@/lib/validaciones";
import * as briefs from "@/models/briefs";
import * as clientes from "@/models/clientes";
import * as empresas from "@/models/empresas";
import * as presupuestos from "@/models/presupuestos";
import * as proformas from "@/models/proformas";
import * as renglones from "@/models/renglones";
import type { EstadoFormulario } from "@/types";

/**
 * Los presupuestos, del lado de quien opera finanzas: el administrador o un
 * trabajador de administracion.
 *
 * Toda escritura va dentro de `conSesion`, con su linea de auditoria. Los
 * importes no los escribe nadie aqui: los calcula la base al guardar los
 * renglones.
 */

function revalidar(id: number): void {
  revalidatePath(RUTA_PRESUPUESTOS);
  revalidatePath(rutaPresupuesto(id));
  revalidatePath(RUTA_FACTURACION);
}

/** El proyecto elegido, si es de esa empresa. Null si no se eligio ninguno. */
function leerProyecto(datos: FormData): number | null {
  return comoIdentificador(datos.get("proyectoId"));
}

/** Abre un presupuesto en borrador y lleva a su editor. */
export async function crearPresupuesto(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirFinanzas();

  const empresaId = comoIdentificador(datos.get("empresaId"));
  const proyectoId = leerProyecto(datos);
  const { valores, errores } = leerCabecera(datos);

  if (empresaId === null) errores.empresaId = "Elige la empresa";

  if (Object.keys(errores).length > 0 || empresaId === null) {
    return { ok: false, errores };
  }

  const resultado = await conSesion(usuario, async (tx) => {
    const empresa = await empresas.buscarPorId(empresaId, tx);
    if (!empresa || !empresa.activo) return { error: "empresa" as const };

    if (proyectoId !== null) {
      const ligables = await proformas.proyectosLigables(empresaId, tx);
      if (!ligables.some((proyecto) => proyecto.id === proyectoId)) {
        return { error: "proyecto" as const };
      }
    }

    const id = await presupuestos.crear({ empresaId, proyectoId, ...valores }, usuario.id, tx);

    await anotar(tx, usuario, "presupuesto.creado", {
      entidadId: id,
      empresaId,
      despues: { titulo: valores.titulo, validoHasta: valores.validoHasta },
    });

    await notificarAEjecutivosDe(tx, empresaId, {
      tipo: "presupuesto.creado",
      titulo: `Administracion prepara un presupuesto para ${empresa.nombre}`,
      cuerpo: valores.titulo,
      empresaId,
    });

    return { id };
  });

  if ("error" in resultado) {
    return {
      ok: false,
      errores:
        resultado.error === "empresa"
          ? { empresaId: "Esa empresa no existe o esta desactivada" }
          : { proyectoId: "Ese proyecto no es de la empresa" },
    };
  }

  revalidatePath(RUTA_PRESUPUESTOS);
  redirect(rutaPresupuesto(resultado.id));
}

/**
 * Arma el presupuesto de un brief que el ejecutivo paso a presupuesto: un
 * borrador para su empresa, ligado al brief y a su proyecto si ya lo tiene.
 * Lleva a su editor.
 */
export async function presupuestarDesdeBrief(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirFinanzas();

  const briefId = comoIdentificador(datos.get("briefId"));
  if (briefId === null) return { ok: false, mensaje: "No se encontro el brief" };

  const resultado = await conSesion(usuario, async (tx) => {
    const pendientes = await briefs.esperandoPresupuesto(tx);
    const brief = pendientes.find((candidato) => candidato.id === briefId);
    if (!brief || brief.empresaId === null) return { error: "Ese brief ya no espera presupuesto" };

    const formato = formatoPor(brief.formato, brief.formatoVersion);
    const id = await presupuestos.crear(
      {
        empresaId: brief.empresaId,
        briefId,
        proyectoId: brief.proyectoId,
        titulo: `${formato?.nombre ?? "Brief"} ${brief.codigo}`,
        validoHasta: sumarDias(hoyEnCaracas(), DIAS_DE_VALIDEZ),
        notas: null,
      },
      usuario.id,
      tx,
    );

    await anotar(tx, usuario, "presupuesto.creado", {
      entidadId: id,
      empresaId: brief.empresaId,
      despues: { brief: brief.codigo },
    });

    await notificarAEjecutivosDe(tx, brief.empresaId, {
      tipo: "presupuesto.creado",
      titulo: `Administracion arma el presupuesto del brief ${brief.codigo}`,
      cuerpo: brief.solicitante,
      href: rutaBrief(briefId),
      empresaId: brief.empresaId,
    });

    return { id };
  });

  if ("error" in resultado) return { ok: false, mensaje: resultado.error };

  revalidatePath(RUTA_PRESUPUESTOS);
  redirect(rutaPresupuesto(resultado.id));
}

/**
 * Guarda un borrador: su cabecera y sus renglones. Con `enviar=si`, ademas lo
 * envia al cliente en la misma transaccion: lo que se envia es exactamente lo
 * que se acaba de guardar.
 */
export async function guardarPresupuesto(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirFinanzas();

  const id = comoIdentificador(datos.get("id"));
  if (id === null) return { ok: false, mensaje: "No se encontro el presupuesto" };

  const enviar = datos.get("enviar") === "si";
  const cabecera = leerCabecera(datos);
  const lista = leerRenglones(datos);
  const proyectoId = leerProyecto(datos);

  const errores = { ...cabecera.errores, ...lista.errores };
  if (enviar && !errores.renglones && lista.renglones.length === 0) {
    errores.renglones = "Anade al menos un renglon antes de enviarlo";
  }

  if (Object.keys(errores).length > 0) return { ok: false, errores };

  const resultado = await conSesion(usuario, async (tx) => {
    const actual = await presupuestos.buscarPorId(id, tx);
    if (!actual) return { error: "No se encontro el presupuesto" };
    if (actual.estado !== "borrador") return { error: "Ya no es un borrador: no se puede editar" };

    if (proyectoId !== null) {
      const ligables = await proformas.proyectosLigables(actual.empresaId, tx);
      if (!ligables.some((proyecto) => proyecto.id === proyectoId)) {
        return { error: "Ese proyecto no es de la empresa" };
      }
    }

    await presupuestos.editar(id, { proyectoId, ...cabecera.valores }, tx);
    await renglones.guardar("presupuesto", id, lista.renglones, tx);

    const guardado = await presupuestos.buscarPorId(id, tx);

    await anotar(tx, usuario, "presupuesto.editado", {
      entidadId: id,
      empresaId: actual.empresaId,
      antes: { titulo: actual.titulo, total: actual.total },
      despues: {
        titulo: cabecera.valores.titulo,
        total: guardado?.total ?? null,
        renglones: lista.renglones.length,
      },
    });

    if (!enviar) return { correos: [] as number[], enviado: false };

    const enviado = await presupuestos.enviar(id, usuario.id, tx);
    if (!enviado) return { error: "Su validez ya paso: cambiala antes de enviarlo" };

    await anotar(tx, usuario, "presupuesto.enviado", {
      entidadId: id,
      empresaId: actual.empresaId,
      despues: { total: guardado?.total ?? null, validoHasta: cabecera.valores.validoHasta },
    });

    // Avisa a quien ve las finanzas de la empresa: en la campana y por correo.
    const destinatarios = await clientes.conFinanzasDe(actual.empresaId, tx);
    const numero = numeroDe("presupuesto", actual.numero);

    await notificarA(
      tx,
      destinatarios.map((persona) => persona.id),
      {
        tipo: "presupuesto.enviado",
        titulo: `Tienes un presupuesto para aprobar: ${cabecera.valores.titulo}`,
        cuerpo: `${numero}. Vale hasta el ${cabecera.valores.validoHasta}.`,
        href: rutaMiPresupuesto(id),
        empresaId: actual.empresaId,
      },
    );

    // Los ejecutivos de la empresa saben que el cliente ya lo tiene.
    await notificarAEjecutivosDe(tx, actual.empresaId, {
      tipo: "presupuesto.enviado",
      titulo: `Enviamos a ${actual.empresaNombre} el presupuesto ${numero}`,
      cuerpo: cabecera.valores.titulo,
      href: actual.briefId !== null ? rutaBrief(actual.briefId) : null,
      empresaId: actual.empresaId,
    });

    const correos: number[] = [];
    for (const persona of destinatarios) {
      correos.push(
        await encolarCorreo(
          tx,
          usuario,
          correoDePresupuestoEnviado(persona, {
            numero,
            titulo: cabecera.valores.titulo,
            validoHasta: cabecera.valores.validoHasta,
          }),
        ),
      );
    }

    return { correos, enviado: true, sinDestinatarios: destinatarios.length === 0 };
  });

  if ("error" in resultado) return { ok: false, mensaje: resultado.error };

  // El correo sale despues de confirmar el cambio, nunca dentro.
  await entregarCorreos(usuario, resultado.correos);

  revalidar(id);

  if (!resultado.enviado) return { ok: true, mensaje: "Presupuesto guardado" };

  return {
    ok: true,
    mensaje:
      "sinDestinatarios" in resultado && resultado.sinDestinatarios
        ? "Presupuesto enviado. Nadie de la empresa ve sus finanzas: avisa al cliente o registra tu su decision"
        : "Presupuesto enviado al cliente",
  };
}

/**
 * Registra la decision del cliente a su nombre (F14): para la empresa que no
 * tiene a nadie con cuenta, o que respondio por otro medio. Queda dicho que
 * lo registro un operador y no el cliente.
 */
export async function resolverPresupuestoANombre(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirFinanzas();

  const id = comoIdentificador(datos.get("id"));
  if (id === null) return { ok: false, mensaje: "No se encontro el presupuesto" };

  const aprobar = datos.get("decision") === "aprobar";
  const motivo = leerMotivo(datos);

  if (!aprobar && !motivo) {
    return { ok: false, errores: { motivo: "Escribe por que lo rechazo el cliente" } };
  }

  const resultado = await conSesion(usuario, async (tx) => {
    const actual = await presupuestos.buscarPorId(id, tx);
    if (!actual) return { error: "No se encontro el presupuesto" };

    const hecho = await presupuestos.resolverANombre(id, aprobar, motivo, usuario.id, tx);
    if (!hecho) return { error: "Ya no esta pendiente de aprobacion, o su validez paso" };

    await anotar(tx, usuario, aprobar ? "presupuesto.aprobado" : "presupuesto.rechazado", {
      entidadId: id,
      empresaId: actual.empresaId,
      despues: { aNombreDelCliente: true, motivo },
    });

    await avisarRespuestaPresupuesto(tx, actual, { aprobado: aprobar, motivo, aNombreDelCliente: true });

    return { ok: true as const };
  });

  if ("error" in resultado) return { ok: false, mensaje: resultado.error };

  revalidar(id);

  return {
    ok: true,
    mensaje: aprobar ? "Aprobacion registrada a nombre del cliente" : "Rechazo registrado a nombre del cliente",
  };
}

/** Genera la proforma de un presupuesto aprobado y lleva a ella. */
export async function generarProforma(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirFinanzas();

  const id = comoIdentificador(datos.get("id"));
  if (id === null) return { ok: false, mensaje: "No se encontro el presupuesto" };

  let proformaId: number | null;

  try {
    proformaId = await conSesion(usuario, async (tx) => {
      const actual = await presupuestos.buscarPorId(id, tx);
      if (!actual) return null;

      const nueva = await proformas.desde("presupuesto", id, tx);

      await anotar(tx, usuario, "proforma.creada", {
        entidadId: nueva,
        empresaId: actual.empresaId,
        despues: { presupuesto: numeroDe("presupuesto", actual.numero), total: actual.total },
      });

      return nueva;
    });
  } catch (error) {
    if (esErrorPostgres(error, "23505")) {
      return { ok: false, mensaje: "Ese presupuesto ya tiene su proforma" };
    }
    if (esErrorPostgres(error, "23514")) {
      return { ok: false, mensaje: "Solo un presupuesto aprobado da lugar a una proforma" };
    }
    throw error;
  }

  if (proformaId === null) return { ok: false, mensaje: "No se encontro el presupuesto" };

  revalidar(id);
  redirect(rutaProforma(proformaId));
}
