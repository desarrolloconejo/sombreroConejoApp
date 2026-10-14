"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCheck } from "lucide-react";

import { aprobarVarias } from "@/actions/revision";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { fechaCorta } from "@/components/proyectos/ColumnasProyectos";
import { Bateria, segmentosDePieza } from "@/components/ui";
import { nombreDeFase } from "@/lib/portal/catalogo";
import { rutaMiPieza } from "@/lib/portal/rutas";
import { ESTADO_INICIAL, NOMBRES_DE_TIPO_PIEZA, type Pieza, type TipoProyecto } from "@/types";

/**
 * Las piezas de un proyecto, como las ve el cliente: su bateria, en que fase
 * van y para cuando. Las que esperan su revision se abren; las demas solo
 * dicen como van (C3: las fechas estimadas se ven siempre).
 *
 * Quien puede aprobar marca varias y las aprueba de una vez: todas o ninguna.
 */
export function PiezasCliente({
  proyectoId,
  tipo,
  piezas,
  puedeAprobar,
}: {
  proyectoId: number;
  tipo: TipoProyecto;
  piezas: Pieza[];
  puedeAprobar: boolean;
}) {
  const [estado, enviar, enviando] = useActionState(aprobarVarias, ESTADO_INICIAL);
  useAvisoDeAccion(estado);

  const [marcadas, setMarcadas] = useState<number[]>([]);
  const esperando = piezas.filter((pieza) => pieza.avance.faseActual === 5);

  function alternar(id: number) {
    setMarcadas((actuales) =>
      actuales.includes(id) ? actuales.filter((otro) => otro !== id) : [...actuales, id],
    );
  }

  return (
    <form action={enviar} className="flex flex-col gap-3">
      {puedeAprobar && esperando.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[15px] bg-navy px-4 py-3 text-white">
          <p className="text-[13px]">
            <b className="font-semibold text-gold">{esperando.length} piezas esperan tu revision.</b>{" "}
            Puedes revisarlas una a una o aprobar varias de una vez.
          </p>
          {/* Dorado sobre navy: un Boton normal usaria el acento del tema. */}
          <button
            type="submit"
            disabled={enviando || marcadas.length === 0}
            className="suave inline-flex min-h-10 items-center gap-2 rounded-[12px] bg-gold px-4 py-2.5 text-[12.5px] font-semibold text-navy hover:-translate-y-0.5 hover:bg-white disabled:pointer-events-none disabled:opacity-60 [&>svg]:size-4"
          >
            <CheckCheck aria-hidden="true" />
            {marcadas.length > 0 ? `Aprobar ${marcadas.length}` : "Marca las que apruebas"}
          </button>
        </div>
      )}

      <ul className="flex flex-col gap-2.5">
        {piezas.map((pieza) => {
          const enRevision = pieza.avance.faseActual === 5;
          const aprobada = pieza.avance.aprobada;
          // Tambien la que esta en correccion: el cliente sigue ahi lo que pidio.
          const seAbre = enRevision || aprobada || pieza.ronda > 1;

          return (
            <li
              key={pieza.id}
              className={[
                "flex items-center gap-3.5 rounded-[15px] border bg-superficie px-4 py-3.5 shadow-[var(--sombra)]",
                enRevision ? "border-acento" : "border-borde",
              ].join(" ")}
            >
              {puedeAprobar && enRevision && esperando.length > 1 && (
                <input
                  type="checkbox"
                  name="piezaId"
                  value={pieza.id}
                  checked={marcadas.includes(pieza.id)}
                  onChange={() => alternar(pieza.id)}
                  aria-label={`Aprobar ${pieza.titulo}`}
                  className="size-[18px] shrink-0 accent-[var(--acento)]"
                />
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">
                  <span className="mr-2 text-[12px] text-acento tabular-nums">
                    {String(pieza.orden).padStart(2, "0")}
                  </span>
                  {pieza.titulo}
                </p>
                <p className="mt-0.5 truncate text-[12px] text-suave">
                  {NOMBRES_DE_TIPO_PIEZA[pieza.tipo]} ·{" "}
                  {aprobada
                    ? "Aprobada"
                    : enRevision
                      ? "Espera tu revision"
                      : `Fase ${pieza.avance.faseActual} de 5 · ${nombreDeFase(tipo, pieza.avance.faseActual ?? 1)}`}
                  {!aprobada &&
                    pieza.avance.fechaEstimadaActual &&
                    ` · para el ${fechaCorta(pieza.avance.fechaEstimadaActual)}`}
                  {pieza.ronda > 1 && ` · ronda ${pieza.ronda}`}
                </p>
              </div>

              <Bateria
                segmentos={segmentosDePieza(pieza.fases)}
                porcentaje={pieza.avance.porcentaje}
                etiqueta={`Avance de ${pieza.titulo}`}
                tamano="chico"
                className="hidden sm:inline-flex"
              />

              {seAbre ? (
                <Link
                  href={rutaMiPieza(proyectoId, pieza.id)}
                  className={[
                    "suave inline-flex shrink-0 items-center gap-1.5 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold [&>svg]:size-4",
                    enRevision
                      ? "bg-acento text-acento-contraste hover:bg-acento-hover"
                      : "border border-borde hover:border-acento hover:bg-acento hover:text-acento-contraste",
                  ].join(" ")}
                >
                  {enRevision ? "Revisar" : "Ver"}
                  <ArrowRight aria-hidden="true" />
                </Link>
              ) : (
                <span className="w-[74px] shrink-0 text-right text-[12px] text-suave tabular-nums">
                  {pieza.avance.porcentaje}%
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </form>
  );
}
