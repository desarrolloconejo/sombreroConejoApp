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

/** Como se nombra cada tipo de pieza en el estandar del estudio. */
const TIPO_ESTANDAR: Record<TipoPieza, string> = {
  post: "POST",
  carrusel: "CARRUSEL",
  reel: "REEL",
  historia: "STORY",
  video: "VIDEO",
  logo: "LOGO",
  entregable: "PROPUESTA",
  otro: "PIEZA",
};

/**
 * Un bloque del nombre: MAYUSCULAS, sin acentos ni enie, con guiones entre
 * palabras y nada que no sea letra, numero o guion.
 */
export function bloque(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "SIN-NOMBRE";
}

/**
 * El nombre estandar del estudio:
 *
 *   CLIENTE_PROYECTO_ARCHIVO_TIPO_AAMMDD_VERSION.extension
 *
 * La version va con dos digitos (v01, v02...). La ultima aprobada lleva
 * APROBADO-CLIENTE en lugar del numero.
 */
export function nombreEstandar(datos: {
  cliente: string;
  proyecto: string;
  archivo: string;
  tipo: TipoPieza;
  /** AAAA-MM-DD, el dia de Caracas. */
  fecha: string;
  version: number | "aprobado";
  extension: string;
}): string {
  const fecha = datos.fecha.replaceAll("-", "").slice(2);
  const version =
    datos.version === "aprobado"
      ? "APROBADO-CLIENTE"
      : `v${String(datos.version).padStart(2, "0")}`;
  const extension = datos.extension.replace(/^\./, "").toLowerCase();

  return [
    bloque(datos.cliente),
    bloque(datos.proyecto),
    bloque(datos.archivo),
    TIPO_ESTANDAR[datos.tipo],
    fecha,
    version,
  ].join("_") + (extension ? `.${extension}` : "");
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
