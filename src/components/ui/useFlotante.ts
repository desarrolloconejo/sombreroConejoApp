"use client";

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

/**
 * Un panel que flota pegado a un control: la lista de Selector, el
 * calendario de CampoFecha.
 *
 * El panel se pinta en el <body> (con createPortal), fijo en la pantalla y
 * medido contra su ancla. Dentro de una tabla con desplazamiento lateral, un
 * panel absoluto quedaria recortado. Si no cabe debajo, abre hacia arriba.
 *
 * Mientras esta abierto, se cierra al pulsar fuera del ancla y del panel, y
 * se vuelve a medir si la pagina se desplaza o cambia de tamano. Cerrarlo al
 * desplazar no sirve: el navegador desplaza la pagina al enfocar el control,
 * y el panel se iria nada mas abrirlo.
 */

const MARGEN = 8;

export function useFlotante({
  abierto,
  cerrar,
  ancla,
  medida,
  panel,
  alto,
  anchoMinimo = 180,
  anchoFijo,
}: {
  abierto: boolean;
  cerrar: () => void;
  /** Lo que cuenta como dentro: pulsar ahi no cierra. */
  ancla: RefObject<HTMLElement | null>;
  /** Contra que se mide la posicion. Por defecto, el ancla. */
  medida?: RefObject<HTMLElement | null>;
  panel: RefObject<HTMLElement | null>;
  /** El alto que el panel necesita para abrir hacia abajo. */
  alto: number;
  anchoMinimo?: number;
  /** Si el panel tiene un ancho propio (un calendario), en lugar del del ancla. */
  anchoFijo?: number;
}) {
  const [posicion, setPosicion] = useState<CSSProperties>({});

  // La ultima version de cerrar y medir, sin volver a suscribir los eventos.
  const ultimo = useRef({ cerrar, medir });
  useEffect(() => {
    ultimo.current = { cerrar, medir };
  });

  function medir(): CSSProperties {
    const caja = (medida ?? ancla).current?.getBoundingClientRect();
    if (!caja) return {};

    const debajo = window.innerHeight - caja.bottom - MARGEN;
    const arriba = caja.top - MARGEN;
    const haciaArriba = debajo < alto && arriba > debajo;
    const disponible = window.innerWidth - MARGEN * 2;
    const ancho = Math.min(anchoFijo ?? Math.max(caja.width, anchoMinimo), disponible);
    const izquierda = Math.min(caja.left, window.innerWidth - ancho - MARGEN);

    return {
      left: Math.max(MARGEN, izquierda),
      ...(anchoFijo ? { width: ancho } : { minWidth: ancho, maxWidth: disponible }),
      maxHeight: Math.min(alto, Math.max(haciaArriba ? arriba : debajo, 120)),
      ...(haciaArriba ? { bottom: window.innerHeight - caja.top + 6 } : { top: caja.bottom + 6 }),
    };
  }

  useEffect(() => {
    if (!abierto) return;

    // En captura, para que un clic sobre otro control flotante cierre este
    // antes de que aquel se abra.
    function alPulsarFuera(evento: MouseEvent) {
      const objetivo = evento.target as Node;
      if (ancla.current?.contains(objetivo) || panel.current?.contains(objetivo)) return;
      ultimo.current.cerrar();
    }

    let cuadro = 0;
    function alMoverse(evento: Event) {
      if (panel.current?.contains(evento.target as Node)) return;
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(() => setPosicion(ultimo.current.medir()));
    }

    document.addEventListener("pointerdown", alPulsarFuera, true);
    window.addEventListener("scroll", alMoverse, true);
    window.addEventListener("resize", alMoverse);
    return () => {
      cancelAnimationFrame(cuadro);
      document.removeEventListener("pointerdown", alPulsarFuera, true);
      window.removeEventListener("scroll", alMoverse, true);
      window.removeEventListener("resize", alMoverse);
    };
  }, [abierto, ancla, panel]);

  return {
    posicion,
    /** Mide y coloca el panel. Se llama al abrir. */
    colocar: () => setPosicion(medir()),
  };
}
