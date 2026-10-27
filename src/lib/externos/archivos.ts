import { consultarUno } from "@/lib/db";
import type { ModoExterno } from "@/types";
import { ESPERA_GOOGLE, tokenDeGoogle } from "./google";
import { modoDe } from "./modo";

/**
 * El adaptador de archivos: donde viven los archivos de las versiones.
 *
 * Dos modos (seccion 6 del plan):
 *
 * - **simulado**: el archivo va a `portal.archivos_simulados`, en la base, con
 *   un limite pequeno. Es el de desarrollo: no necesita la cuenta de Google.
 * - **real**: Google Drive, en la carpeta `ConejoApp/Piezas` que crea
 *   `npm run drive:probar`. El id de Drive nunca llega al navegador.
 *
 * Cada archivo guarda en su id de donde es (`simulado:` o `drive:`), asi que
 * cambiar de modo no deja huerfanos a los ya subidos: se leen de donde estan.
 *
 * Nunca se llama dentro de una transaccion de la base: primero se sube y
 * despues se escribe la fila. Si la fila falla queda un archivo huerfano, que
 * es preferible a una fila que apunta a nada.
 */

const API = "https://www.googleapis.com/drive/v3";
const API_SUBIDA = "https://www.googleapis.com/upload/drive/v3";

/** Archivos arranca en real, como pide el plan; en desarrollo lo fija compose. */
export function modoDeArchivos(): ModoExterno {
  return modoDe("ARCHIVOS_MODO", "real");
}

/** Lo que hace falta para guardar un archivo. */
export type ArchivoNuevo = {
  nombre: string;
  mime: string;
  bytes: Uint8Array;
  /** Donde va en Drive: las versiones de las piezas, los comprobantes de pago o las fotos de perfil. */
  carpeta?: "piezas" | "comprobantes" | "perfiles";
};

/** La carpeta de Drive de cada tipo de archivo. Las crea npm run drive:probar. */
const CARPETAS = {
  piezas: "DRIVE_CARPETA_PIEZAS_ID",
  comprobantes: "DRIVE_CARPETA_COMPROBANTES_ID",
  perfiles: "DRIVE_CARPETA_PERFILES_ID",
} as const;

/** Guarda el archivo y devuelve su identificador, con el prefijo de su sitio. */
export async function subirArchivo(archivo: ArchivoNuevo): Promise<string> {
  if (modoDeArchivos() === "simulado") {
    const fila = await consultarUno<{ id: number }>(
      `INSERT INTO portal.archivos_simulados (nombre, mime, tamano, contenido)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [archivo.nombre, archivo.mime, archivo.bytes.byteLength, Buffer.from(archivo.bytes)],
    );

    if (!fila) throw new Error("No se pudo guardar el archivo simulado");

    return `simulado:${fila.id}`;
  }

  const variable = CARPETAS[archivo.carpeta ?? "piezas"];
  const carpeta = process.env[variable];
  if (!carpeta) throw new Error(`Falta ${variable}: ejecuta npm run drive:probar`);

  const token = await tokenDeGoogle();
  const cuerpo = new FormData();
  cuerpo.append(
    "metadata",
    new Blob([JSON.stringify({ name: archivo.nombre, parents: [carpeta] })], {
      type: "application/json",
    }),
  );
  cuerpo.append("file", new Blob([Buffer.from(archivo.bytes)], { type: archivo.mime }));

  const respuesta = await fetch(`${API_SUBIDA}/files?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: cuerpo,
    signal: AbortSignal.timeout(ESPERA_GOOGLE * 3),
  });

  if (!respuesta.ok) throw new Error(`Drive no acepto el archivo (${respuesta.status})`);

  const { id } = (await respuesta.json()) as { id?: unknown };
  if (typeof id !== "string") throw new Error("Drive no devolvio el id del archivo");

  return `drive:${id}`;
}

/** Un trozo pedido con la cabecera Range, ya entendido. */
export type Rango = { inicio: number; fin: number | null };

/** Lo que se entrega al navegador. */
export type ArchivoLeido = {
  cuerpo: ReadableStream<Uint8Array> | Uint8Array;
  /** El tamano completo del archivo, si se conoce. */
  tamano: number | null;
  /** Si se entrega un trozo, cual: para la cabecera Content-Range. */
  trozo: { inicio: number; fin: number } | null;
};

/**
 * Lee un archivo, entero o un trozo. Null si no existe.
 *
 * El trozo es lo que permite a un visor pedir el archivo por partes en lugar
 * de descargarlo entero antes de ensenar nada.
 */
export async function leerArchivo(id: string, rango: Rango | null): Promise<ArchivoLeido | null> {
  const [sitio, clave] = id.split(":", 2);

  if (sitio === "simulado") {
    const fila = await consultarUno<{ contenido: Buffer; tamano: number }>(
      "SELECT contenido, tamano FROM portal.archivos_simulados WHERE id = $1",
      [Number(clave)],
    );

    if (!fila) return null;

    const bytes = new Uint8Array(fila.contenido);

    if (!rango || rango.inicio >= bytes.byteLength) {
      return { cuerpo: bytes, tamano: bytes.byteLength, trozo: null };
    }

    const fin = Math.min(rango.fin ?? bytes.byteLength - 1, bytes.byteLength - 1);

    return {
      cuerpo: bytes.subarray(rango.inicio, fin + 1),
      tamano: bytes.byteLength,
      trozo: { inicio: rango.inicio, fin },
    };
  }

  if (sitio !== "drive" || !clave) return null;

  const token = await tokenDeGoogle();
  const cabeceras: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (rango) cabeceras.Range = `bytes=${rango.inicio}-${rango.fin ?? ""}`;

  const respuesta = await fetch(`${API}/files/${encodeURIComponent(clave)}?alt=media`, {
    headers: cabeceras,
    signal: AbortSignal.timeout(ESPERA_GOOGLE * 3),
  });

  if (respuesta.status === 404) return null;
  if (!respuesta.ok || !respuesta.body) {
    throw new Error(`Drive no entrego el archivo (${respuesta.status})`);
  }

  const total = respuesta.headers.get("content-range")?.split("/")[1];
  const largo = Number(respuesta.headers.get("content-length"));

  if (respuesta.status === 206 && rango) {
    return {
      cuerpo: respuesta.body,
      tamano: total && total !== "*" ? Number(total) : null,
      trozo: { inicio: rango.inicio, fin: rango.inicio + largo - 1 },
    };
  }

  return { cuerpo: respuesta.body, tamano: Number.isFinite(largo) ? largo : null, trozo: null };
}

/** La cabecera Range entendida, o null si no la hay o no se reconoce. */
export function leerRango(cabecera: string | null): Rango | null {
  const partes = cabecera?.match(/^bytes=(\d+)-(\d*)$/);
  if (!partes) return null;

  const inicio = Number(partes[1]);
  const fin = partes[2] ? Number(partes[2]) : null;

  return fin !== null && fin < inicio ? null : { inicio, fin };
}
