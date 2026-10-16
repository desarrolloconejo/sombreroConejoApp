import Link from "next/link";
import { ArrowRight, CalendarDays, UserRound } from "lucide-react";

import { Bateria, Etiqueta, segmentosDeProyecto } from "@/components/ui";
import { rutaProyecto } from "@/lib/portal/rutas";
import { NOMBRES_DE_ESTADO_PROYECTO, type Proyecto } from "@/types";

import { fechaCorta, nombreDeServicio } from "./ColumnasProyectos";
import { EtiquetaAlerta, ORDEN_DE_ALERTAS } from "./EtiquetaAlerta";

/**
 * Un proyecto en la rejilla del listado. La bateria va arriba y a todo el
 * ancho: es lo primero que se mira, cuanto falta. Debajo, de quien es y que
 * es; al pie, quien lo lleva, cuando cierra y que mirar.
 *
 * La tarjeta entera es el enlace. Un proyecto que no esta activo se atenua y
 * dice por que junto al nombre de la empresa.
 */
export function TarjetaProyecto({ proyecto }: { proyecto: Proyecto }) {
  const { porcentaje, piezasAprobadas, totalPiezas } = proyecto.avance;
  const activo = proyecto.estado === "activo";
  const alertas = ORDEN_DE_ALERTAS.filter((alerta) => proyecto.alertas[alerta] > 0);

  return (
    <Link
      href={rutaProyecto(proyecto.id)}
      aria-label={`Abrir el proyecto ${proyecto.nombre} de ${proyecto.empresaNombre}`}
      className={[
        "suave group flex h-full flex-col rounded-[15px] border border-borde bg-superficie p-5",
        "hover:-translate-y-0.5 hover:border-acento hover:shadow-[var(--sombra)]",
        "focus-visible:outline-none focus-visible:shadow-[var(--foco)]",
      ].join(" ")}
    >
      <div className={activo ? "" : "opacity-60"}>
        <div className="flex items-center gap-3">
          <Bateria
            segmentos={segmentosDeProyecto(porcentaje)}
            porcentaje={porcentaje}
            etiqueta={`Avance de ${proyecto.nombre}`}
            tamano="ancho"
          />
          <span className="shrink-0 text-[22px] leading-none font-extrabold tracking-[-0.03em] tabular-nums">
            {Math.round(porcentaje)}%
          </span>
        </div>
        <p className="mt-2 text-[12px] text-suave">
          {totalPiezas === 0
            ? "Todavia sin piezas"
            : `${piezasAprobadas} de ${totalPiezas} ${totalPiezas === 1 ? "pieza aprobada" : "piezas aprobadas"}`}
        </p>
      </div>

      <div className="mt-4">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 truncate text-[15px] font-bold text-texto">{proyecto.empresaNombre}</span>
          {!activo && <Etiqueta>{NOMBRES_DE_ESTADO_PROYECTO[proyecto.estado]}</Etiqueta>}
        </p>
        <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-suave">
          {proyecto.nombre} · {nombreDeServicio(proyecto.servicio)}
        </p>
      </div>

      <div className="mt-auto pt-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-borde pt-3.5 text-[12px] text-suave">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <UserRound aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate">{proyecto.ejecutivoNombre}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <CalendarDays aria-hidden="true" className="size-3.5 shrink-0" />
            Cierre {fechaCorta(proyecto.fechaEstimadaCierre)}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {alertas.length === 0 ? (
              <span className="text-[12px] text-suave">Al dia</span>
            ) : (
              alertas.map((alerta) => (
                <EtiquetaAlerta key={alerta} alerta={alerta} cantidad={proyecto.alertas[alerta]} />
              ))
            )}
          </div>
          <ArrowRight
            aria-hidden="true"
            className="size-4 shrink-0 text-suave group-hover:translate-x-0.5 group-hover:text-acento"
          />
        </div>
      </div>
    </Link>
  );
}
