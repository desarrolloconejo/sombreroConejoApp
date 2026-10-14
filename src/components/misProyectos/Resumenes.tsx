import Link from "next/link";
import { ArrowRight, Eye } from "lucide-react";

import { fechaCorta } from "@/components/proyectos/ColumnasProyectos";
import { Bateria, segmentosDeProyecto } from "@/components/ui";
import { RUTA_MIS_PROYECTOS, rutaMiProyecto } from "@/lib/portal/rutas";
import { NOMBRES_DE_ESTADO_PROYECTO, type Proyecto } from "@/types";

/**
 * Lo que el cliente ve de un vistazo: el aviso de lo que espera su revision y
 * una tarjeta por proyecto. Los usan el inicio y Mis proyectos.
 *
 * El aviso es dorado sobre navy: el dorado de la marca solo va sobre azul.
 */

export function AvisoRevision({ piezas }: { piezas: number }) {
  if (piezas === 0) return null;

  return (
    <Link
      href={RUTA_MIS_PROYECTOS}
      className="surge suave group flex items-center gap-4 rounded-[15px] bg-navy px-5 py-4 text-white shadow-[var(--sombra)] hover:-translate-y-0.5"
    >
      <span
        aria-hidden="true"
        className="grid size-10 shrink-0 place-items-center rounded-full bg-gold text-navy [&>svg]:size-5"
      >
        <Eye />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-gold">
          {piezas === 1 ? "1 pieza espera tu revision" : `${piezas} piezas esperan tu revision`}
        </span>
        <span className="block text-[12.5px] text-white/75">
          Apruebala o pide una correccion: el equipo sigue cuando decides.
        </span>
      </span>
      <ArrowRight aria-hidden="true" className="size-5 shrink-0 text-gold" />
    </Link>
  );
}

export function TarjetaProyectoCliente({ proyecto }: { proyecto: Proyecto }) {
  const esperando = proyecto.alertas.esperando_cliente;

  return (
    <Link
      href={rutaMiProyecto(proyecto.id)}
      className="suave flex h-full flex-col gap-4 rounded-[15px] border border-borde bg-superficie p-5 shadow-[var(--sombra)] hover:-translate-y-0.5 hover:border-acento"
    >
      <div className="min-w-0">
        <p className="truncate text-[15px] font-bold">{proyecto.nombre}</p>
        <p className="mt-0.5 text-[12px] text-suave">
          {proyecto.estado === "activo"
            ? `Cierre estimado: ${fechaCorta(proyecto.fechaEstimadaCierre)}`
            : NOMBRES_DE_ESTADO_PROYECTO[proyecto.estado]}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Bateria
          segmentos={segmentosDeProyecto(proyecto.avance.porcentaje)}
          porcentaje={proyecto.avance.porcentaje}
          etiqueta={`Avance de ${proyecto.nombre}`}
        />
        <span className="text-[17px] font-extrabold tabular-nums">
          {Math.round(proyecto.avance.porcentaje)}%
        </span>
      </div>

      <p className="mt-auto text-[12px] text-suave">
        {proyecto.avance.piezasAprobadas} de {proyecto.avance.totalPiezas}{" "}
        {proyecto.avance.totalPiezas === 1 ? "pieza aprobada" : "piezas aprobadas"}
        {esperando > 0 && (
          <span className="ml-2 rounded-full bg-navy px-2 py-0.5 font-semibold text-gold">
            {esperando} por revisar
          </span>
        )}
      </p>
    </Link>
  );
}
