import { createHash } from "node:crypto";

import type { RespuestaCongelada } from "@/types";
import { canonico } from "./briefs";

/**
 * El hash del contenido congelado de un brief:
 * SHA-256 del JSON canonico en UTF-8 (appFacturas/docs/05).
 *
 * Va aparte de briefs.ts porque necesita Node: el formulario del navegador no
 * lo calcula. Lo calcula el servidor al enviar y lo guarda con la version.
 */
export function hashDelContenido(contenido: RespuestaCongelada[]): string {
  return createHash("sha256").update(canonico(contenido), "utf8").digest("hex");
}
