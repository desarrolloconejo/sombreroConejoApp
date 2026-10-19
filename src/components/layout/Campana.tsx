"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";

import { marcarNotificacionesLeidas } from "@/actions/notificaciones";
import type { ResumenDeNotificaciones } from "@/types";
import { ZONA_HORARIA } from "@/lib/fechas";

/**
 * La campana: cuantas notificaciones hay sin leer, y la lista al abrirla.
 *
 * Es de cliente por el despliegue. Los datos no los pide ella: se los inyecta
 * el layout, que es quien tiene la sesion. Abrirla las marca como leidas en el
 * servidor, y el layout vuelve a pintarla con el contador a cero.
 *
 * Hay dos en pantalla —la del encabezado de escritorio y la del movil— pero
 * solo una visible a la vez, y por eso cada una lleva su propio `id`.
 */

// Con zona fija: el servidor (UTC) y el navegador tienen que escribir la misma
// hora, o la hidratacion falla y React rehace el arbol.
const CUANDO = new Intl.DateTimeFormat("es-VE", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: ZONA_HORARIA,
});

/** "9+" a partir de diez: el numero exacto no cabe ni hace falta. */
function comoContador(cuantas: number): string {
  return cuantas > 9 ? "9+" : String(cuantas);
}

export function Campana({
  resumen,
  variante,
}: {
  resumen: ResumenDeNotificaciones;

  /** Donde esta montada: decide los colores del boton y de donde cuelga. */
  variante: "escritorio" | "movil";
}) {
  const [abierta, setAbierta] = useState(false);
  const [, iniciar] = useTransition();
  const ruta = usePathname();

  const caja = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);

  const idLista = `notificaciones-${variante}`;

  // Al navegar, la lista ya cumplio su papel. Se ajusta durante el render y no
  // en un efecto, que obligaria a pintar dos veces cada cambio de pagina.
  const [rutaPintada, setRutaPintada] = useState(ruta);
  if (ruta !== rutaPintada) {
    setRutaPintada(ruta);
    setAbierta(false);
  }

  useEffect(() => {
    if (!abierta) return;

    function alPulsarFuera(evento: PointerEvent) {
      if (!caja.current?.contains(evento.target as Node)) setAbierta(false);
    }

    function alTeclear(evento: KeyboardEvent) {
      if (evento.key !== "Escape") return;

      setAbierta(false);
      // El foco vuelve al boton que la abrio, que es donde estaba la atencion.
      boton.current?.focus();
    }

    document.addEventListener("pointerdown", alPulsarFuera);
    document.addEventListener("keydown", alTeclear);

    return () => {
      document.removeEventListener("pointerdown", alPulsarFuera);
      document.removeEventListener("keydown", alTeclear);
    };
  }, [abierta]);

  function alternar() {
    const abrir = !abierta;
    setAbierta(abrir);

    // Ver la lista es leerla. Va en una transicion: marcar no debe retrasar
    // que la lista aparezca.
    if (abrir && resumen.sinLeer > 0) {
      iniciar(() => marcarNotificacionesLeidas());
    }
  }

  const etiqueta =
    resumen.sinLeer === 0
      ? "Notificaciones"
      : `Notificaciones: ${resumen.sinLeer} sin leer`;

  return (
    <div ref={caja} className="relative shrink-0">
      <button
        ref={boton}
        type="button"
        onClick={alternar}
        aria-label={etiqueta}
        aria-expanded={abierta}
        aria-controls={idLista}
        className={[
          "suave relative grid cursor-pointer place-items-center rounded-xl",
          variante === "movil" ? "size-11" : "size-10 border border-borde",
          // Abierta se queda con el color del hover: es lo que dice de quien
          // cuelga la lista que acaba de aparecer.
          abierta
            ? "bg-acento text-acento-contraste"
            : variante === "movil"
              ? "bg-nav-realce text-nav-texto"
              : "bg-superficie text-suave",
          "hover:bg-acento hover:text-acento-contraste",
        ].join(" ")}
      >
        <Bell aria-hidden="true" className="size-[19px]" />

        {resumen.sinLeer > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-acento px-1 text-[10px] leading-none font-bold text-acento-contraste ring-2 ring-superficie"
          >
            {comoContador(resumen.sinLeer)}
          </span>
        )}
      </button>

      {abierta && (
        <div
          id={idLista}
          role="region"
          aria-label="Notificaciones"
          className={[
            "surge z-40 flex max-h-[min(70dvh,480px)] flex-col overflow-hidden rounded-[15px]",
            /*
             * En escritorio cuelga del boton, alineada a su derecha. En movil no
             * puede: el boton no esta en el borde, y una caja anclada a el se
             * saldria por la izquierda. Ahi ocupa el ancho de la pantalla,
             * justo debajo de la cabecera.
             */
            variante === "movil"
              ? "fixed inset-x-3 top-[72px]"
              : "absolute top-[calc(100%+10px)] right-0 w-[360px]",
            "border border-borde bg-superficie text-texto shadow-[var(--sombra-alta)]",
          ].join(" ")}
        >
          <p className="shrink-0 border-b border-borde px-4 py-3 text-[13px] font-bold">
            Notificaciones
          </p>

          {resumen.recientes.length === 0 ? (
            <p className="px-4 py-8 text-center text-[12.5px] leading-relaxed text-suave">
              No tienes notificaciones. Cuando pase algo que te toque, aparecera
              aqui.
            </p>
          ) : (
            <ul className="barra-fina-flotante min-h-0 flex-1 divide-y divide-borde overflow-y-auto overscroll-contain">
              {resumen.recientes.map((notificacion) => {
                const contenido = (
                  <>
                    <span className="flex items-start gap-2">
                      {/* El punto marca las que estaban sin leer al abrir. */}
                      <span
                        aria-hidden="true"
                        className={[
                          "mt-[6px] size-[7px] shrink-0 rounded-full",
                          notificacion.leida ? "bg-transparent" : "bg-acento",
                        ].join(" ")}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] leading-snug font-semibold">
                          {!notificacion.leida && (
                            <span className="sr-only">Sin leer: </span>
                          )}
                          {notificacion.titulo}
                        </span>

                        {notificacion.cuerpo && (
                          <span className="mt-0.5 block text-[12px] leading-snug text-suave">
                            {notificacion.cuerpo}
                          </span>
                        )}

                        <span className="mt-1 block text-[11px] text-suave tabular-nums">
                          {CUANDO.format(new Date(notificacion.creadoEn))}
                        </span>
                      </span>
                    </span>
                  </>
                );

                return (
                  <li key={notificacion.id}>
                    {notificacion.href ? (
                      <Link
                        href={notificacion.href}
                        onClick={() => setAbierta(false)}
                        className="suave block px-4 py-3 hover:bg-acento-tenue"
                      >
                        {contenido}
                      </Link>
                    ) : (
                      <div className="px-4 py-3">{contenido}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
