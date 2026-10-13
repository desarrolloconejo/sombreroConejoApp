import type { LecturaDeTasas, TasaLeida } from "@/types";

/**
 * Lee las tasas de la pagina del BCV. Funciones puras: entra el HTML, sale la
 * lectura o el motivo por el que no se puede dar por buena.
 *
 * LA PAGINA NO ES NUESTRA
 * -----------------------
 * Puede cambiar de forma sin avisar, y lo que devuelva se convierte en la tasa
 * con la que se emiten facturas. Por eso aqui se desconfia de todo: lo que no
 * tiene exactamente la forma esperada no se interpreta, se rechaza. Es
 * preferible un dia sin tasa automatica —alguien la escribe a mano— que una
 * tasa mal leida.
 *
 * Cada moneda viene asi, con un identificador en el bloque que la envuelve:
 *
 *   <div id="dolar" …> … <span> USD</span> … <strong …> 876,79760000</strong>
 *
 * y la fecha para la que rigen, en un atributo:
 *
 *   <span class="date-display-single" … content="2026-10-13T00:00:00-04:00">
 */

/** Por debajo de esto, la pagina no es la que se esperaba. */
const MONEDA_OBLIGATORIA = "USD";

/**
 * Cuanto puede cambiar una tasa respecto a la ultima guardada.
 *
 * La tasa oficial se mueve poco de un dia a otro. Un salto mayor que este casi
 * nunca es el mercado: es la pagina que cambio de formato y se esta leyendo
 * otra cifra. Se deja margen para varios dias sin lectura.
 */
export const SALTO_MAXIMO = 0.25;

/**
 * Convierte "876,79760000" en "876.79760000".
 *
 * La pagina escribe los numeros a la espanola: coma para los decimales y, si
 * los hubiera, punto para los miles. Devuelve null ante cualquier otra cosa.
 */
export function comoDecimal(texto: string): string | null {
  const limpio = texto.trim();

  if (!/^\d{1,3}(\.\d{3})*(,\d+)?$|^\d+(,\d+)?$/.test(limpio)) return null;

  const decimal = limpio.replace(/\./g, "").replace(",", ".");

  return Number(decimal) > 0 ? decimal : null;
}

/**
 * El dia de una fecha con zona horaria, tal como esta escrito.
 *
 * Se toma el dia del texto y NO se pasa por `Date`: "2026-10-13T00:00:00-04:00"
 * convertido a UTC sigue siendo el 13, pero una fecha a las 22:00 de Caracas
 * saltaria al dia siguiente. La fecha valor es la que el BCV escribio.
 */
export function comoFechaValor(texto: string): string | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})T/.exec(texto.trim());

  if (!partes) return null;

  const [, anio, mes, dia] = partes;
  const fecha = new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia)));

  // Rechaza lo que el calendario no tiene, como un 31 de febrero.
  const real =
    fecha.getUTCFullYear() === Number(anio) &&
    fecha.getUTCMonth() === Number(mes) - 1 &&
    fecha.getUTCDate() === Number(dia);

  return real ? `${anio}-${mes}-${dia}` : null;
}

/** Lo que se pudo leer, o por que no. */
export type Lectura =
  | { ok: true; lectura: LecturaDeTasas }
  | { ok: false; motivo: string };

/**
 * Saca de la pagina la fecha valor y todas las monedas que publica.
 *
 * Se guardan todas, no solo el dolar: cuesta lo mismo y evita volver a tocar
 * esto el dia que haga falta otra.
 */
export function leerTasasDeBcv(html: string): Lectura {
  const fecha = /class="date-display-single"[^>]*\scontent="([^"]+)"/.exec(html);
  const fechaValor = fecha ? comoFechaValor(fecha[1]) : null;

  if (!fechaValor) {
    return { ok: false, motivo: "No se encontro la fecha valor en la pagina" };
  }

  /*
   * Un bloque por moneda. Los tramos entre una pieza y la siguiente estan
   * acotados en longitud: sin esa cota, un bloque al que le faltara su cifra
   * se «comeria» la del siguiente y se guardaria el euro como dolar.
   */
  const bloque =
    /<div id="[a-z]+"[^>]*>[\s\S]{0,400}?<span>\s*([A-Z]{3})\s*<\/span>[\s\S]{0,200}?<strong[^>]*>\s*([\d.,]+)\s*<\/strong>/g;

  const tasas: TasaLeida[] = [];
  const vistas = new Set<string>();

  for (const [, moneda, cifra] of html.matchAll(bloque)) {
    const valor = comoDecimal(cifra);

    if (!valor) {
      return { ok: false, motivo: `La cifra de ${moneda} no es un numero valido` };
    }

    if (vistas.has(moneda)) {
      return { ok: false, motivo: `La pagina trae ${moneda} mas de una vez` };
    }

    vistas.add(moneda);
    tasas.push({ moneda, valor });
  }

  if (!vistas.has(MONEDA_OBLIGATORIA)) {
    return { ok: false, motivo: `No se encontro la tasa de ${MONEDA_OBLIGATORIA}` };
  }

  return { ok: true, lectura: { fuente: "bcv", fechaValor, tasas } };
}

/**
 * Compara una lectura con las ultimas tasas guardadas.
 *
 * Devuelve el motivo si alguna moneda salto mas de lo creible, o null si todo
 * encaja. Una moneda sin tasa anterior no tiene con que compararse y pasa.
 */
export function saltoIncreible(
  tasas: readonly TasaLeida[],
  anteriores: ReadonlyMap<string, string>,
): string | null {
  for (const tasa of tasas) {
    const anterior = Number(anteriores.get(tasa.moneda));

    if (!Number.isFinite(anterior) || anterior <= 0) continue;

    const cambio = Math.abs(Number(tasa.valor) - anterior) / anterior;

    if (cambio > SALTO_MAXIMO) {
      return (
        `${tasa.moneda} pasaria de ${anterior} a ${tasa.valor}, ` +
        `un cambio del ${Math.round(cambio * 100)} %`
      );
    }
  }

  return null;
}
