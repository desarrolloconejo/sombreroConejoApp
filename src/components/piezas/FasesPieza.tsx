import { MessageSquare } from "lucide-react";

import { fechaCorta } from "@/components/proyectos/ColumnasProyectos";
import { PLANTILLAS } from "@/lib/portal/catalogo";
import { esFaseDeTrabajo, faseQueSePuedeRegresar } from "@/lib/portal/fases";
import {
  NOMBRES_DE_ESTADO_FASE,
  type ComentarioPieza,
  type FasePieza,
  type Pieza,
  type PersonaDeEquipo,
  type Tarea,
  type TipoProyecto,
} from "@/types";
import { CompletarFase, MovimientosDeFase, PlanificarFase, RegresarFase } from "./AccionesFase";
import { HiloComentarios } from "./ContenidoPieza";
import { TareasFase } from "./TareasFase";

/**
 * Las cinco fases de una pieza, de arriba abajo, con sus tareas.
 *
 * La fase en curso va destacada. Quien gestiona la pieza ve ademas como
 * completarla, regresarla y planificarla; quien trabaja en ella ve sus
 * tareas y las marca.
 */

const MARCA: Record<FasePieza["estado"], string> = {
  completada:
    "bg-blackberry text-white border-blackberry dark-tema:bg-gold dark-tema:text-navy dark-tema:border-gold",
  en_curso: "bg-superficie text-acento border-acento",
  pendiente: "bg-campo text-suave border-borde",
};

export function FasesPieza({
  pieza,
  tipo,
  tareas,
  comentarios,
  gestiona,
  usuarioId,
  equipo,
}: {
  pieza: Pieza;
  tipo: TipoProyecto;
  tareas: Tarea[];
  /** Todos los de la pieza: cada fase se queda con los suyos. */
  comentarios: ComentarioPieza[];
  gestiona: boolean;
  usuarioId: number;
  equipo: PersonaDeEquipo[];
}) {
  const plantilla = PLANTILLAS[tipo];
  const activa = pieza.estado === "activa";
  const regresable = activa ? faseQueSePuedeRegresar(pieza.fases) : null;

  return (
    <MovimientosDeFase>
      <ol className="flex flex-col gap-4">
        {pieza.fases.map((fase) => {
          const enCurso = fase.estado === "en_curso";
          const deTrabajo = esFaseDeTrabajo(fase.fase);
          const suyas = tareas.filter((tarea) => tarea.fase === fase.fase);
          const pendientes = suyas.filter((tarea) => tarea.estado === "pendiente").length;
          const deLaFase = comentarios.filter((comentario) => comentario.fase === fase.fase);

          return (
            <li
              key={fase.id}
              aria-current={enCurso ? "step" : undefined}
              className={[
                "rounded-[15px] border bg-superficie p-5 shadow-[var(--sombra)] sm:p-6",
                enCurso ? "border-acento" : "border-borde",
              ].join(" ")}
            >
              <div className="flex items-start gap-4">
                <span
                  aria-hidden="true"
                  className={[
                    "grid size-9 shrink-0 place-items-center rounded-full border-2 text-[13px] font-extrabold",
                    MARCA[fase.estado],
                  ].join(" ")}
                >
                  {fase.fase}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="text-[14.5px] font-bold">{plantilla[fase.fase].nombre}</h3>
                    <span className="text-[11.5px] font-semibold text-suave">
                      {fase.fase === 5 && enCurso
                        ? "Esperando al cliente"
                        : NOMBRES_DE_ESTADO_FASE[fase.estado]}
                      {fase.estado === "completada" && fase.rondaCompletada && pieza.ronda > 1
                        ? ` en la ronda ${fase.rondaCompletada}`
                        : ""}
                    </span>
                  </div>

                  <p className="mt-1 text-[12px] text-suave">
                    {fase.fechaEstimada ? `Para el ${fechaCorta(fase.fechaEstimada)}` : "Sin fecha"}
                    {" · "}
                    {fase.responsableNombre ?? "Sin responsable"}
                  </p>

                  {deTrabajo && (
                    <TareasFase
                      piezaId={pieza.id}
                      fase={fase.fase as 1 | 3}
                      tareas={suyas}
                      gestiona={gestiona}
                      usuarioId={usuarioId}
                      equipo={equipo}
                      faseEnCurso={enCurso}
                      faseCompletada={fase.estado === "completada"}
                      piezaActiva={activa}
                    />
                  )}

                  {!deTrabajo && fase.fase === 5 && enCurso && (
                    <p className="mt-3 text-[12px] leading-relaxed text-suave">
                      La decide el cliente desde su portal: aprueba la pieza o pide una
                      correccion.
                    </p>
                  )}

                  {/*
                    Los comentarios de la fase, plegados: se abren solos si la
                    fase esta en curso y ya hay conversacion.
                  */}
                  <details
                    className="group mt-5 border-t border-borde pt-4"
                    open={enCurso && deLaFase.length > 0}
                  >
                    <summary className="flex cursor-pointer items-center gap-2 text-[12.5px] font-semibold text-acento select-none">
                      <MessageSquare aria-hidden="true" className="size-4" />
                      Comentarios
                      <span className="rounded-full bg-acento-tenue px-1.5 py-0.5 text-[11px] font-bold tabular-nums">
                        {deLaFase.length}
                      </span>
                    </summary>
                    <div className="mt-3.5">
                      <HiloComentarios
                        piezaId={pieza.id}
                        fase={fase.fase}
                        comentarios={deLaFase}
                        tareas={suyas.map((tarea) => ({ id: tarea.id, titulo: tarea.titulo }))}
                        vacio="Nadie ha comentado esta fase todavia."
                      />
                    </div>
                  </details>

                  {gestiona && activa && (
                    <div className="mt-5 flex flex-col gap-4 border-t border-borde pt-4">
                      {enCurso && fase.fase !== 5 && (
                        <CompletarFase piezaId={pieza.id} fase={fase.fase} pendientes={deTrabajo ? pendientes : 0} />
                      )}

                      {regresable === fase.fase && <RegresarFase piezaId={pieza.id} />}

                      {fase.estado !== "completada" && (
                        <details className="group">
                          <summary className="cursor-pointer text-[12px] font-semibold text-acento select-none">
                            Fecha y responsable de la fase
                          </summary>
                          <div className="mt-3.5">
                            <PlanificarFase piezaId={pieza.id} fase={fase} equipo={equipo} />
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </MovimientosDeFase>
  );
}
