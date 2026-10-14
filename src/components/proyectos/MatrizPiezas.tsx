import Link from "next/link";
import { Ban, Check } from "lucide-react";

import { FASES, PLANTILLAS } from "@/lib/portal/catalogo";
import { rutaPieza } from "@/lib/portal/rutas";
import {
  NOMBRES_DE_ESTADO_FASE,
  NOMBRES_DE_TIPO_PIEZA,
  type FasePieza,
  type Pieza,
  type TipoProyecto,
} from "@/types";
import { fechaCorta } from "./ColumnasProyectos";

/**
 * La matriz de un proyecto: una fila por pieza, una columna por fase.
 *
 * Cada celda dice su estado con texto o icono, su fecha y, al pasar por
 * encima o con un lector de pantalla, quien es responsable. La fila entera
 * lleva a la ficha de la pieza.
 *
 * Es ancha a proposito: en un telefono se desplaza de lado dentro de su
 * tarjeta, sin mover la pagina.
 */

const REJILLA = "grid grid-cols-[minmax(150px,1.6fr)_repeat(5,minmax(92px,1fr))_minmax(96px,0.9fr)] items-center gap-2";

function Celda({ fase, cliente }: { fase: FasePieza; cliente: boolean }) {
  const descripcion = [
    `Fase ${fase.fase}: ${NOMBRES_DE_ESTADO_FASE[fase.estado]}`,
    fase.fechaEstimada ? `para el ${fechaCorta(fase.fechaEstimada)}` : null,
    fase.responsableNombre ? `responsable ${fase.responsableNombre}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const base = "flex h-10 flex-col items-center justify-center rounded-[9px] px-1 text-center";

  if (fase.estado === "completada") {
    return (
      <div
        title={descripcion}
        className={`${base} bg-blackberry text-white dark-tema:bg-gold dark-tema:text-navy`}
      >
        <Check aria-hidden="true" className="size-4" />
        <span className="sr-only">{descripcion}</span>
      </div>
    );
  }

  if (fase.estado === "en_curso") {
    return (
      <div
        title={descripcion}
        className={
          cliente
            ? `${base} bg-navy text-gold ring-2 ring-inset ring-gold`
            : `${base} bg-blackberry/45 text-white dark-tema:bg-gold/45 dark-tema:text-navy`
        }
      >
        <span aria-hidden="true" className="text-[11px] leading-tight font-bold">
          {cliente ? "Cliente" : "En curso"}
        </span>
        <span className="sr-only">{descripcion}</span>
        {fase.fechaEstimada && (
          <span className="text-[10px] leading-tight tabular-nums opacity-90">
            {fechaCorta(fase.fechaEstimada)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      title={descripcion}
      className={`${base} bg-blackberry/[0.07] text-suave dark-tema:bg-white/[0.06]`}
    >
      {fase.fechaEstimada && (
        <span aria-hidden="true" className="text-[10px] tabular-nums">{fechaCorta(fase.fechaEstimada)}</span>
      )}
      <span className="sr-only">{descripcion}</span>
    </div>
  );
}

/** Quien tiene la pieza ahora mismo, o en que esta. */
function ahora(pieza: Pieza): string {
  if (pieza.estado === "cancelada") return "Cancelada";
  if (pieza.avance.aprobada) return "Aprobada";
  if (pieza.avance.faseActual === 5) return "El cliente";

  const fase = pieza.fases.find((f) => f.fase === pieza.avance.faseActual);
  return fase?.responsableNombre ?? pieza.responsableNombre ?? "Sin asignar";
}

export function MatrizPiezas({
  proyectoId,
  tipo,
  piezas,
}: {
  proyectoId: number;
  tipo: TipoProyecto;
  piezas: Pieza[];
}) {
  const plantilla = PLANTILLAS[tipo];

  return (
    <div className="overflow-x-auto rounded-[15px] border border-borde bg-superficie shadow-[var(--sombra)]">
      <div className="min-w-[760px] p-4 sm:p-5">
        <div
          className={`${REJILLA} border-b border-borde pb-3 text-[10.5px] font-bold tracking-[0.08em] text-suave uppercase`}
        >
          <span>Pieza</span>
          {FASES.map((fase) => (
            <span key={fase} className="truncate text-center" title={plantilla[fase].nombre}>
              {fase} · {plantilla[fase].corto}
            </span>
          ))}
          <span>Ahora</span>
        </div>

        <ul>
          {piezas.map((pieza) => {
            const cancelada = pieza.estado === "cancelada";

            return (
              <li key={pieza.id} className="border-b border-borde last:border-b-0">
                <Link
                  href={rutaPieza(proyectoId, pieza.id)}
                  className={[
                    REJILLA,
                    "suave -mx-2 rounded-xl px-2 py-2 hover:bg-acento-tenue",
                    cancelada ? "opacity-55" : "",
                  ].join(" ")}
                >
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="text-[12px] font-bold text-acento tabular-nums">
                      {String(pieza.orden).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold">
                        {pieza.titulo}
                      </span>
                      <span className="block truncate text-[11px] text-suave">
                        {NOMBRES_DE_TIPO_PIEZA[pieza.tipo]}
                        {pieza.ronda > 1 && ` · ronda ${pieza.ronda}`}
                      </span>
                    </span>
                  </span>

                  {FASES.map((numero) => {
                    const fase = pieza.fases.find((f) => f.fase === numero);
                    return fase ? (
                      <Celda key={numero} fase={fase} cliente={numero === 5} />
                    ) : (
                      <span key={numero} />
                    );
                  })}

                  <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-suave">
                    {cancelada && <Ban aria-hidden="true" className="size-3.5 shrink-0" />}
                    <span className="truncate">{ahora(pieza)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
