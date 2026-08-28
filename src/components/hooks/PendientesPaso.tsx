import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Etiqueta } from "@/components/ui";
import { nombrePlataforma, objetivoDe } from "@/lib/hooks/catalogo";
import type { FichaConResultado } from "@/types";

/**
 * Lo que este paso tiene esperando, en una lista que se ve sin abrir nada.
 *
 * POR QUE HACE FALTA
 * ------------------
 * El auditor y las metricas son pasos de trabajo, no pantallas de consulta, y
 * hasta ahora no decian que tenian pendiente. El auditor solo ofrecia auditar
 * un texto suelto, sin mencionar que habia borradores esperando; las metricas
 * escondian las piezas publicadas dentro de un desplegable, donde no se ven
 * hasta que se abre. En los dos casos habia que ir al historial a averiguar
 * que faltaba, y volver.
 *
 * Es de EQUIPO a proposito, no de quien mira. La portada del modulo si es
 * personal —responde "que estoy haciendo yo"— pero esto es una cola de
 * trabajo: si alguien escribio una pieza y esta de vacaciones, su borrador
 * tiene que poder auditarlo otra persona. Por eso cada fila dice quien la
 * escribio.
 */

export function PendientesPaso({
  fichas,
  titulo,
  descripcion,
  accion,
  hrefDe,
  vacio,
}: {
  fichas: FichaConResultado[];
  titulo: string;
  descripcion: string;
  /** El verbo del boton de cada fila: "Auditar", "Registrar"... */
  accion: string;
  hrefDe: (ficha: FichaConResultado) => string;
  /** Que decir cuando no hay ninguna. */
  vacio: string;
}) {
  return (
    <section className="surge overflow-hidden rounded-[15px] border border-borde bg-superficie shadow-[var(--sombra)]">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-borde px-5 py-4">
        <div className="min-w-0">
          <p className="mb-1.5 text-[10.5px] font-bold tracking-[0.1em] text-suave uppercase">
            {titulo}
          </p>
          <p className="text-[12.5px] leading-relaxed text-suave">{descripcion}</p>
        </div>

        <b className="shrink-0 text-[19px] font-extrabold tracking-[-0.025em]">
          {fichas.length}
        </b>
      </div>

      {fichas.length === 0 ? (
        <p className="px-5 py-6 text-center text-[12.5px] text-suave">{vacio}</p>
      ) : (
        <ul>
          {fichas.map((ficha) => (
            <li key={ficha.id}>
              <Link
                href={hrefDe(ficha)}
                scroll={false}
                className="suave grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-borde px-5 py-3.5 last:border-b-0 hover:bg-acento-tenue"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold">
                    {ficha.hablado}
                  </span>

                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-suave">
                    <span className="truncate">{ficha.empresaNombre}</span>
                    <span aria-hidden="true">·</span>
                    <span>{objetivoDe(ficha.objetivo).nombre}</span>
                    <span aria-hidden="true">·</span>
                    <span>{nombrePlataforma(ficha.plataforma)}</span>

                    {/* Quien la escribio importa porque la cola es del equipo:
                        sin esto no se sabe a quien preguntar por una pieza. */}
                    {ficha.creadoPorNombre && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>la escribio {ficha.creadoPorNombre}</span>
                      </>
                    )}
                  </span>
                </span>

                <span className="flex shrink-0 items-center gap-2.5">
                  {ficha.notaAuditor !== null && (
                    <Etiqueta variante="contorno">{ficha.notaAuditor}</Etiqueta>
                  )}

                  <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-acento">
                    {accion}
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
