import { createHash, randomBytes } from "node:crypto";

/**
 * El token de renovacion: un secreto al azar que identifica una sesion.
 *
 * No es un JWT a proposito. No lleva datos ni firma: es solo un valor que
 * nadie puede adivinar, y lo unico que se hace con el es buscar su hash en la
 * tabla sesiones. Toda la autoridad vive en la base, que es lo que permite
 * retirarla.
 */

/** 32 bytes al azar, en un alfabeto que cabe en una cookie sin codificar. */
export function generarToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * El hash que se guarda en la base.
 *
 * SHA-256 a secas, sin sal ni coste: no hace falta. bcrypt existe para
 * proteger secretos que eligen las personas y se pueden adivinar; este tiene
 * 256 bits de azar, y probar valores hasta acertar es inviable con cualquier
 * funcion. A cambio se puede buscar por el en un indice.
 */
export function hashDeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Un nombre corto para el navegador de una sesion: "Chrome en Windows".
 *
 * Es para que una persona reconozca sus sesiones en una lista, no para
 * decidir nada: la cabecera la escribe quien hace la peticion.
 */
export function describirNavegador(agente: string | null): string | null {
  if (!agente) return null;

  const navegador = /Edg\//.test(agente)
    ? "Edge"
    : /OPR\/|Opera/.test(agente)
      ? "Opera"
      : /Firefox\//.test(agente)
        ? "Firefox"
        : /Chrome\//.test(agente)
          ? "Chrome"
          : /Safari\//.test(agente)
            ? "Safari"
            : null;

  const sistema = /Android/.test(agente)
    ? "Android"
    : /iPhone|iPad|iPod/.test(agente)
      ? "iOS"
      : /Windows/.test(agente)
        ? "Windows"
        : /Mac OS X/.test(agente)
          ? "macOS"
          : /Linux/.test(agente)
            ? "Linux"
            : null;

  if (navegador && sistema) return `${navegador} en ${sistema}`;

  return navegador ?? sistema;
}
