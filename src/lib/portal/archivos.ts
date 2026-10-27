import { bloque, fechaAamm, nombreDeArchivo, TIPO_DE_PIEZA } from "@/lib/nomenclatura";
import type { TipoPieza } from "@/types";

/**
 * Criterio sobre los archivos de las piezas, como funciones puras: como se
 * llaman, que tipos se aceptan y a que sitios puede apuntar un enlace.
 *
 * Lo que sube y lee los archivos es el adaptador de src/lib/externos/
 * archivos.ts; esto solo decide.
 */

/** El peso maximo de un archivo subido: lo que cabe en una peticion de Vercel. */
export const TAMANO_MAXIMO = 4 * 1024 * 1024;

/**
 * El nombre con que se guarda una version, con la nomenclatura de la agencia
 * (`src/lib/nomenclatura.ts`):
 *
 *   SIGLA_NOMBRE-CORTO_TIPO_AAMM_vNN.extension
 *
 * El cliente va por la sigla de la empresa y el proyecto por su nombre corto
 * (la base los propone si nadie los escribio). Si el proyecto tiene varias piezas del mismo tipo, el tipo lleva el orden
 * de la pieza entre ellas (POST-01, POST-02) para que no se pisen.
 */
export function nombreEstandar(datos: {
  /** La sigla de la empresa. */
  cliente: string;
  /** El nombre corto del proyecto. */
  proyecto: string;
  tipo: TipoPieza;
  /** El lugar de la pieza entre las de su tipo en el proyecto. */
  orden: { numero: number; total: number };
  /** AAAA-MM-DD, el dia de Caracas. */
  fecha: string;
  version: number | "aprobado";
  extension?: string;
}): string {
  const tipo =
    TIPO_DE_PIEZA[datos.tipo] +
    (datos.orden.total > 1 ? `-${String(datos.orden.numero).padStart(2, "0")}` : "");

  return nombreDeArchivo({
    cliente: bloque(datos.cliente),
    proyecto: bloque(datos.proyecto),
    tipo,
    fecha: fechaAamm(datos.fecha),
    version: datos.version,
    extension: datos.extension,
  });
}

/** Un tipo de archivo aceptado, reconocido por sus primeros bytes. */
export type TipoDeArchivo = { mime: string; extension: string; imagen: boolean };

/**
 * El tipo de un archivo por su firma, no por su nombre ni por lo que diga el
 * navegador: las dos cosas las escribe quien sube. Null si no es de los
 * aceptados. Los videos no se suben: van como enlace (Frame.io, Drive...).
 */
export function tipoPorFirma(bytes: Uint8Array): TipoDeArchivo | null {
  const empieza = (firma: number[], desde = 0) =>
    firma.every((byte, indice) => bytes[desde + indice] === byte);

  if (empieza([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: "image/png", extension: "png", imagen: true };
  }
  if (empieza([0xff, 0xd8, 0xff])) {
    return { mime: "image/jpeg", extension: "jpg", imagen: true };
  }
  if (empieza([0x47, 0x49, 0x46, 0x38])) {
    return { mime: "image/gif", extension: "gif", imagen: true };
  }
  if (empieza([0x52, 0x49, 0x46, 0x46]) && empieza([0x57, 0x45, 0x42, 0x50], 8)) {
    return { mime: "image/webp", extension: "webp", imagen: true };
  }
  if (empieza([0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { mime: "application/pdf", extension: "pdf", imagen: false };
  }

  return null;
}

/**
 * Los sitios a los que puede apuntar una version por enlace: donde el estudio
 * comparte video y diseno para revisar. Un enlace a cualquier otro sitio no
 * se acepta: el cliente lo abriria desde el portal fiandose de el.
 */
export const DOMINIOS_DE_ENLACE: readonly string[] = [
  "figma.com",
  "frame.io",
  "f.io",
  "dropbox.com",
  "drive.google.com",
  "docs.google.com",
  "vimeo.com",
  "youtube.com",
  "youtu.be",
  "canva.com",
];

/** El enlace limpio si es https y de un sitio de la lista; null si no. */
export function enlacePermitido(valor: string): string | null {
  let url: URL;

  try {
    url = new URL(valor.trim());
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || url.username || url.password) return null;

  const host = url.hostname.toLowerCase();
  const permitido = DOMINIOS_DE_ENLACE.some(
    (dominio) => host === dominio || host.endsWith(`.${dominio}`),
  );

  return permitido ? url.toString() : null;
}

/** El nombre del sitio de un enlace, para el boton que lo abre. */
export function sitioDeEnlace(enlace: string): string {
  try {
    return new URL(enlace).hostname.replace(/^www\./, "");
  } catch {
    return "enlace";
  }
}
