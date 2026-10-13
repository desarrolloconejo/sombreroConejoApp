import type { CSSProperties } from "react";

/**
 * Los estilos de los campos de las pantallas de acceso.
 *
 * Los comparten el login y la pantalla del codigo, que es su segundo paso:
 * tienen que verse como la misma pantalla, y con una sola definicion no
 * pueden separarse sin querer.
 */

/**
 * La caja del campo. El borde y el foco viven en el contenedor y no en el
 * input porque dentro tambien hay un icono y, en la contrasena, un boton.
 * De ahi `focus-within` en lugar de `focus`.
 *
 * Al enfocar, el campo se ELEVA: fondo blanco, borde navy y una sombra
 * suave. Un halo de color alrededor se lee como un error, y ademas pisa la
 * senal que si tiene que significar eso.
 */
export const CAJA =
  "flex min-h-[50px] items-center gap-2.5 rounded-[11px] border-[1.5px] bg-campo px-3.5 " +
  "focus-within:border-acento focus-within:bg-superficie focus-within:shadow-[var(--foco)] " +
  "lg:gap-[11px] lg:px-[15px]";

export const CAJA_ERROR = "border-blackberry dark-tema:border-[#e9a9cd]";

export const ENTRADA =
  "w-full min-w-0 border-none bg-transparent text-[13.5px] text-texto " +
  // El foco lo pinta la caja de fuera con focus-within. Si el input pintara
  // ademas el suyo, se verian dos anillos superpuestos.
  "outline-none focus:outline-none focus-visible:outline-none " +
  "placeholder:text-suave lg:text-sm";

export const ICONO = "size-4 shrink-0 text-suave lg:size-[17px]";

export const ETIQUETA = "mb-[7px] block text-xs font-semibold lg:mb-2 lg:text-[12.5px]";

export const ERROR =
  "mt-1.5 text-[11.5px] font-medium leading-relaxed text-blackberry dark-tema:text-[#e9a9cd]";

/** Escalona la entrada de cada pieza con la animacion `surge`. */
export function retraso(segundos: string): CSSProperties {
  return { "--retraso": segundos } as CSSProperties;
}
