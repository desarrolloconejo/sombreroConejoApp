"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

/**
 * La caja que abre y cierra un grupo de filtros.
 *
 * Es lo UNICO de cliente del listado, y a proposito: las opciones de dentro
 * siguen siendo enlaces renderizados en el servidor, que llegan como children.
 * Este componente solo decide si se ven o no.
 *
 * Antes cada filtro pintaba todas sus opciones a la vez. Con cuatro grupos
 * eran diecisiete pastillas en tres filas, todas con el mismo aspecto y sin
 * nada que dijera cual pertenecia a que: mas ruido que ayuda. Agrupadas bajo
 * su nombre, la misma informacion cabe en una fila.
 */

/*
 * En movil ocupa la fila entera, igual que el buscador; desde sm se ajusta a
 * su contenido y vuelve a la fila compartida.
 *
 * Antes iba a su ancho natural tambien en movil, y como cada rotulo mide
 * distinto ("Rol" frente a "Estado de la cuenta") los cuatro se repartian dos,
 * uno y uno: una escalera irregular que parecia rota. A ancho completo el
 * borde izquierdo de todos cae en la misma linea que el del buscador.
 */
const DISPARADOR =
  "flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-[10px] " +
  "border-[1.5px] px-3 text-[12.5px] sm:inline-flex sm:w-auto";

const EN_REPOSO =
  "suave border-borde bg-transparent text-suave  hover:border-acento hover:text-texto";

/** Cuando hay algo elegido, el filtro tiene que notarse de un vistazo. */
const CON_FILTRO = "border-acento bg-acento-tenue text-texto";

export function FiltroDesplegable({
  titulo,
  resumen,
  activo,
  children,
}: {
  titulo: string;
  /** Lo elegido ahora mismo, para leerlo sin abrir. */
  resumen: string;
  /** Si hay un filtro puesto en este grupo. */
  activo: boolean;
  children: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const disparador = useRef<HTMLButtonElement>(null);
  const idPanel = useId();

  useEffect(() => {
    if (!abierto) return;

    function alPulsarFuera(evento: MouseEvent) {
      if (!caja.current?.contains(evento.target as Node)) setAbierto(false);
    }

    function alPulsarEscape(evento: KeyboardEvent) {
      if (evento.key !== "Escape") return;

      setAbierto(false);
      disparador.current?.focus();
    }

    document.addEventListener("pointerdown", alPulsarFuera, true);
    document.addEventListener("keydown", alPulsarEscape);

    return () => {
      document.removeEventListener("pointerdown", alPulsarFuera, true);
      document.removeEventListener("keydown", alPulsarEscape);
    };
  }, [abierto]);

  return (
    <div ref={caja} className="relative">
      <button
        ref={disparador}
        type="button"
        aria-expanded={abierto}
        aria-controls={idPanel}
        onClick={() => setAbierto((x) => !x)}
        className={[DISPARADOR, activo ? CON_FILTRO : EN_REPOSO].join(" ")}
      >
        <span className="shrink-0 font-medium text-suave">{titulo}</span>

        {/*
          El resumen se queda con el hueco sobrante y empuja la flecha al
          extremo derecho. Asi las cuatro flechas quedan alineadas en columna
          en lugar de flotar cada una detras de su texto.
        */}
        <span className="min-w-0 flex-1 truncate text-left font-semibold sm:flex-none">
          {resumen}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={[
            "suave size-3.5 shrink-0",
            abierto ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {abierto && (
        <div
          id={idPanel}
          /*
           * NO se cierra al elegir, y es deliberado.
           *
           * Antes se cerraba porque solo cabia una opcion: elegida una, no
           * quedaba nada que hacer ahi. Ahora se pueden marcar varias, y
           * cerrarse tras la primera obligaria a volver a abrirlo para cada
           * valor. Se cierra pulsando fuera, con Escape o con el propio boton.
           */
          className={[
            "absolute z-30 mt-1.5 w-full min-w-[190px] rounded-xl border border-borde sm:w-auto",
            "bg-superficie p-1.5 shadow-[var(--sombra-alta)]",
          ].join(" ")}
        >
          {children}
        </div>
      )}
    </div>
  );
}
