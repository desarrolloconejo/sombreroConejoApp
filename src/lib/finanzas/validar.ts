import { limpiarTexto } from "@/lib/validaciones";
import type { ErroresCampo, RenglonNuevo } from "@/types";
import { cantidadValida, normalizarDecimal, precioValido } from "./calculo";

/**
 * Lo que llega de los formularios de presupuestos y proformas, comprobado.
 *
 * Nada de esto sustituye a la base: sus CHECK vuelven a mirar cada valor. Esto
 * esta para devolver un mensaje que se entienda, campo a campo, en lugar de un
 * error de PostgreSQL.
 */

/** Cuantos renglones admite un documento. */
export const MAXIMO_RENGLONES = 60;

export const LIMITES_FINANZAS = {
  titulo: 120,
  notas: 1000,
  descripcion: 300,
  motivo: 500,
} as const;

/** AAAA-MM-DD y que exista. */
export function fechaValida(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;

  const fecha = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto;
}

/**
 * Lee los renglones del editor. Llegan como listas paralelas: el campo
 * `descripcion`, `cantidad`, `precio` y `exento` de cada fila, en orden.
 *
 * Las filas vacias del todo se ignoran: es la ultima, que el editor deja
 * siempre lista para escribir. Una a medias es un error.
 */
export function leerRenglones(datos: FormData): {
  renglones: RenglonNuevo[];
  errores: ErroresCampo;
} {
  const descripciones = datos.getAll("descripcion").map(String);
  const cantidades = datos.getAll("cantidad").map(String);
  const precios = datos.getAll("precio").map(String);
  const exentos = datos.getAll("exento").map(String);

  const renglones: RenglonNuevo[] = [];
  const errores: ErroresCampo = {};

  for (const [indice, bruta] of descripciones.entries()) {
    const descripcion = limpiarTexto(bruta, LIMITES_FINANZAS.descripcion);
    const cantidad = (cantidades[indice] ?? "").trim();
    const precio = (precios[indice] ?? "").trim();

    if (!descripcion && !cantidad && !precio) continue;

    const fila = indice + 1;

    if (!descripcion) {
      errores.renglones = `Al renglon ${fila} le falta la descripcion`;
      break;
    }
    if (!cantidadValida(cantidad)) {
      errores.renglones = `La cantidad del renglon ${fila} no es valida: mayor que cero y hasta tres decimales`;
      break;
    }
    if (!precioValido(precio)) {
      errores.renglones = `El precio del renglon ${fila} no es valido: hasta dos decimales`;
      break;
    }

    renglones.push({
      descripcion,
      cantidad: normalizarDecimal(cantidad, 3) as string,
      precioUnitario: normalizarDecimal(precio, 2) as string,
      exento: exentos[indice] === "si",
    });
  }

  if (!errores.renglones && renglones.length > MAXIMO_RENGLONES) {
    errores.renglones = `Un documento admite hasta ${MAXIMO_RENGLONES} renglones`;
  }

  return { renglones, errores };
}

/** La cabecera de un presupuesto: titulo, validez y notas. */
export function leerCabecera(datos: FormData): {
  valores: { titulo: string; validoHasta: string; notas: string | null };
  errores: ErroresCampo;
} {
  const titulo = limpiarTexto(datos.get("titulo"), LIMITES_FINANZAS.titulo);
  const validoHasta = String(datos.get("validoHasta") ?? "").trim();
  const notas = limpiarTexto(datos.get("notas"), LIMITES_FINANZAS.notas) || null;

  const errores: ErroresCampo = {};
  if (!titulo) errores.titulo = "Ponle un titulo: es lo que el cliente lee primero";
  if (!fechaValida(validoHasta)) errores.validoHasta = "Indica hasta cuando vale";

  return { valores: { titulo, validoHasta, notas }, errores };
}

/** Un motivo de rechazo o de anulacion: obligatorio. */
export function leerMotivo(datos: FormData): string | null {
  return limpiarTexto(datos.get("motivo"), LIMITES_FINANZAS.motivo) || null;
}
