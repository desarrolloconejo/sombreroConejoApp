"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { anotar, soloCambios } from "@/lib/auditoria";
import { conSesion, esErrorPostgres } from "@/lib/db";
import { leerAjustes, leerFormato, leerMedio, leerNumeracion } from "@/lib/finanzas/ajustes";
import { RUTA_AJUSTES_FINANZAS, rutaFormatoImpresion } from "@/lib/finanzas/rutas";
import { requerirFinanzas } from "@/lib/sesion";
import { comoIdentificador } from "@/lib/validaciones";
import * as ajustes from "@/models/ajustesFinanzas";
import * as empresas from "@/models/empresas";
import type { EstadoFormulario } from "@/types";

/**
 * Los ajustes de finanzas, del lado de quien opera: emisor e impuestos,
 * numeracion, medios de pago y formatos de impresion.
 *
 * Casi todo nace con valores de ejemplo y se sustituye al final
 * (docs/pendientesIntegracion.md). Cambiar un ajuste nunca toca una factura
 * ya emitida: guarda su propia copia.
 */

const DUPLICADO: EstadoFormulario = { ok: false, errores: { nombre: "Ya hay uno con ese nombre" } };

/** Emisor, impuestos y dias de credito. */
export async function guardarAjustes(_estadoPrevio: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const usuario = await requerirFinanzas();

  const { ajustes: nuevos, errores } = leerAjustes(datos);
  if (Object.keys(errores).length > 0) return { ok: false, errores };

  await conSesion(usuario, async (tx) => {
    const antes = await ajustes.leer(tx);
    await ajustes.guardar(nuevos, usuario.id, tx);

    const cambios = antes ? soloCambios(antes, nuevos) : null;
    if (cambios) await anotar(tx, usuario, "ajustes_finanzas.editados", { entidadId: 1, ...cambios });
  });

  revalidatePath(RUTA_AJUSTES_FINANZAS);
  return { ok: true, mensaje: "Ajustes guardados" };
}

/** Serie, proximos numeros y rango del talonario. Los numeros solo suben. */
export async function guardarNumeracion(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirFinanzas();

  const { numeracion, errores } = leerNumeracion(datos);
  if (Object.keys(errores).length > 0) return { ok: false, errores };

  try {
    await conSesion(usuario, async (tx) => {
      const antes = await ajustes.numeracion(tx);
      await ajustes.fijarNumeracion(numeracion, tx);

      await anotar(tx, usuario, "ajustes_finanzas.numeracion", {
        entidadId: 1,
        antes: antes ? { ...antes } : null,
        despues: { ...numeracion },
      });
    });
  } catch (error) {
    if (esErrorPostgres(error, "23514")) {
      return {
        ok: false,
        mensaje: "Los proximos numeros solo pueden subir, y el rango tiene que llegar hasta ellos",
      };
    }
    throw error;
  }

  revalidatePath(RUTA_AJUSTES_FINANZAS);
  return { ok: true, mensaje: "Numeracion guardada" };
}

/** Crea un medio de pago, o lo cambia si llega su id. */
export async function guardarMedio(_estadoPrevio: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const usuario = await requerirFinanzas();

  const id = comoIdentificador(datos.get("id"));
  const { medio, errores } = leerMedio(datos);
  if (Object.keys(errores).length > 0) return { ok: false, errores };

  try {
    const resultado = await conSesion(usuario, async (tx) => {
      if (id === null) {
        const nuevo = await ajustes.crearMedio(medio, tx);
        await anotar(tx, usuario, "medio_pago.creado", {
          entidadId: nuevo,
          despues: { nombre: medio.nombre, monedas: medio.monedas.join(", "), activo: medio.activo },
        });
        return true;
      }

      const antes = await ajustes.medio(id, tx);
      if (!antes || !(await ajustes.editarMedio(id, medio, tx))) return false;

      const cambios = soloCambios(
        { ...antes, monedas: antes.monedas.join(", ") },
        { ...medio, monedas: medio.monedas.join(", ") },
      );
      if (cambios) await anotar(tx, usuario, "medio_pago.editado", { entidadId: id, ...cambios });
      return true;
    });

    if (!resultado) return { ok: false, mensaje: "No se encontro el medio de pago" };
  } catch (error) {
    if (esErrorPostgres(error, "23505")) return DUPLICADO;
    throw error;
  }

  revalidatePath(RUTA_AJUSTES_FINANZAS);
  return { ok: true, mensaje: id === null ? "Medio de pago creado" : "Medio de pago guardado" };
}

/** Guarda un formato de impresion. Sin id lo crea y lleva a su editor. */
export async function guardarFormato(_estadoPrevio: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const usuario = await requerirFinanzas();

  const id = comoIdentificador(datos.get("id"));
  const { formato, errores } = leerFormato(datos);
  if (Object.keys(errores).length > 0) {
    return { ok: false, errores, mensaje: "Hay medidas que no caben en la hoja" };
  }

  let destino: number;
  try {
    const resultado = await conSesion(usuario, async (tx) => {
      if (id === null) {
        const nuevo = await ajustes.crearFormato(formato, usuario.id, tx);
        await anotar(tx, usuario, "formato_impresion.creado", {
          entidadId: nuevo,
          despues: { nombre: formato.nombre, ancho: formato.anchoMm, alto: formato.altoMm },
        });
        return nuevo;
      }

      const antes = await ajustes.formato(id, tx);
      if (!antes) return null;
      if (antes.habitual && !formato.activo) return "habitual" as const;
      if (!(await ajustes.editarFormato(id, formato, tx))) return null;

      await anotar(tx, usuario, "formato_impresion.editado", {
        entidadId: id,
        antes: { nombre: antes.nombre, ancho: antes.anchoMm, alto: antes.altoMm, activo: antes.activo },
        despues: { nombre: formato.nombre, ancho: formato.anchoMm, alto: formato.altoMm, activo: formato.activo },
      });
      return id;
    });

    if (resultado === null) return { ok: false, mensaje: "No se encontro el formato" };
    if (resultado === "habitual") {
      return { ok: false, mensaje: "El formato habitual no se desactiva: marca antes otro como habitual" };
    }
    destino = resultado;
  } catch (error) {
    if (esErrorPostgres(error, "23505")) return DUPLICADO;
    throw error;
  }

  revalidatePath(RUTA_AJUSTES_FINANZAS);
  if (id === null) redirect(rutaFormatoImpresion(destino));
  revalidatePath(rutaFormatoImpresion(destino));
  return { ok: true, mensaje: "Formato guardado" };
}

/** «Copia de X», o «Copia 2 de X» si ya existe, sin pasar de 80 caracteres. */
function nombreDeCopia(nombre: string, existentes: string[]): string {
  const usados = new Set(existentes);
  for (let n = 1; n < 100; n++) {
    const candidato = `${n === 1 ? "Copia" : `Copia ${n}`} de ${nombre}`.slice(0, 80);
    if (!usados.has(candidato)) return candidato;
  }
  return `Copia de ${nombre}`.slice(0, 70) + ` ${existentes.length}`;
}

/** Copia un formato con otro nombre, para partir de el. */
export async function duplicarFormato(_estadoPrevio: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const usuario = await requerirFinanzas();

  const id = comoIdentificador(datos.get("id"));
  if (id === null) return { ok: false, mensaje: "No se encontro el formato" };

  let nuevo: number | null;
  try {
    nuevo = await conSesion(usuario, async (tx) => {
      const original = await ajustes.formato(id, tx);
      if (!original) return null;

      const creado = await ajustes.crearFormato(
        {
          nombre: nombreDeCopia(original.nombre, await ajustes.nombresDeFormato(tx)),
          anchoMm: original.anchoMm,
          altoMm: original.altoMm,
          fuentePt: original.fuentePt,
          campos: original.campos,
          renglones: original.renglones,
          activo: true,
        },
        usuario.id,
        tx,
      );
      await anotar(tx, usuario, "formato_impresion.creado", {
        entidadId: creado,
        despues: { copiaDe: original.nombre },
      });
      return creado;
    });
  } catch (error) {
    if (esErrorPostgres(error, "23505")) return { ok: false, mensaje: "Ya hay una copia con ese nombre: renombrala" };
    throw error;
  }

  if (nuevo === null) return { ok: false, mensaje: "No se encontro el formato" };

  revalidatePath(RUTA_AJUSTES_FINANZAS);
  redirect(rutaFormatoImpresion(nuevo));
}

/** Deja un formato como el que se usa por defecto al imprimir. */
export async function marcarFormatoHabitual(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirFinanzas();

  const id = comoIdentificador(datos.get("id"));
  if (id === null) return { ok: false, mensaje: "No se encontro el formato" };

  const marcado = await conSesion(usuario, async (tx) => {
    if (!(await ajustes.marcarHabitual(id, tx))) return false;
    await anotar(tx, usuario, "formato_impresion.habitual", { entidadId: id });
    return true;
  });

  if (!marcado) return { ok: false, mensaje: "Solo un formato activo puede ser el habitual" };

  revalidatePath(RUTA_AJUSTES_FINANZAS);
  revalidatePath(rutaFormatoImpresion(id));
  return { ok: true, mensaje: "Ahora es el formato habitual" };
}

/**
 * La retencion de IVA y los dias de credito de una empresa. Solo afectan a
 * las facturas que se emitan despues.
 */
export async function guardarDatosFiscales(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirFinanzas();

  const id = comoIdentificador(datos.get("id"));
  if (id === null) return { ok: false, mensaje: "No se encontro la empresa" };

  const retencion = datos.get("retencion");
  const retencionIvaPct = retencion === "75" ? 75 : retencion === "100" ? 100 : null;
  const textoDias = String(datos.get("diasCredito") ?? "").trim();
  const diasCredito = textoDias === "" ? null : /^\d{1,3}$/.test(textoDias) ? Number(textoDias) : NaN;
  if (Number.isNaN(diasCredito) || (diasCredito !== null && diasCredito > 365)) {
    return { ok: false, errores: { diasCredito: "Entre 0 y 365, o vacio" } };
  }

  const guardado = await conSesion(usuario, async (tx) => {
    const antes = (await empresas.datosFiscales(tx)).find((e) => e.id === id);
    if (!antes || !(await empresas.cambiarDatosFiscales(id, { retencionIvaPct, diasCredito }, tx))) return false;

    const cambios = soloCambios(
      { retencionIvaPct: antes.retencionIvaPct, diasCredito: antes.diasCredito },
      { retencionIvaPct, diasCredito },
    );
    if (cambios) await anotar(tx, usuario, "empresa.editada", { entidadId: id, empresaId: id, ...cambios });
    return true;
  });

  if (!guardado) return { ok: false, mensaje: "No se encontro la empresa" };

  revalidatePath(RUTA_AJUSTES_FINANZAS);
  return { ok: true, mensaje: "Datos de facturacion guardados" };
}
