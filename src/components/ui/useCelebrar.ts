"use client";

import { useEffect, useState } from "react";

/**
 * Cual es la tarea que se acaba de marcar, para celebrarla a ella y no a todas
 * las que ya estaban listas.
 *
 * `envolver` toma la action de marcar y anota el `tareaId` del formulario
 * antes de enviarlo. La marca dura unos segundos: lo justo para que la
 * respuesta llegue y la fila, ya lista, se pinte con la animacion, que corre
 * una sola vez al aparecer la clase.
 */
export function useCelebrar(duracion = 8000) {
  const [celebrada, setCelebrada] = useState<number | null>(null);

  useEffect(() => {
    if (celebrada === null) return;
    const temporizador = window.setTimeout(() => setCelebrada(null), duracion);
    return () => window.clearTimeout(temporizador);
  }, [celebrada, duracion]);

  function envolver(accion: (datos: FormData) => void) {
    return (datos: FormData) => {
      setCelebrada(Number(datos.get("tareaId")));
      accion(datos);
    };
  }

  return { celebrada, envolver };
}
