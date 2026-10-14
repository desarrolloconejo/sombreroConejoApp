"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Circle, ExternalLink } from "lucide-react";

import { marcarTareaLista, reabrirTarea } from "@/actions/tareas";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { fechaCorta } from "@/components/proyectos/ColumnasProyectos";
import { herramientaPorSlug } from "@/lib/herramientas";
import { nombreDeFase } from "@/lib/portal/catalogo";
import { rutaPieza } from "@/lib/portal/rutas";
import { ESTADO_INICIAL, NOMBRES_DE_TIPO_PIEZA, type TareaAsignada } from "@/types";

/**
 * Las tareas de quien mira, en tres grupos: lo que toca ahora, lo que viene y
 * lo ya hecho.
 *
 * Las acciones guardan su estado aqui y no en cada tarea: al marcarla, la
 * tarea cambia de grupo y su fila se desmonta, y se llevaria el aviso.
 */

type Grupo = { clave: string; titulo: string; explica: string; tareas: TareaAsignada[] };

function Fila({
  tarea,
  hoy,
  marcar,
  reabrir,
  ocupado,
}: {
  tarea: TareaAsignada;
  hoy: string;
  marcar: (datos: FormData) => void;
  reabrir: (datos: FormData) => void;
  ocupado: boolean;
}) {
  const lista = tarea.estado === "lista";
  const herramienta = herramientaPorSlug(tarea.herramienta);
  const atrasada = !lista && tarea.fechaEstimada !== null && tarea.fechaEstimada < hoy;

  return (
    <li className="flex items-start gap-3 rounded-[15px] border border-borde bg-superficie px-4 py-3.5 shadow-[var(--sombra)]">
      <form action={lista ? reabrir : marcar} className="pt-0.5">
        <input type="hidden" name="tareaId" value={tarea.id} />
        <button
          type="submit"
          disabled={ocupado}
          aria-label={lista ? `Reabrir la tarea ${tarea.titulo}` : `Marcar como lista la tarea ${tarea.titulo}`}
          title={lista ? "Reabrir" : "Marcar como lista"}
          className={[
            "suave grid size-8 shrink-0 place-items-center rounded-full border-2 [&>svg]:size-4",
            lista
              ? "border-blackberry bg-blackberry text-white dark-tema:border-gold dark-tema:bg-gold dark-tema:text-navy"
              : "border-borde text-transparent hover:border-acento hover:text-acento",
          ].join(" ")}
        >
          {lista ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}
        </button>
      </form>

      <div className="min-w-0 flex-1">
        <p className={["text-[14px] font-semibold", lista ? "text-suave line-through" : ""].join(" ")}>
          {tarea.titulo}
        </p>
        <p className="mt-0.5 truncate text-[12px] text-suave">
          {tarea.empresaNombre} · {tarea.proyectoNombre} · «{tarea.piezaTitulo}» (
          {NOMBRES_DE_TIPO_PIEZA[tarea.piezaTipo]})
        </p>
        <p className="mt-0.5 text-[12px] text-suave">
          {nombreDeFase(tarea.proyectoTipo, tarea.fase)}
          {tarea.fechaEstimada && (
            <>
              {" · "}
              <span className={atrasada ? "font-semibold text-blackberry dark-tema:text-gold" : ""}>
                {atrasada ? "Vencio el " : "Para el "}
                {fechaCorta(tarea.fechaEstimada)}
              </span>
            </>
          )}
        </p>

        <div className="mt-2.5 flex flex-wrap gap-2">
          {herramienta && !lista && (
            <Link
              href={herramienta.href(tarea.id)}
              className="suave inline-flex items-center gap-1.5 rounded-[10px] bg-acento px-3 py-1.5 text-[12px] font-semibold text-acento-contraste hover:bg-acento-hover [&>svg]:size-3.5"
            >
              Abrir {herramienta.titulo}
              <ExternalLink aria-hidden="true" />
            </Link>
          )}
          <Link
            href={rutaPieza(tarea.proyectoId, tarea.piezaId)}
            className="suave inline-flex items-center gap-1.5 rounded-[10px] border border-borde px-3 py-1.5 text-[12px] font-semibold hover:border-acento hover:bg-acento hover:text-acento-contraste [&>svg]:size-3.5"
          >
            Ver la pieza
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </div>
    </li>
  );
}

export function ListaMiTrabajo({
  tareas,
  hoy,
}: {
  tareas: TareaAsignada[];
  hoy: string;
}) {
  const [marcado, marcar, marcando] = useActionState(marcarTareaLista, ESTADO_INICIAL);
  const [reabierto, reabrir, reabriendo] = useActionState(reabrirTarea, ESTADO_INICIAL);

  useAvisoDeAccion(marcado);
  useAvisoDeAccion(reabierto);

  const ocupado = marcando || reabriendo;

  const grupos: Grupo[] = [
    {
      clave: "ahora",
      titulo: "Para hacer ahora",
      explica: "Su fase esta en curso: es lo que espera el resto.",
      tareas: tareas.filter((t) => t.estado === "pendiente" && t.faseEnCurso),
    },
    {
      clave: "despues",
      titulo: "Mas adelante",
      explica: "Su fase todavia no empieza. Te avisaremos cuando llegue.",
      tareas: tareas.filter((t) => t.estado === "pendiente" && !t.faseEnCurso),
    },
    {
      clave: "hechas",
      titulo: "Hechas",
      explica: "Se pueden reabrir mientras su fase no se complete.",
      tareas: tareas.filter((t) => t.estado === "lista"),
    },
  ].filter((grupo) => grupo.tareas.length > 0 || grupo.clave === "ahora");

  return (
    <div className="flex flex-col gap-8">
      {grupos.map((grupo, indice) => (
        <section
          key={grupo.clave}
          aria-labelledby={`grupo-${grupo.clave}`}
          className="surge"
          style={{ ["--retraso" as string]: `${0.1 + indice * 0.06}s` }}
        >
          <h2 id={`grupo-${grupo.clave}`} className="text-[19px] font-extrabold tracking-[-0.02em]">
            {grupo.titulo}
            <span className="ml-2 text-[13px] font-semibold text-suave tabular-nums">
              {grupo.tareas.length}
            </span>
          </h2>
          <p className="mt-0.5 mb-3 text-[12.5px] text-suave">{grupo.explica}</p>

          {grupo.tareas.length === 0 ? (
            <p className="rounded-[15px] border border-borde bg-superficie px-5 py-8 text-center text-[13px] text-suave">
              Nada pendiente por ahora.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {grupo.tareas.map((tarea) => (
                <Fila
                  key={tarea.id}
                  tarea={tarea}
                  hoy={hoy}
                  marcar={marcar}
                  reabrir={reabrir}
                  ocupado={ocupado}
                />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
