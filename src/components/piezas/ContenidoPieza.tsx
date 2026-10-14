"use client";

import { useActionState, useState } from "react";
import { Copy, MessageSquarePlus, Save } from "lucide-react";

import { comentarPieza, guardarCopy } from "@/actions/piezas";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { Boton } from "@/components/ui";
import { ESTADO_INICIAL, type ComentarioPieza } from "@/types";
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
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch {
      // Sin permiso para el portapapeles no hay nada que hacer: el texto
      // sigue ahi para seleccionarlo a mano.
    }
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

export function ComentariosPieza({
  piezaId,
  comentarios,
}: {
  piezaId: number;
  comentarios: ComentarioPieza[];
}) {
  const [estado, enviar, enviando] = useActionState(comentarPieza, ESTADO_INICIAL);
  useAvisoDeAccion(estado);

  const [texto, setTexto] = useState("");

  return (
    <div className="flex flex-col gap-3">
      {comentarios.length === 0 ? (
        <p className="text-[12.5px] text-suave">Nadie ha comentado esta pieza todavia.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {comentarios.map((comentario) => (
            <li key={comentario.id} className="rounded-xl bg-campo px-3.5 py-2.5">
              <p className="text-[11.5px] text-suave">
                <b className="font-semibold text-texto">{comentario.autorNombre}</b> ·{" "}
                {FECHA.format(new Date(comentario.creadoEn))}
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
        }}
        className="flex flex-col gap-2"
      >
        <input type="hidden" name="piezaId" value={piezaId} />
        <label htmlFor="pieza-comentario" className="sr-only">
          Nuevo comentario
        </label>
        <textarea
          id="pieza-comentario"
          name="texto"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Solo lo ve el equipo."
          className={AREA}
        />
        <div className="flex justify-end">
          <Boton type="submit" tamano="chico" disabled={enviando || !texto.trim()}>
            <MessageSquarePlus aria-hidden="true" />
            {enviando ? "Enviando…" : "Comentar"}
          </Boton>
        </div>
      </form>
    </div>
  );
}
