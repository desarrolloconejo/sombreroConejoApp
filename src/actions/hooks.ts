"use server";

import { revalidatePath } from "next/cache";

import { auditar } from "@/lib/hooks/auditor";
import { metricaDe, SLUGS_OBJETIVO, SLUGS_PLATAFORMA } from "@/lib/hooks/catalogo";
import { requerirCargo } from "@/lib/sesion";
import { comoIdentificador, limpiarOpcional, limpiarTexto } from "@/lib/validaciones";
import * as fichas from "@/models/fichas";
import * as reglas from "@/models/reglasHook";
import type {
  ErroresCampo,
  EstadoAuditoria,
  EstadoFormulario,
  SlugObjetivo,
  SlugPlataforma,
} from "@/types";

/**
 * Acciones del modulo de hooks.
 *
 * Todas empiezan con `requerirCargo("redes")`. El proxy ya filtra la ruta,
 * pero una Server Action es un POST a la page donde se usa: si el matcher
 * cambiara, esta linea es lo unico que seguiria impidiendo que cualquiera
 * escriba fichas.
 */

const RUTA_MODULO = "/dashboard/hooks";

/** Topes de los campos de una ficha. Recortan, no validan reglas de negocio. */
const LIMITES_HOOK = {
  hablado: 400,
  insertTitulo: 160,
  linea: 300,
  parrafo: 800,
} as const;

function comoObjetivo(valor: unknown): SlugObjetivo | null {
  return SLUGS_OBJETIVO.find((o) => o === valor) ?? null;
}

function comoPlataforma(valor: unknown): SlugPlataforma | null {
  return SLUGS_PLATAFORMA.find((p) => p === valor) ?? null;
}

type Validacion = {
  datos: fichas.DatosFicha | null;
  errores: ErroresCampo;
};

/**
 * Valida lo que llega del canvas.
 *
 * Solo cuatro campos son obligatorios —cliente, objetivo, plataforma y el
 * hablado— porque una ficha se guarda como BORRADOR y se completa a lo largo
 * de varios ratos. Exigirlo todo de golpe obligaria a inventarse texto para
 * poder guardar y volver luego, que es como se llenan las fichas de relleno.
 */
function validarFicha(datos: FormData): Validacion {
  const errores: ErroresCampo = {};

  const empresaId = comoIdentificador(datos.get("empresaId"));
  const objetivo = comoObjetivo(datos.get("objetivo"));
  const plataforma = comoPlataforma(datos.get("plataforma"));
  const hablado = limpiarTexto(datos.get("hablado"), LIMITES_HOOK.hablado);

  if (empresaId === null) errores.empresaId = "Elige el cliente de esta pieza";
  if (objetivo === null) errores.objetivo = "Elige el objetivo de la pieza";
  if (plataforma === null) errores.plataforma = "Elige la plataforma";
  if (!hablado) errores.hablado = "Escribe el hook hablado";

  if (empresaId === null || objetivo === null || plataforma === null || !hablado) {
    return { datos: null, errores };
  }

  return {
    errores,
    datos: {
      empresaId,
      objetivo,
      plataforma,
      audiencia: limpiarOpcional(datos.get("audiencia"), LIMITES_HOOK.parrafo),
      tension: limpiarOpcional(datos.get("tension"), LIMITES_HOOK.parrafo),
      verdadMarca: limpiarOpcional(datos.get("verdadMarca"), LIMITES_HOOK.parrafo),
      prueba: limpiarOpcional(datos.get("prueba"), LIMITES_HOOK.parrafo),
      hablado,
      insertTitulo: limpiarOpcional(datos.get("insertTitulo"), LIMITES_HOOK.insertTitulo),
      primerFotograma: limpiarOpcional(datos.get("primerFotograma"), LIMITES_HOOK.linea),
      pagoPromesa: limpiarOpcional(datos.get("pagoPromesa"), LIMITES_HOOK.linea),
      cta: limpiarOpcional(datos.get("cta"), LIMITES_HOOK.linea),
      riesgoClaim: limpiarOpcional(datos.get("riesgoClaim"), LIMITES_HOOK.linea),
      // La metrica se DERIVA del objetivo, no se pide: si se pudieran elegir
      // por separado, una pieza acabaria con objetivo Guardados medida por
      // clics, y el numero no diria nada de la decision que se tomo.
      metricaPrincipal: metricaDe(objetivo),
    },
  };
}

/**
 * Guarda la ficha como borrador. Crea si no hay id, actualiza si lo hay.
 *
 * Guardar NO audita: el paso siguiente es del Auditor, y mezclarlos haria que
 * una nota apareciera sin que nadie la haya pedido.
 */
export async function guardarBorrador(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirCargo("redes");

  const { datos: ficha, errores } = validarFicha(datos);

  if (!ficha) return { ok: false, errores };

  const id = comoIdentificador(datos.get("id"));

  if (id !== null) {
    const actualizada = await fichas.actualizar(id, ficha);

    if (!actualizada) return { ok: false, mensaje: "Esa ficha ya no existe" };

    revalidatePath(RUTA_MODULO, "layout");
    return { ok: true, mensaje: "Borrador actualizado" };
  }

  const creada = await fichas.crear(ficha, usuario.id);

  revalidatePath(RUTA_MODULO, "layout");
  return { ok: true, mensaje: `Borrador guardado (ficha ${creada.id})` };
}

/**
 * Audita una ficha y guarda la nota.
 *
 * Guarda ANTES de auditar, a proposito: el boton dice «Auditar este hook» y
 * quien lo pulsa espera no perder lo escrito. Auditar sin guardar dejaria una
 * nota flotando sobre un texto que no esta en ningun sitio.
 *
 * Los limites salen de la regla de la empresa; si no tiene, el auditor cae al
 * estandar de la casa por su cuenta.
 */
export async function auditarHook(
  _estadoPrevio: EstadoAuditoria,
  datos: FormData,
): Promise<EstadoAuditoria> {
  const usuario = await requerirCargo("redes");

  const { datos: ficha, errores } = validarFicha(datos);

  if (!ficha) return { ok: false, errores };

  const id = comoIdentificador(datos.get("id"));

  const guardada =
    id !== null
      ? await fichas.actualizar(id, ficha)
      : await fichas.crear(ficha, usuario.id);

  if (!guardada) return { ok: false, mensaje: "Esa ficha ya no existe" };

  const limites = await reglas.limitesDeEmpresa(ficha.empresaId);

  const resultado = auditar({
    hablado: ficha.hablado,
    insertTitulo: ficha.insertTitulo,
    prueba: ficha.prueba,
    regla: limites,
  });

  await fichas.guardarNota(guardada.id, resultado.nota);

  revalidatePath(RUTA_MODULO, "layout");

  return {
    ok: true,
    resultado,
    fichaId: guardada.id,
    mensaje: resultado.aprobado
      ? `Auditada con ${resultado.nota}. Puede pasar a produccion.`
      : `Auditada con ${resultado.nota}. Por debajo del umbral de 70.`,
  };
}

/**
 * El canvas tiene dos botones sobre el MISMO formulario: guardar y auditar.
 *
 * `useActionState` ata una sola action a un formulario, asi que se despacha
 * por el valor del boton pulsado, que viaja en el FormData como cualquier
 * otro campo. La alternativa —dos formularios— obligaria a duplicar los
 * catorce campos o a sacarlos fuera con `form=`, y entonces el navegador
 * dejaria de enviarlos sin JavaScript.
 */
export async function enviarCanvas(
  estadoPrevio: EstadoAuditoria,
  datos: FormData,
): Promise<EstadoAuditoria> {
  return datos.get("accion") === "auditar"
    ? auditarHook(estadoPrevio, datos)
    : guardarBorrador(estadoPrevio, datos);
}

/**
 * Audita un texto suelto, sin ficha ni guardado.
 *
 * Es el uso que el documento senala como el de mas valor por si solo: entra
 * un texto, sale una nota explicada. No toca la base.
 */
export async function auditarTexto(
  _estadoPrevio: EstadoAuditoria,
  datos: FormData,
): Promise<EstadoAuditoria> {
  await requerirCargo("redes");

  const hablado = limpiarTexto(datos.get("hablado"), LIMITES_HOOK.hablado);

  if (!hablado) {
    return { ok: false, errores: { hablado: "Escribe el hook que quieres revisar" } };
  }

  const empresaId = comoIdentificador(datos.get("empresaId"));
  const limites = empresaId === null ? null : await reglas.limitesDeEmpresa(empresaId);

  const resultado = auditar({
    hablado,
    insertTitulo: limpiarOpcional(datos.get("insertTitulo"), LIMITES_HOOK.insertTitulo),
    prueba: limpiarOpcional(datos.get("prueba"), LIMITES_HOOK.parrafo),
    regla: limites,
  });

  return { ok: true, resultado };
}

/** Borra una ficha. Avisa si con ella se fue el aprendizaje de la cuenta. */
export async function borrarFicha(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  await requerirCargo("redes");

  const id = comoIdentificador(datos.get("id"));

  if (id === null) {
    return { ok: false, mensaje: "No se pudo identificar la ficha" };
  }

  const { borrada, estabaMedida } = await fichas.borrar(id);

  if (!borrada) return { ok: false, mensaje: "Esa ficha ya no existe" };

  revalidatePath(RUTA_MODULO, "layout");

  return {
    ok: true,
    mensaje: estabaMedida
      ? "Ficha borrada. Con ella se fueron sus resultados y el aprendizaje que dejo escrito."
      : "Borrador borrado.",
  };
}
