"use client";

import { useActionState } from "react";
import { Route } from "lucide-react";

import { ajustarRuta } from "@/actions/piezas";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { Boton } from "@/components/ui";
import { PLANTILLAS } from "@/lib/portal/catalogo";
import {
  ESTADO_INICIAL,
  NOMBRES_DE_CORRECCION,
  type NumeroFase,
  type Revision,
  type TipoProyecto,
} from "@/types";

/**
 * Lo que decidio el cliente en cada ronda y, mientras se pueda, el ajuste de
 * la ultima correccion: el ejecutivo solo puede anadir fases a la ruta.
 */

const FECHA = new Intl.DateTimeFormat("es-VE", { dateStyle: "medium", timeStyle: "short" });

export function RevisionesPieza({
  piezaId,
  tipo,
  revisiones,
  ajustable,
}: {
  piezaId: number;
  tipo: TipoProyecto;
  revisiones: Revision[];
  /** Si la ultima correccion se puede ajustar todavia, y quien mira gestiona. */
  ajustable: boolean;
}) {
  const [estado, enviar, enviando] = useActionState(ajustarRuta, ESTADO_INICIAL);
  useAvisoDeAccion(estado);

  if (revisiones.length === 0) {
    return <p className="text-[12.5px] text-suave">El cliente todavia no ha decidido sobre esta pieza.</p>;
  }

  const ultima = revisiones[0];
  const anadibles = ([1, 2, 3] as NumeroFase[]).filter((fase) => !ultima.fasesReabiertas.includes(fase));

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {revisiones.map((revision) => (
          <li key={revision.id} className="rounded-xl bg-campo px-3.5 py-2.5">
            <p className="text-[12.5px] font-semibold">
              Ronda {revision.ronda} ·{" "}
              {revision.decision === "aprobada"
                ? "Aprobada"
                : `Correccion: ${NOMBRES_DE_CORRECCION[revision.tipoCorreccion ?? "ambas"]}`}
            </p>
            <p className="text-[11.5px] text-suave">
              {revision.autorNombre} · {FECHA.format(new Date(revision.creadaEn))}
              {revision.decision === "correccion" &&
                ` · reabrio las fases ${revision.fasesReabiertas.join(", ")}`}
              {revision.ajustadaPorNombre && ` · ruta ajustada por ${revision.ajustadaPorNombre}`}
            </p>
            {revision.comentario && (
              <p className="mt-1.5 text-[13px] leading-relaxed whitespace-pre-line">
                «{revision.comentario}»
              </p>
            )}
          </li>
        ))}
      </ul>

      {ajustable && ultima.decision === "correccion" && anadibles.length > 0 && (
        <form action={enviar} className="rounded-xl border border-dashed border-borde px-3 py-3">
          <input type="hidden" name="piezaId" value={piezaId} />
          <p className="text-[12.5px] font-semibold">Ajustar la ruta</p>
          <p className="mt-0.5 mb-2 text-[11.5px] text-suave">
            Solo se pueden anadir fases, y solo hasta que se complete alguna de la ronda nueva.
          </p>
          <div className="flex flex-wrap gap-3">
            {anadibles.map((fase) => (
              <label key={fase} className="flex items-center gap-2 text-[12.5px]">
                <input
                  type="checkbox"
                  name="anadir"
                  value={fase}
                  className="size-[18px] accent-[var(--acento)]"
                />
                {fase} · {PLANTILLAS[tipo][fase].corto}
              </label>
            ))}
          </div>
          <div className="mt-2.5 flex justify-end">
            <Boton type="submit" variante="fantasma" tamano="chico" disabled={enviando}>
              <Route aria-hidden="true" />
              Anadir a la ruta
            </Boton>
          </div>
        </form>
      )}
    </div>
  );
}
