import { limpiarOpcional } from "@/lib/validaciones";
import type { ErroresCampo, MedioPago, MonedaPago, TipoPago } from "@/types";
import { aEscalado, deEscalado, normalizarDecimal } from "./calculo";
import { fechaValida } from "./validar";

/**
 * Lo que llega del formulario de un pago o una retencion, comprobado. La base
 * vuelve a mirarlo (moneda del medio, factura emitida, montos positivos);
 * esto esta para decir que falta, campo a campo.
 */

const TIPOS: readonly TipoPago[] = ["pago", "retencion_iva", "retencion_islr"];

export type PagoLeido = {
  tipo: TipoPago;
  medioId: number | null;
  referencia: string | null;
  fechaPago: string;
  monto: string;
  moneda: MonedaPago;
};

/** Un monto positivo con hasta dos decimales, como texto. Admite la coma. */
export function leerMonto(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim().replace(/\./g, (punto, posicion, texto: string) =>
    // «1.234,56»: los puntos son de miles si despues viene una coma.
    texto.includes(",") ? "" : punto,
  );
  const texto = normalizarDecimal(limpio.replace(",", "."), 2);
  return texto !== null && !/^0(\.0+)?$/.test(texto) ? texto : null;
}

/** Una tasa positiva con hasta ocho decimales, como la del BCV. Admite la coma. */
export function leerTasa(valor: string): string | null {
  const texto = normalizarDecimal(valor.trim().replace(",", "."), 8);
  return texto !== null && !/^0(\.0+)?$/.test(texto) ? texto : null;
}

/**
 * Lee un pago. `medios` son los activos: el medio elegido tiene que estar ahi
 * y aceptar la moneda. `hoy` es el dia en Caracas: no se reporta un pago
 * futuro.
 */
export function leerPago(
  datos: FormData,
  medios: MedioPago[],
  hoy: string,
): { pago: PagoLeido; errores: ErroresCampo } {
  const errores: ErroresCampo = {};

  const tipo = TIPOS.find((t) => t === datos.get("tipo")) ?? "pago";
  const moneda: MonedaPago = tipo !== "pago" ? "VES" : datos.get("moneda") === "USD" ? "USD" : "VES";

  const monto = leerMonto(datos.get("monto"));
  if (monto === null) errores.monto = "Escribe el monto, mayor que cero";

  const fecha = String(datos.get("fechaPago") ?? "");
  if (!fechaValida(fecha)) errores.fechaPago = "Indica la fecha del pago";
  else if (fecha > hoy) errores.fechaPago = "La fecha no puede ser futura";

  let medioId: number | null = null;
  let pideReferencia = tipo !== "pago";
  if (tipo === "pago") {
    const medio = medios.find((m) => String(m.id) === datos.get("medioId"));
    if (!medio) errores.medioId = "Elige como pagaste";
    else if (!medio.monedas.includes(moneda)) errores.moneda = `${medio.nombre} no acepta esa moneda`;
    else {
      medioId = medio.id;
      pideReferencia = medio.pideReferencia;
    }
  }

  const referencia = limpiarOpcional(datos.get("referencia"), 60);
  if (pideReferencia && !referencia) {
    errores.referencia = tipo === "pago" ? "Escribe el numero de referencia" : "Escribe el numero del comprobante de retencion";
  }

  return {
    pago: { tipo, medioId, referencia, fechaPago: fecha, monto: monto ?? "0", moneda },
    errores,
  };
}

/**
 * Cuanto son unos dolares en bolivares a una tasa, redondeado a centimos
 * (mitad hacia arriba). Es la sugerencia del monto aplicado al confirmar: el
 * operador la puede cambiar. Con enteros escalados, nunca con `number`.
 */
export function aBolivares(montoUsd: string, tasa: string): string | null {
  const centimos = aEscalado(montoUsd, 2);
  const tasaEscalada = aEscalado(tasa, 8);
  if (centimos === null || tasaEscalada === null) return null;

  const producto = centimos * tasaEscalada; // 10 decimales
  const divisor = BigInt(10) ** BigInt(8);
  const redondeado = (producto * BigInt(2) + divisor) / (divisor * BigInt(2));
  return deEscalado(redondeado, 2);
}
