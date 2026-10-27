import { createHash, randomBytes } from "node:crypto";

/**
 * El criterio de «Olvide mi contrasena»: el token del enlace, cuanto dura y
 * cuantos se pueden pedir.
 *
 * El token viaja solo en el correo enviado. La base guarda su hash
 * (`restablecimientos_clave`) y la bandeja de salida guarda el correo con un
 * marcador en su lugar: ni quien lea la base ni quien lea la bandeja puede
 * usar un enlace ajeno.
 *
 * Solo de servidor: usa node:crypto.
 */

/** Lo que vale un enlace. */
export const MINUTOS_DEL_ENLACE = 30;

/** Cuantos enlaces puede pedir una persona por hora. Los de mas se ignoran sin decirlo. */
export const ENLACES_POR_HORA = 3;

/** Un token nuevo y su hash. El token se manda; el hash se guarda. */
export function nuevoToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashDeToken(token) };
}

/** El hash con que se guarda y se busca un token. */
export function hashDeToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Si un texto tiene la forma de un token: evita consultar la base con basura. */
export function pareceToken(valor: unknown): valor is string {
  return typeof valor === "string" && /^[A-Za-z0-9_-]{43}$/.test(valor);
}

/** El enlace del correo, o null si no se sabe la direccion publica. */
export function enlaceParaToken(token: string): string | null {
  const base = process.env.APP_URL_PUBLICA?.trim().replace(/\/+$/, "");
  return base ? `${base}/recuperar/nueva?token=${token}` : null;
}
