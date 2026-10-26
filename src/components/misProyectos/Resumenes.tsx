import Link from "next/link";
import { ArrowRight, Eye } from "lucide-react";

import { fechaCorta } from "@/components/proyectos/ColumnasProyectos";
import { Bateria, segmentosDeProyecto } from "@/components/ui";
import { rutaMiPieza, rutaMiProyecto } from "@/lib/portal/rutas";
import { NOMBRES_DE_ESTADO_PROYECTO, type PiezaEsperandoCliente, type Proyecto } from "@/types";

/**
 * Lo que el cliente ve de un vistazo: el aviso de lo que espera su revision y
 * una tarjeta por proyecto. Los usan el inicio y Mis proyectos.
 *
 * El aviso es dorado sobre navy: el dorado de la marca solo va sobre azul.
 */

/**
 * Lo que espera la revision del cliente. Con una pieza, el aviso entero lleva
 * a ella; con varias, cada una tiene su enlace: un aviso que lleva a la misma
 * pagina en la que ya se esta no lleva a ningun sitio.
 */
export function AvisoRevision({ piezas }: { piezas: PiezaEsperandoCliente[] }) {
  if (piezas.length === 0) return null;

  const cabecera = (
    <>
      <span
        aria-hidden="true"
        className="grid size-10 shrink-0 place-items-center rounded-full bg-gold text-navy [&>svg]:size-5"
      >
        <Eye />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-gold">
          {piezas.length === 1 ? "1 pieza espera tu revision" : `${piezas.length} piezas esperan tu revision`}
        </span>
        <span className="block text-[12.5px] text-white/75">
          {piezas.length === 1
            ? `${piezas[0].titulo} · ${piezas[0].proyectoNombre}. Apruebala o pide una correccion.`
            : "Apruebalas o pide una correccion: el equipo sigue cuando decides."}
        </span>
      </span>
    </>
  );

  if (piezas.length === 1) {
    return (
      <Link
        href={rutaMiPieza(piezas[0].proyectoId, piezas[0].piezaId)}
        className="surge suave group flex items-center gap-4 rounded-[15px] bg-navy px-5 py-4 text-white shadow-[var(--sombra)] hover:-translate-y-0.5"
      >
        {cabecera}
        <ArrowRight aria-hidden="true" className="size-5 shrink-0 text-gold" />
      </Link>
    );
  }

  return (
    <section
      aria-label="Piezas que esperan tu revision"
      className="surge rounded-[15px] bg-navy px-5 py-4 text-white shadow-[var(--sombra)]"
    >
      <div className="flex items-center gap-4">{cabecera}</div>
      <ul className="mt-3.5 flex flex-col gap-1.5 border-t border-white/15 pt-3.5">
        {piezas.map((pieza) => (
          <li key={pieza.piezaId}>
            <Link
              href={rutaMiPieza(pieza.proyectoId, pieza.piezaId)}
              className="suave group flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/10"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold">{pieza.titulo}</span>
                <span className="block truncate text-[12px] text-white/65">{pieza.proyectoNombre}</span>
              </span>
              <ArrowRight
                aria-hidden="true"
                className="suave size-4 shrink-0 text-gold group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
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
