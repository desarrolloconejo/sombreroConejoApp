"use client";

import { useEffect, useRef } from "react";

import { useAvisos } from "./ProveedorAvisos";

/**
 * Convierte el resultado de una Server Action en un aviso flotante.
 *
 * Se llama con el estado que devuelve `useActionState` y no hay que hacer nada
 * mas: cuando ese estado traiga un mensaje, se muestra.
 *
 *   const [estado, enviar] = useActionState(guardar, ESTADO_INICIAL);
 *   useAvisoDeAccion(estado);
 *
 * EL DETALLE QUE HACE FALTA
 * -------------------------
 * `useActionState` devuelve un objeto NUEVO en cada envio, pero dos envios con
 * el mismo resultado producen objetos distintos con el mismo contenido. Si el
 * efecto dependiera del contenido, guardar dos veces seguidas con exito solo
 * avisaria la primera. Por eso se compara la IDENTIDAD del objeto: cada
 * respuesta del servidor es una nueva, aunque diga lo mismo.
 */
export function useAvisoDeAccion(estado: {
  ok: boolean;
  mensaje?: string;
}): void {
  const { avisar } = useAvisos();
  const anterior = useRef(estado);

  useEffect(() => {
    if (estado === anterior.current) return;

    anterior.current = estado;

    // Los errores de campo no pasan por aqui: van pegados a su campo, que es
    // donde hay que corregirlos.
    if (!estado.mensaje) return;

    avisar(estado.mensaje, estado.ok ? "exito" : "error");
  }, [estado, avisar]);
}
