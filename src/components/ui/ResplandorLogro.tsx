"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Un resplandor alrededor de lo que envuelve (la bateria de una pieza) cada
 * vez que se completa algo en la pagina.
 *
 * Quien completa (una fase) lanza el evento LOGRO en window; la bateria vive
 * en otra parte del arbol y no comparten estado, asi que el evento es el
 * camino mas corto. Cambiar la `key` vuelve a montar el envoltorio y la
 * animacion corre otra vez.
 */

export const LOGRO = "conejo:logro";

/** Lo llama quien completa algo para que la pagina lo celebre. */
export function anunciarLogro() {
  window.dispatchEvent(new Event(LOGRO));
}

export function ResplandorLogro({ children }: { children: ReactNode }) {
  const [veces, setVeces] = useState(0);

  useEffect(() => {
    const alLograr = () => setVeces((antes) => antes + 1);
    window.addEventListener(LOGRO, alLograr);
    return () => window.removeEventListener(LOGRO, alLograr);
  }, []);

  return (
    <span key={veces} className={["inline-flex", veces > 0 ? "logro-brillo" : ""].join(" ")}>
      {children}
    </span>
  );
}
