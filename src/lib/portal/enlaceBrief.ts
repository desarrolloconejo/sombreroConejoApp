import { transaccion } from "@/lib/db";
import { hashDeToken } from "@/lib/tokens";
import * as enlaces from "@/models/enlacesBrief";

/**
 * El enlace privado de un prospecto, comprobado.
 *
 * Es la guardia de la pagina /brief/[token] y de sus actions: quien llega
 * por el enlace no tiene sesion, y lo unico que lo identifica es el token.
 * Se busca por su hash; vencido, revocado o inexistente devuelven lo mismo,
 * `null`, sin decir cual de los tres.
 */

export type EnlaceValido = {
  id: number;
  prospectoId: number;
  formato: string;
  formatoVersion: number;
};

/** 32 bytes en base64url: 43 caracteres de ese alfabeto. */
const FORMA_DEL_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export async function enlaceValido(token: unknown): Promise<EnlaceValido | null> {
  if (typeof token !== "string" || !FORMA_DEL_TOKEN.test(token)) return null;

  // Sin identidad: la funcion de la base es la unica puerta, y no deja ver
  // otra cosa que el enlace de ese hash.
  return transaccion((tx) => enlaces.porToken(hashDeToken(token), tx));
}

/** La ruta publica de un enlace. Solo se muestra al generarlo. */
export function rutaDelEnlace(token: string): string {
  return `/brief/${token}`;
}
