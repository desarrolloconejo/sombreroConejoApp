import type { ReactNode } from "react";
import { Ban } from "lucide-react";

import { EtiquetaAlerta } from "@/components/proyectos/EtiquetaAlerta";
import { fechaCorta } from "@/components/proyectos/ColumnasProyectos";
import { Bateria, ResplandorLogro, segmentosDePieza } from "@/components/ui";
import { nombreDeFase } from "@/lib/portal/catalogo";
import { NOMBRES_DE_TIPO_PIEZA, type Pieza, type TipoProyecto } from "@/types";

/**
 * La cabecera de una pieza: su bateria, en que fase esta, para cuando y sus
 * alertas. Las acciones las inyecta la page, segun quien mire.
 */
export function CabeceraPieza({
  pieza,
  tipo,
  acciones,
}: {
  pieza: Pieza;
  tipo: TipoProyecto;
  acciones?: ReactNode;
}) {
  const { avance } = pieza;

  const enQueVa = pieza.estado === "cancelada"
    ? "Cancelada"
    : avance.faseActual === null
      ? "Aprobada por el cliente"
      : `Fase ${avance.faseActual} de 5 · ${nombreDeFase(tipo, avance.faseActual)}`;

  return (
    <section
      aria-label="Estado de la pieza"
      className="surge rounded-[15px] border border-borde bg-superficie p-5 shadow-[var(--sombra)] [--retraso:0.1s] sm:p-6"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <ResplandorLogro>
            <Bateria
              segmentos={segmentosDePieza(pieza.fases)}
              porcentaje={avance.porcentaje}
              etiqueta="Avance de la pieza"
              tamano="grande"
            />
          </ResplandorLogro>
          <div className="min-w-0">
            <p className="text-[15px] font-bold">{enQueVa}</p>
            <p className="mt-0.5 text-[12px] text-suave">
              {NOMBRES_DE_TIPO_PIEZA[pieza.tipo]} · {avance.porcentaje}%
              {avance.fechaEstimadaActual && ` · para el ${fechaCorta(avance.fechaEstimadaActual)}`}
              {pieza.ronda > 1 && ` · ronda ${pieza.ronda}`}
              {pieza.responsableNombre && ` · a cargo de ${pieza.responsableNombre}`}
            </p>
          </div>
        </div>

        {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
      </div>

      {avance.alertas.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {avance.alertas.map((alerta) => (
            <EtiquetaAlerta key={alerta} alerta={alerta} />
          ))}
        </div>
      )}

      {pieza.estado === "cancelada" && (
        <p className="mt-4 flex items-start gap-2.5 rounded-xl border border-borde bg-campo px-4 py-3 text-[12.5px] leading-relaxed text-suave">
          <Ban aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            Esta pieza esta cancelada y no cuenta para el avance.
            {pieza.motivoCancelacion && ` Motivo: ${pieza.motivoCancelacion}`}
          </span>
        </p>
      )}
    </section>
  );
}
