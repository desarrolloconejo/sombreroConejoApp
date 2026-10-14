import type { EstadoPresupuesto, SituacionPresupuesto, TipoDocumento } from "@/types";

/**
 * Criterio compartido de presupuestos y proformas, como funciones puras.
 */

const PREFIJOS: Record<TipoDocumento, string> = {
  presupuesto: "PRE",
  proforma: "PRF",
};

/** El numero de un documento como se muestra: PRE-000012. */
export function numeroDe(tipo: TipoDocumento, numero: number): string {
  return `${PREFIJOS[tipo]}-${String(numero).padStart(6, "0")}`;
}

/**
 * Lo que se muestra de un presupuesto: el estado guardado, salvo el enviado
 * cuya validez ya paso, que se lee como vencido.
 */
export function situacionDe(estado: EstadoPresupuesto, vencido: boolean): SituacionPresupuesto {
  return estado === "enviado" && vencido ? "vencido" : estado;
}

/** Cuantos dias vale un presupuesto si no se dice otra cosa (F6). */
export const DIAS_DE_VALIDEZ = 15;

/** El IVA que se aplica a la base imponible, en porcentaje. */
export const IVA_PCT = "16";

/** Una fecha AAAA-MM-DD mas unos dias, sin pasar por la zona horaria. */
export function sumarDias(fecha: string, dias: number): string {
  const [ano, mes, dia] = fecha.split("-").map(Number);
  const resultado = new Date(Date.UTC(ano, mes - 1, dia + dias));

  return resultado.toISOString().slice(0, 10);
}

/** Un importe en dolares para mostrar: 1234.5 -> «$1.234,50». */
export function dolares(importe: string): string {
  const [entera, fraccion = ""] = importe.split(".");
  const negativo = entera.startsWith("-");
  const digitos = negativo ? entera.slice(1) : entera;
  const miles = digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `${negativo ? "-" : ""}$${miles},${fraccion.padEnd(2, "0").slice(0, 2)}`;
}
