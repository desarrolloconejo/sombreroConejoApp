"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Copiar al portapapeles con confirmacion.
 *
 * `copiado` se enciende un rato para que el boton diga que lo hizo; un boton
 * que no responde deja la duda de si copio. `fallo` se enciende si el
 * navegador no deja (permiso denegado o http fuera de localhost): el texto
 * sigue a la vista para copiarlo a mano, y quien lo usa decide si lo dice.
 */
export function useCopiar(duracion = 2200) {
  const [copiado, setCopiado] = useState(false);
  const [fallo, setFallo] = useState(false);
  const temporizador = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(temporizador.current), []);

  async function copiar(texto: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(texto);
      setFallo(false);
      setCopiado(true);
      window.clearTimeout(temporizador.current);
      temporizador.current = window.setTimeout(() => setCopiado(false), duracion);
      return true;
    } catch {
      setCopiado(false);
      setFallo(true);
      return false;
    }
  }

  return { copiado, fallo, copiar };
}
