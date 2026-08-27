import { contarPalabras } from "@/lib/hooks/auditor";
import { metricaDe, nombrePlataforma, objetivoDe } from "@/lib/hooks/catalogo";

/**
 * La ficha de produccion: lo que edicion ejecuta sin interpretar la idea.
 *
 * Es texto plano en monoespaciada a proposito. No es nostalgia: la ficha se
 * copia y se pega en un mensaje, un correo o una nota de rodaje, y ahi no
 * sobrevive ningun formato. Lo unico que sobrevive es la alineacion por
 * espacios, y por eso las etiquetas se rellenan a un ancho fijo.
 *
 * Va a lo ancho y al final del canvas. Cuando estaba en una columna lateral
 * habia que recortar cada linea con puntos suspensivos y abrir un modal para
 * leerla entera, que es justo lo contrario de lo que sirve una ficha.
 */

export type ValoresFicha = {
  empresaNombre: string;
  objetivo: string;
  plataforma: string;
  audiencia: string;
  tension: string;
  verdadMarca: string;
  prueba: string;
  hablado: string;
  insertTitulo: string;
  primerFotograma: string;
  pagoPromesa: string;
  cta: string;
  riesgoClaim: string;
  nota: number | null;
  aprobado: boolean;
};

/** Ancho al que se alinean las etiquetas, como en el documento. */
const ANCHO_ETIQUETA = 23;

/** Un campo vacio imprime una raya, no una linea en blanco: se ve que falta. */
const VACIO = "—";

function linea(etiqueta: string, valor: string, sufijo = ""): string {
  return `${`${etiqueta}:`.padEnd(ANCHO_ETIQUETA)}${valor || VACIO}${sufijo}`;
}

function conPalabras(valor: string): string {
  if (!valor) return "";
  const n = contarPalabras(valor);
  return ` [${n} ${n === 1 ? "palabra" : "palabras"}]`;
}

/** El texto completo, tal como se copia al portapapeles o se exporta. */
export function textoDeFicha(v: ValoresFicha): string {
  const regla = "—".repeat(39);

  const auditor =
    v.nota === null
      ? "Pendiente de auditar"
      : `${v.nota}/100 · ${v.aprobado ? "APROBADO" : "REESCRIBIR"}`;

  return [
    "FICHA DE PRODUCCION — HOOK",
    regla,
    "",
    linea("CLIENTE", v.empresaNombre),
    linea("OBJETIVO", objetivoDe(v.objetivo).nombre),
    linea("METRICA PRINCIPAL", metricaDe(v.objetivo)),
    linea("PLATAFORMA", nombrePlataforma(v.plataforma)),
    linea("AUDIENCIA Y MOMENTO", v.audiencia),
    "",
    linea("TENSION O DESEO", v.tension),
    linea("VERDAD DE MARCA", v.verdadMarca),
    linea("PRUEBA DISPONIBLE", v.prueba),
    "",
    `—— APERTURA ${"—".repeat(26)}`,
    "",
    linea("HOOK HABLADO", v.hablado, conPalabras(v.hablado)),
    linea("INSERT-TITULO", v.insertTitulo, conPalabras(v.insertTitulo)),
    linea("PRIMER FOTOGRAMA", v.primerFotograma),
    linea("PAGO DE PROMESA", v.pagoPromesa),
    linea("CTA", v.cta),
    "",
    `—— CONTROL ${"—".repeat(27)}`,
    "",
    linea("RIESGO / CLAIM", v.riesgoClaim),
    linea("AUDITOR", auditor),
  ].join("\n");
}

export function FichaProduccion({ valores }: { valores: ValoresFicha }) {
  return (
    <pre
      className={[
        "m-0 overflow-x-auto px-6 py-5 font-mono text-[11.5px] leading-[1.9]",
        // La ficha se lee como bloque, no se envuelve: una linea partida
        // rompe la alineacion por espacios y deja de poder pegarse.
        "whitespace-pre text-texto",
      ].join(" ")}
    >
      {textoDeFicha(valores)}
    </pre>
  );
}
