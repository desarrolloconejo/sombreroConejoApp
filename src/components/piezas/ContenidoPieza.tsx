"use client";

import { useActionState, useState } from "react";
import { Copy, ListChecks, MessageSquarePlus, Save } from "lucide-react";

import { comentarPieza, guardarCopy } from "@/actions/piezas";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { Boton, Selector, useCopiar } from "@/components/ui";
import { ESTADO_INICIAL, type ComentarioPieza, type NumeroFase } from "@/types";
import { ZONA_HORARIA } from "@/lib/fechas";

/**
 * El copy de la pieza y la conversacion interna sobre ella.
 *
 * El copy lo edita quien trabaja en la pieza; el cliente lo vera en la fase 5.
 * Los comentarios no salen nunca del equipo.
 */

const AREA =
  "suave w-full rounded-xl border-[1.5px] border-borde bg-campo px-3.5 py-3 " +
  "text-[13.5px] leading-relaxed text-texto placeholder:text-suave " +
  "focus:border-acento focus:bg-superficie focus:shadow-[var(--foco)] focus:outline-none";

export function CopyPieza({
  piezaId,
  copy,
  editable,
}: {
  piezaId: number;
  copy: string;
  editable: boolean;
}) {
  const [estado, enviar, enviando] = useActionState(guardarCopy, ESTADO_INICIAL);
  useAvisoDeAccion(estado);

  const [texto, setTexto] = useState(copy);
  const { copiado, copiar: copiarTexto } = useCopiar(1600);

  async function copiar() {
    await copiarTexto(texto);
  }

  return (
    <form action={enviar} className="flex flex-col gap-2.5">
      <input type="hidden" name="piezaId" value={piezaId} />
      <label htmlFor="pieza-copy" className="sr-only">
        Copy de la pieza
      </label>
      <textarea
        id="pieza-copy"
        name="copy"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        readOnly={!editable}
        rows={7}
        maxLength={5000}
        placeholder={editable ? "El texto que acompana a la pieza al publicarse." : "Sin copy todavia."}
        className={AREA}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11.5px] text-suave tabular-nums">{texto.length} / 5000</span>
        <div className="flex gap-2">
          <Boton type="button" variante="fantasma" tamano="chico" onClick={copiar} disabled={!texto}>
            <Copy aria-hidden="true" />
            {copiado ? "Copiado" : "Copiar texto"}
          </Boton>
          {editable && (
            <Boton type="submit" tamano="chico" disabled={enviando || texto === copy}>
              <Save aria-hidden="true" />
              {enviando ? "Guardando…" : "Guardar"}
            </Boton>
          )}
        </div>
      </div>
    </form>
  );
}

// Con zona fija: el servidor (UTC) y el navegador tienen que escribir la misma
// hora, o la hidratacion falla y React rehace el arbol (y se pierden clics).
const FECHA = new Intl.DateTimeFormat("es-VE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: ZONA_HORARIA,
});

/**
 * Un hilo de comentarios: los de una fase, o los generales de la pieza (sin
 * fase). Si la fase tiene tareas, al escribir se puede marcar a cual se
 * refiere, y el comentario la lleva como etiqueta.
 */
export function HiloComentarios({
  piezaId,
  comentarios,
  fase = null,
  tareas = [],
  vacio,
}: {
  piezaId: number;
  /** Ya filtrados: los de esta fase, o los generales. */
  comentarios: ComentarioPieza[];
  fase?: NumeroFase | null;
  /** Las tareas de la fase, para elegir de cual se habla. */
  tareas?: { id: number; titulo: string }[];
  vacio: string;
}) {
  const [estado, enviar, enviando] = useActionState(comentarPieza, ESTADO_INICIAL);
  useAvisoDeAccion(estado);

  const [texto, setTexto] = useState("");
  const [tareaId, setTareaId] = useState("");
  const id = `comentario-${piezaId}-${fase ?? "general"}`;

  return (
    <div className="flex flex-col gap-3">
      {comentarios.length === 0 ? (
        <p className="text-[12.5px] text-suave">{vacio}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {comentarios.map((comentario) => (
            <li key={comentario.id} className="rounded-xl bg-campo px-3.5 py-2.5">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-suave">
                <span>
                  <b className="font-semibold text-texto">{comentario.autorNombre}</b> ·{" "}
                  {FECHA.format(new Date(comentario.creadoEn))}
                </span>
                {comentario.tareaTitulo && (
                  <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-borde bg-superficie px-2 py-0.5 text-[11px] font-semibold text-texto">
                    <ListChecks aria-hidden="true" className="size-3 shrink-0" />
                    <span className="truncate">{comentario.tareaTitulo}</span>
                  </span>
                )}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-line">{comentario.texto}</p>
            </li>
          ))}
        </ul>
      )}

      <form
        action={(datos) => {
          enviar(datos);
          setTexto("");
          setTareaId("");
        }}
        className="flex flex-col gap-2.5"
      >
        <input type="hidden" name="piezaId" value={piezaId} />
        {fase !== null && <input type="hidden" name="fase" value={fase} />}
        <label htmlFor={id} className="sr-only">
          Nuevo comentario
        </label>
        <textarea
          id={id}
          name="texto"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Solo lo ve el equipo."
          className={AREA}
        />
        <div className="flex flex-wrap items-center justify-end gap-2.5">
          {fase !== null && tareas.length > 0 && (
            <Selector
              id={`${id}-tarea`}
              nombre="tareaId"
              etiqueta="Sobre la tarea"
              etiquetaOculta
              compacto
              valor={tareaId}
              onCambio={setTareaId}
              opciones={[
                { valor: "", texto: "Sobre la fase en general" },
                ...tareas.map((tarea) => ({ valor: String(tarea.id), texto: tarea.titulo })),
              ]}
              className="min-w-0 flex-1 sm:max-w-[280px]"
            />
          )}
          <Boton type="submit" tamano="chico" disabled={enviando || !texto.trim()}>
            <MessageSquarePlus aria-hidden="true" />
            {enviando ? "Enviando…" : "Comentar"}
          </Boton>
        </div>
      </form>
    </div>
  );
}

/** Los comentarios generales de la pieza: los que no son de ninguna fase. */
export function ComentariosPieza({
  piezaId,
  comentarios,
}: {
  piezaId: number;
  comentarios: ComentarioPieza[];
}) {
  return (
    <HiloComentarios
      piezaId={piezaId}
      comentarios={comentarios.filter((comentario) => comentario.fase === null)}
      vacio="Sin comentarios generales. Lo de cada fase se comenta en su fase."
    />
  );
}
