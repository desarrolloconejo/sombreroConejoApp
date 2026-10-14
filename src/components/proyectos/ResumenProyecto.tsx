import type { ReactNode } from "react";

import { Bateria, Etiqueta, segmentosDeProyecto } from "@/components/ui";
import { NOMBRES_DE_ESTADO_PROYECTO, type Proyecto } from "@/types";
import { fechaCorta, nombreDeServicio } from "./ColumnasProyectos";
import { EtiquetaAlerta, ORDEN_DE_ALERTAS } from "./EtiquetaAlerta";

/**
 * La cabecera de un proyecto: la bateria grande, los datos que se consultan
 * a diario y las alertas. Las acciones las inyecta la page, porque dependen de
 * si quien mira gestiona el proyecto.
 */

function Dato({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] font-bold tracking-[0.08em] text-suave uppercase">
        {rotulo}
      </dt>
      <dd className="mt-1 truncate text-[13px] font-semibold">{children}</dd>
    </div>
  );
}

export function ResumenProyecto({
  proyecto,
  acciones,
}: {
  proyecto: Proyecto;
  acciones?: ReactNode;
}) {
  const { avance } = proyecto;
  const alertas = ORDEN_DE_ALERTAS.filter((alerta) => proyecto.alertas[alerta] > 0);

  return (
    <section
      aria-label="Resumen del proyecto"
      className="surge rounded-[15px] border border-borde bg-superficie p-5 shadow-[var(--sombra)] [--retraso:0.1s] sm:p-6"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Bateria
            segmentos={segmentosDeProyecto(avance.porcentaje)}
            porcentaje={avance.porcentaje}
            etiqueta="Avance del proyecto"
            tamano="grande"
          />
          <div>
            <p className="text-[30px] leading-none font-extrabold tracking-[-0.03em] tabular-nums">
              {Math.round(avance.porcentaje)}%
            </p>
            <p className="mt-1 text-[12px] text-suave">
              {avance.piezasAprobadas} de {avance.totalPiezas}{" "}
              {avance.totalPiezas === 1 ? "pieza aprobada" : "piezas aprobadas"}
            </p>
          </div>
        </div>

        {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-borde pt-5 sm:grid-cols-4">
        <Dato rotulo="Lo lleva">{proyecto.ejecutivoNombre}</Dato>
        <Dato rotulo="Servicio">{nombreDeServicio(proyecto.servicio)}</Dato>
        <Dato rotulo="Inicio">{fechaCorta(proyecto.fechaInicio)}</Dato>
        <Dato rotulo="Cierre estimado">{fechaCorta(proyecto.fechaEstimadaCierre)}</Dato>
      </dl>

      {(alertas.length > 0 || proyecto.estado !== "activo") && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {proyecto.estado !== "activo" && (
            <Etiqueta variante="solida">{NOMBRES_DE_ESTADO_PROYECTO[proyecto.estado]}</Etiqueta>
          )}
          {alertas.map((alerta) => (
            <EtiquetaAlerta key={alerta} alerta={alerta} cantidad={proyecto.alertas[alerta]} />
          ))}
        </div>
      )}

      {proyecto.descripcion && (
        <p className="mt-4 max-w-[80ch] text-[12.5px] leading-relaxed text-suave">
          {proyecto.descripcion}
        </p>
      )}
    </section>
  );
}
