"use client";

import { useEffect, useRef } from "react";

import { useAvisos } from "./ProveedorAvisos";

/**
 * Convierte el resultado de una Server Action en un aviso flotante.
 *
 * Se llama con el estado que devuelve `useActionState` y no hay que hacer nada
 * mas: cada envio produce un aviso.
 *
 *   const [estado, enviar] = useActionState(guardar, ESTADO_INICIAL);
 *   useAvisoDeAccion(estado);
 *
 * SIEMPRE AVISA, SALGA BIEN O MAL
 * -------------------------------
 * Y eso incluye el caso que se escapa: una action que rechaza por validacion
 * devuelve `errores` pero NO `mensaje`. Sin este aviso, el unico rastro del
 * fallo era el texto rojo junto al campo — arriba de un formulario largo,
 * mientras quien pulso "Guardar" esta abajo. Parecia que no habia pasado nada.
 *
 * El aviso no repite el error del campo: dice que no se guardo y adonde mirar.
 * El detalle de que falta sigue pegado a su campo, que es donde se corrige.
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
  logro?: boolean;
  errores?: Record<string, string>;
}): void {
  const { avisar } = useAvisos();
  const anterior = useRef(estado);

  useEffect(() => {
    // En el primer render no ha habido envio: el estado sigue siendo el
    // inicial y no hay nada que anunciar.
    if (estado === anterior.current) return;

    anterior.current = estado;

    if (estado.mensaje) {
      avisar(estado.mensaje, estado.ok ? (estado.logro ? "logro" : "exito") : "error");
      return;
    }

    if (estado.ok) {
      avisar("Cambios guardados.", "exito");
      return;
    }

    const cuantos = Object.keys(estado.errores ?? {}).length;

    avisar(
      cuantos === 1
        ? "No se guardo: falta un campo por completar."
        : cuantos > 1
          ? `No se guardo: faltan ${cuantos} campos por completar.`
          : "No se pudo guardar.",
      "error",
    );
  }, [estado, avisar]);
}
