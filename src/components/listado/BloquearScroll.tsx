"use client";

import { useEffect } from "react";

/**
 * Congela el desplazamiento de la pagina mientras hay un panel abierto.
 *
 * Sin esto, la rueda del raton sigue moviendo el contenido de detras en
 * cuanto el panel llega a su final: se ve el listado desplazandose bajo un
 * panel que no se ha cerrado, y al cerrarlo la pagina aparece en otro sitio.
 *
 * Se compensa el ancho de la barra de desplazamiento que desaparece al
 * ocultarla; si no, toda la pagina da un salto lateral al abrir el panel.
 *
 * No pinta nada: existe solo por su efecto.
 */
export function BloquearScroll() {
  useEffect(() => {
    const cuerpo = document.body;
    const desbordeAnterior = cuerpo.style.overflow;
    const rellenoAnterior = cuerpo.style.paddingRight;

    const anchoBarra = window.innerWidth - document.documentElement.clientWidth;

    cuerpo.style.overflow = "hidden";
    if (anchoBarra > 0) cuerpo.style.paddingRight = `${anchoBarra}px`;

    return () => {
      cuerpo.style.overflow = desbordeAnterior;
      cuerpo.style.paddingRight = rellenoAnterior;
    };
  }, []);

  return null;
}
