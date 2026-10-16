import Link from "next/link";

import { conOrden } from "@/lib/urlListado";
import type { Columna, EstadoListado } from "@/types";

import { IconoOrden } from "./ListadoTabla";

/**
 * El orden de un listado en rejilla. Sin cabeceras de tabla que pulsar, las
 * columnas ordenables salen como enlaces: el activo marcado y, pulsado otra
 * vez, en la direccion contraria. Como en la tabla, ordenar cambia la URL.
 */
export function ListadoOrden<T>({
  ruta,
  estado,
  columnas,
}: {
  ruta: string;
  estado: EstadoListado;
  columnas: Columna<T>[];
}) {
  const ordenables = columnas.filter((columna) => columna.ordenable);
  if (ordenables.length === 0) return null;

  return (
    <nav aria-label="Ordenar" className="flex flex-wrap items-center gap-1.5 border-b border-borde px-5 py-3">
      <span className="mr-1 text-[12px] font-semibold text-suave">Ordenar</span>
      {ordenables.map((columna) => {
        const activa = estado.orden === columna.clave;
        return (
          <Link
            key={columna.clave}
            href={conOrden(ruta, estado, columna.clave)}
            scroll={false}
            aria-current={activa ? "true" : undefined}
            className={[
              "suave inline-flex min-h-9 items-center gap-1.5 rounded-[10px] border px-3 text-[12.5px] font-semibold",
              activa
                ? "border-acento bg-acento-tenue text-texto"
                : "border-borde text-suave hover:-translate-y-0.5 hover:border-acento hover:text-texto",
            ].join(" ")}
          >
            {columna.titulo}
            <IconoOrden activa={activa} direccion={estado.direccion} />
            {activa && (
              <span className="sr-only">{estado.direccion === "asc" ? ", ascendente" : ", descendente"}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
