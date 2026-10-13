import type { ModoExterno } from "@/types";

/**
 * En que modo trabaja un servicio externo.
 *
 * Cada servicio tiene su variable (`CORREO_MODO`, `TASA_MODO`,
 * `ARCHIVOS_MODO`) y su valor por defecto, que es el que se usa si la variable
 * falta o trae algo que no se reconoce. Un valor mal escrito NO enciende el
 * modo real por accidente: cae al de por defecto.
 */
export function modoDe(variable: string, porDefecto: ModoExterno): ModoExterno {
  const valor = process.env[variable]?.trim().toLowerCase();

  return valor === "real" || valor === "simulado" ? valor : porDefecto;
}
