import type { Importes, RenglonNuevo } from "@/types";

/**
 * Los importes de un documento, calculados como los calcula la base.
 *
 * Es la VISTA PREVIA del editor: lo que vale es lo que escribe
 * `finanzas.guardar_renglones` en PostgreSQL. Por eso las reglas son las
 * mismas, una a una (seccion 7.5 del plan):
 *
 *   subtotal = cantidad x precio, redondeado a 2 decimales
 *   base     = suma de los subtotales gravados
 *   exento   = suma de los subtotales exentos
 *   IVA      = base x porcentaje / 100, redondeado a 2 decimales
 *   total    = base + exento + IVA
 *
 * Redondeo mitad hacia arriba, sobre cada renglon y sobre el IVA, nunca sobre
 * acumulados.
 *
 * Sin `number` en ningun paso: las cantidades se pasan a enteros escalados
 * (milesimas, centimos) en BigInt, y se vuelven texto al final. Un `number`
 * no representa 0.1 exacto, y con dinero eso acaba en un centimo de
 * diferencia con la base.
 */

/** Decimales de cada magnitud: los de su columna en la base. */
const CERO = BigInt(0);
const DOS = BigInt(2);
const MIL = BigInt(1000);
const DIEZ_MIL = BigInt(10000);

const DECIMALES_CANTIDAD = 3;
const DECIMALES_DINERO = 2;

/**
 * Un decimal en texto como entero escalado, o null si no es un numero valido
 * o trae mas decimales de los que admite.
 *
 * Acepta coma o punto decimal, que es como se escribe aqui, y nada mas: ni
 * signo, ni separador de miles, ni exponente.
 */
export function aEscalado(texto: string, decimales: number): bigint | null {
  const limpio = texto.trim().replace(",", ".");

  const partes = /^(\d+)(?:\.(\d*))?$/.exec(limpio);
  if (!partes) return null;

  const [, entera, fraccion = ""] = partes;
  if (fraccion.length > decimales) return null;

  return BigInt(entera + fraccion.padEnd(decimales, "0"));
}

/** Un entero escalado como texto decimal: 12345n con 2 decimales es "123.45". */
export function deEscalado(valor: bigint, decimales: number): string {
  const negativo = valor < CERO;
  const absoluto = (negativo ? -valor : valor).toString().padStart(decimales + 1, "0");
  const entera = absoluto.slice(0, absoluto.length - decimales);
  const fraccion = absoluto.slice(absoluto.length - decimales);

  return `${negativo ? "-" : ""}${entera}${decimales > 0 ? `.${fraccion}` : ""}`;
}

/** Divide redondeando mitad hacia arriba. Solo para valores no negativos. */
function dividirRedondeando(dividendo: bigint, divisor: bigint): bigint {
  return (dividendo * DOS + divisor) / (divisor * DOS);
}

/** El subtotal de un renglon en centimos, o null si cantidad o precio no valen. */
export function subtotalEnCentimos(cantidad: string, precio: string): bigint | null {
  const milesimas = aEscalado(cantidad, DECIMALES_CANTIDAD);
  const centimos = aEscalado(precio, DECIMALES_DINERO);

  if (milesimas === null || centimos === null || milesimas === CERO) return null;

  // Milesimas por centimos dan el importe multiplicado por cien mil: se baja
  // a centimos dividiendo entre mil.
  return dividirRedondeando(milesimas * centimos, MIL);
}

/** El subtotal de un renglon como texto, o null si no se puede calcular. */
export function subtotalDe(cantidad: string, precio: string): string | null {
  const centimos = subtotalEnCentimos(cantidad, precio);
  return centimos === null ? null : deEscalado(centimos, DECIMALES_DINERO);
}

/**
 * Los importes de un documento a partir de sus renglones.
 *
 * Un renglon que no se puede calcular no suma: el editor lo marca como
 * invalido y la base lo rechazaria al guardar.
 */
export function importesDe(renglones: readonly RenglonNuevo[], ivaPct = "16"): Importes {
  let base = CERO;
  let exento = CERO;

  for (const renglon of renglones) {
    const subtotal = subtotalEnCentimos(renglon.cantidad, renglon.precioUnitario);
    if (subtotal === null) continue;

    if (renglon.exento) exento += subtotal;
    else base += subtotal;
  }

  const porcentaje = aEscalado(ivaPct, DECIMALES_DINERO) ?? CERO;

  // base (centimos) x porcentaje (centesimas) / 100 / 100 = centimos.
  const iva = dividirRedondeando(base * porcentaje, DIEZ_MIL);

  return {
    baseImponible: deEscalado(base, DECIMALES_DINERO),
    montoExento: deEscalado(exento, DECIMALES_DINERO),
    ivaPct: deEscalado(porcentaje, DECIMALES_DINERO),
    ivaMonto: deEscalado(iva, DECIMALES_DINERO),
    total: deEscalado(base + exento + iva, DECIMALES_DINERO),
  };
}

/** Si la cantidad es valida para un renglon: positiva y con hasta 3 decimales. */
export function cantidadValida(texto: string): boolean {
  const valor = aEscalado(texto, DECIMALES_CANTIDAD);
  return valor !== null && valor > CERO;
}

/** Si el precio es valido: no negativo y con hasta 2 decimales. */
export function precioValido(texto: string): boolean {
  return aEscalado(texto, DECIMALES_DINERO) !== null;
}

/** Normaliza lo que escribio la persona al formato que guarda la base. */
export function normalizarDecimal(texto: string, decimales: number): string | null {
  const valor = aEscalado(texto, decimales);
  return valor === null ? null : deEscalado(valor, decimales);
}
