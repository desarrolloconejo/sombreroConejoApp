import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { EtiquetaDocumento } from "@/components/finanzas";
import { dolares } from "@/lib/finanzas/documentos";
import type { EstadoProforma, SituacionPresupuesto } from "@/types";

/**
 * Una lista corta de documentos para el cliente: numero, titulo, una linea de
 * contexto, su estado y su total. Cada fila lleva a la ficha.
 *
 * Es una lista, no el Listado con filtros del equipo: un cliente tiene pocos
 * documentos y los quiere ver de un vistazo, no buscar entre ellos.
 */

export type FilaDocumento = {
  id: number;
  href: string;
  numero: string;
  titulo: string;
  detalle: string;
  situacion: SituacionPresupuesto | EstadoProforma;
  total: string;
};

export function ListaDocumentos({
  filas,
  vacio,
  etiqueta,
}: {
  filas: FilaDocumento[];
  vacio: string;
  etiqueta: string;
}) {
  if (filas.length === 0) {
    return <p className="text-[13px] leading-relaxed text-suave">{vacio}</p>;
  }

  return (
    <ul aria-label={etiqueta} className="-my-1 flex flex-col">
      {filas.map((fila) => (
        <li key={fila.id} className="border-b border-borde last:border-0">
          <Link
            href={fila.href}
            className="suave group -mx-2 flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-acento-tenue"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[11.5px] font-semibold tabular-nums text-suave">{fila.numero}</p>
              <p className="truncate text-[14px] font-semibold">{fila.titulo}</p>
              <p className="mt-0.5 text-[12px] text-suave">{fila.detalle}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className="text-[14px] font-bold tabular-nums">{dolares(fila.total)}</span>
              <EtiquetaDocumento situacion={fila.situacion} />
            </div>
            <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-suave" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
