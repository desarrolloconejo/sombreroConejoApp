import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import type { EstadoListado } from "@/types";
import { OPCIONES_POR_PAGINA } from "@/lib/parametros";
import { conPagina, conPorPagina } from "@/lib/urlListado";

/**
 * Paginacion: cuantos se ven, cuantos caben por pagina y a cual ir.
 *
 * Todo son enlaces. El selector de tamano tampoco es un <select> que envie
 * solo al cambiar (eso exigiria JavaScript): es un <details> nativo con un
 * enlace por opcion, que funciona con teclado y sin scripts.
 *
 * Los extremos deshabilitados se pintan como <span>: un enlace que no lleva a
 * ninguna parte se puede enfocar y pulsar, y no anuncia que esta apagado.
 */

const MAXIMO_NUMEROS = 7;

const CELDA =
  "grid min-h-10 min-w-10 place-items-center rounded-[9px] border-[1.5px] px-2 " +
  "text-[12.5px] font-semibold " +
  "  ";

const CELDA_APAGADA =
  "suave border-borde text-suave  hover:border-acento hover:text-texto";

const CELDA_ACTIVA =
  "border-navy bg-acento text-acento-contraste " +
  "dark-tema:border-acento dark-tema:bg-gold dark-tema:text-navy";

const CELDA_MUDA = "border-borde text-suave opacity-40";

function rango(desde: number, hasta: number): number[] {
  const numeros: number[] = [];
  for (let numero = desde; numero <= hasta; numero += 1) numeros.push(numero);
  return numeros;
}

/**
 * Los numeros que se muestran, con `null` donde va una elipsis.
 *
 * Siempre siete huecos como mucho: los extremos nunca desaparecen, para poder
 * saltar al principio o al final desde cualquier punto.
 */
export function numerosDePagina(actual: number, total: number): (number | null)[] {
  if (total <= MAXIMO_NUMEROS) return rango(1, total);
  if (actual <= 4) return [...rango(1, 5), null, total];
  if (actual >= total - 3) return [1, null, ...rango(total - 4, total)];

  return [1, null, actual - 1, actual, actual + 1, null, total];
}

function Extremo({
  href,
  etiqueta,
  children,
}: {
  href: string | null;
  etiqueta: string;
  children: ReactNode;
}) {
  // Apagado no es un enlace ni pretende serlo: se oculta al lector de pantalla
  // porque un nombre sin destino solo estorba, y los numeros ya permiten
  // moverse. Un aria-label sobre un <span> generico, ademas, ni se anuncia.
  if (href === null) {
    return (
      <span aria-hidden="true" className={`${CELDA} ${CELDA_MUDA}`}>
        {children}
      </span>
    );
  }

  return (
    <Link href={href} aria-label={etiqueta} className={`${CELDA} ${CELDA_APAGADA}`}>
      {children}
    </Link>
  );
}

export function ListadoPaginacion({
  ruta,
  estado,
  total,
  totalPaginas,
  mostradas,
}: {
  ruta: string;
  estado: EstadoListado;
  total: number;
  totalPaginas: number;
  mostradas: number;
}) {
  const desde = (estado.pagina - 1) * estado.porPagina + 1;

  // Con `mostradas` en lugar de un calculo teorico, el texto sigue siendo
  // cierto cuando alguien pide a mano una pagina que ya no tiene registros.
  const texto =
    mostradas > 0
      ? `${desde} a ${desde + mostradas - 1} de ${total}`
      : `${total} en total`;

  const anterior = estado.pagina > 1 ? conPagina(ruta, estado, estado.pagina - 1) : null;
  const siguiente =
    estado.pagina < totalPaginas ? conPagina(ruta, estado, estado.pagina + 1) : null;

  return (
    <nav
      aria-label="Paginacion"
      className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-borde px-5 py-[13px]"
    >
      <p className="text-[12.5px] text-suave">{texto}</p>

      <div className="flex items-center gap-2 text-[12.5px] text-suave">
        <span aria-hidden="true">Mostrar</span>

        <details className="relative">
          <summary
            aria-label={`Mostrar ${estado.porPagina} registros por pagina`}
            className={[
              "flex min-h-10 cursor-pointer list-none items-center gap-[7px] rounded-[9px]",
              "border-[1.5px] border-borde px-3 font-semibold text-texto",
              "  ",
              "suave hover:border-acento",
              "marker:content-none [&::-webkit-details-marker]:hidden",
            ].join(" ")}
          >
            {estado.porPagina}
            <ChevronDown aria-hidden="true" className="size-[13px] text-suave" />
          </summary>

          <ul
            className={[
              "absolute bottom-full right-0 z-20 mb-2 min-w-[96px] rounded-xl border",
              "border-borde bg-superficie p-1.5 shadow-[var(--sombra-alta)]",
            ].join(" ")}
          >
            {OPCIONES_POR_PAGINA.map((cuantos) => (
              <li key={cuantos}>
                <Link
                  href={conPorPagina(ruta, estado, cuantos)}
                  aria-current={cuantos === estado.porPagina ? "true" : undefined}
                  className={[
                    "flex min-h-10 items-center rounded-lg px-3 font-semibold",
                    "  ",
                    cuantos === estado.porPagina
                      ? "bg-acento text-acento-contraste dark-tema:bg-gold dark-tema:text-navy"
                      : "suave text-suave hover:bg-acento-tenue hover:text-acento",
                  ].join(" ")}
                >
                  {cuantos}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </div>

      <ul className="ml-auto flex items-center gap-1.5">
        <li>
          <Extremo href={anterior} etiqueta="Pagina anterior">
            <ChevronLeft aria-hidden="true" strokeWidth={2.5} className="size-3.5" />
          </Extremo>
        </li>

        {numerosDePagina(estado.pagina, totalPaginas).map((numero, indice) => (
          <li key={numero ?? `salto-${indice}`}>
            {numero === null ? (
              <span aria-hidden="true" className="px-1 text-[12.5px] text-suave">
                &hellip;
              </span>
            ) : (
              <Link
                href={conPagina(ruta, estado, numero)}
                aria-label={`Pagina ${numero}`}
                aria-current={numero === estado.pagina ? "page" : undefined}
                className={[
                  CELDA,
                  numero === estado.pagina ? CELDA_ACTIVA : CELDA_APAGADA,
                ].join(" ")}
              >
                {numero}
              </Link>
            )}
          </li>
        ))}

        <li>
          <Extremo href={siguiente} etiqueta="Pagina siguiente">
            <ChevronRight aria-hidden="true" strokeWidth={2.5} className="size-3.5" />
          </Extremo>
        </li>
      </ul>
    </nav>
  );
}
