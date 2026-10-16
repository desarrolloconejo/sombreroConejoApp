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
import { ESTADO_INICIAL, NOMBRES_DE_TIPO_PIEZA, type FaseACargo, type TareaAsignada } from "@/types";

/**
 * El trabajo de quien mira: arriba, las fases de las que es responsable (con
 * todas sus tareas pendientes, sean de quien sean); debajo, sus tareas, en
 * tres grupos: lo que toca ahora, lo que viene y lo ya hecho. Una tarea suya
 * dentro de una fase suya sale en los dos sitios a proposito: en la fase,
 * como parte de lo que falta; abajo, con su herramienta y su pieza.
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

/** Una fase a cargo de quien mira: donde esta, para cuando y lo que le falta. */
function TarjetaFase({
  fase,
  hoy,
  usuarioId,
  marcar,
  ocupado,
}: {
  fase: FaseACargo;
  hoy: string;
  usuarioId: number;
  marcar: (datos: FormData) => void;
  ocupado: boolean;
}) {
  const atrasada = fase.fechaEstimada !== null && fase.fechaEstimada < hoy;
  const enCurso = fase.estado === "en_curso";

  return (
    <li
      className={[
        "rounded-[15px] border bg-superficie p-5 shadow-[var(--sombra)] sm:p-6",
        enCurso ? "border-acento" : "border-borde",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <span
          aria-hidden="true"
          className={[
            "grid size-9 shrink-0 place-items-center rounded-full border-2 text-[13px] font-extrabold",
            enCurso ? "border-acento text-acento" : "border-borde text-suave",
          ].join(" ")}
        >
          {fase.fase}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold">
            {nombreDeFase(fase.proyectoTipo, fase.fase)}
            <span className="ml-2 text-[11.5px] font-semibold text-suave">
              {enCurso ? "En curso" : "Todavia no empieza"}
            </span>
          </h3>
          <p className="mt-0.5 truncate text-[12px] text-suave">
            {fase.empresaNombre} · {fase.proyectoNombre} · «{fase.piezaTitulo}» ({NOMBRES_DE_TIPO_PIEZA[fase.piezaTipo]})
          </p>
        </div>
        <p
          className={[
            "shrink-0 text-[12.5px] font-semibold",
            atrasada ? "text-blackberry dark-tema:text-gold" : "text-suave",
          ].join(" ")}
        >
          {fase.fechaEstimada ? `${atrasada ? "Vencio el" : "Para el"} ${fechaCorta(fase.fechaEstimada)}` : "Sin fecha"}
        </p>
      </div>

      {fase.tareas.length === 0 ? (
        <p className="mt-4 text-[12.5px] text-suave">
          Sin tareas pendientes: la fase se puede completar desde la pieza.
        </p>
      ) : (
        <ul aria-label={`Tareas pendientes de ${nombreDeFase(fase.proyectoTipo, fase.fase)}`} className="mt-4 flex flex-col gap-2">
          {fase.tareas.map((tarea) => {
            const mia = tarea.responsableId === usuarioId;
            return (
              <li
                key={tarea.id}
                className={[
                  "flex min-h-[52px] items-center gap-3 rounded-xl border px-3.5 py-2.5",
                  mia ? "border-acento/40 bg-acento-tenue" : "border-borde",
                ].join(" ")}
              >
                {mia ? (
                  <form action={marcar}>
                    <input type="hidden" name="tareaId" value={tarea.id} />
                    <button
                      type="submit"
                      disabled={ocupado}
                      aria-label={`Marcar como lista la tarea ${tarea.titulo}`}
                      title="Marcar como lista"
                      className="suave grid size-8 shrink-0 cursor-pointer place-items-center rounded-full border-2 border-borde text-transparent hover:border-acento hover:text-acento [&>svg]:size-4"
                    >
                      <Circle aria-hidden="true" />
                    </button>
                  </form>
                ) : (
                  <span aria-hidden="true" className="size-8 shrink-0 rounded-full border-2 border-dashed border-borde" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{tarea.titulo}</p>
                  <p className="truncate text-[11.5px] text-suave">
                    {mia ? "Tuya" : (tarea.responsableNombre ?? "Sin asignar")}
                    {tarea.fechaEstimada && ` · para el ${fechaCorta(tarea.fechaEstimada)}`}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 flex justify-end border-t border-borde pt-3.5">
        <Link
          href={rutaPieza(fase.proyectoId, fase.piezaId)}
          className="suave inline-flex items-center gap-1.5 rounded-[10px] border border-borde px-3 py-1.5 text-[12px] font-semibold hover:border-acento hover:bg-acento hover:text-acento-contraste [&>svg]:size-3.5"
        >
          Abrir la pieza
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </li>
  );
}

export function ListaMiTrabajo({
  tareas,
  fases,
  usuarioId,
  hoy,
}: {
  tareas: TareaAsignada[];
  fases: FaseACargo[];
  usuarioId: number;
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
      {fases.length > 0 && (
        <section aria-labelledby="grupo-fases" className="surge [--retraso:0.06s]">
          <h2 id="grupo-fases" className="text-[19px] font-extrabold tracking-[-0.02em]">
            Fases a tu cargo
            <span className="ml-2 text-[13px] font-semibold text-suave tabular-nums">{fases.length}</span>
          </h2>
          <p className="mt-0.5 mb-3 text-[12.5px] text-suave">
            Eres responsable de que salgan: aqui estan con su fecha y todo lo que les falta, de quien sea.
          </p>
          <ul className="flex flex-col gap-3">
            {fases.map((fase) => (
              <TarjetaFase
                key={fase.id}
                fase={fase}
                hoy={hoy}
                usuarioId={usuarioId}
                marcar={marcar}
                ocupado={ocupado}
              />
            ))}
          </ul>
        </section>
      )}

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
