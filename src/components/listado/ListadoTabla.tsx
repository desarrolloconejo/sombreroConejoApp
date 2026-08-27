import Link from "next/link";
import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";

import type { Columna, EstadoListado } from "@/types";
import { conOrden } from "@/lib/urlListado";

import { ListadoTarjetas } from "./ListadoTarjetas";

/**
 * La tabla del listado.
 *
 * Es una <table> de verdad, pero maquetada con rejilla CSS para que todas las
 * columnas compartan un mismo reparto y las celdas se alineen verticalmente
 * sin trucos. Cambiar el `display` de los elementos de tabla les quita el rol
 * implicito en varios navegadores, asi que los roles se declaran a mano: sin
 * ellos un lector de pantalla dejaria de anunciar filas y columnas.
 *
 * Las cabeceras ordenables son enlaces, no botones: ordenar cambia la URL.
 *
 * Por debajo de lg la tabla desaparece y los mismos datos salen como tarjetas.
 * No se ocultan columnas con CSS: se cambia de estructura, porque una tabla de
 * cinco columnas en 360 px no cabe de ninguna manera. El corte esta en lg y no
 * antes porque es donde entra la quinta columna sin apretar.
 */

const ALINEACION = {
  izquierda: "text-left",
  derecha: "text-right",
  centro: "text-center",
} as const;

/**
 * Una fraccion suelta ("2.2fr") no deja encoger a la celda por debajo de su
 * contenido y desborda la rejilla en cuanto un nombre es largo. Con minmax(0,
 * ...) la columna si puede ceder y el texto se recorta donde toca.
 */
function pista(ancho?: string): string {
  const medida = ancho?.trim();

  if (!medida) return "minmax(0, 1fr)";

  return medida.endsWith("fr") ? `minmax(0, ${medida})` : medida;
}

function IconoOrden({ activa, direccion }: { activa: boolean; direccion: string }) {
  if (!activa) {
    return (
      <ChevronsUpDown
        aria-hidden="true"
        strokeWidth={2.5}
        className="size-3 shrink-0 opacity-[0.32]"
      />
    );
  }

  const Icono = direccion === "asc" ? ChevronUp : ChevronDown;

  return <Icono aria-hidden="true" strokeWidth={2.5} className="size-3 shrink-0" />;
}

export function ListadoTabla<T>({
  ruta,
  estado,
  columnas,
  filas,
  claveFila,
  titulo,
}: {
  ruta: string;
  estado: EstadoListado;
  columnas: Columna<T>[];
  filas: T[];
  claveFila?: (fila: T) => string | number;
  titulo?: string;
}) {
  const plantilla = columnas.map((columna) => pista(columna.ancho)).join(" ");
  const rejilla = "grid items-center gap-3.5 px-5";

  return (
    <>
      <ListadoTarjetas
        columnas={columnas}
        filas={filas}
        claveFila={claveFila}
        titulo={titulo}
      />

      {/*
        El desbordamiento horizontal se queda como red de seguridad para un
        modulo con muchas columnas en una pantalla justa: mejor poder arrastrar
        que ver la tabla partida.
      */}
      <div className="hidden overflow-x-auto lg:block">
        <table role="table" className="block w-full min-w-[680px]">
        {titulo && <caption className="sr-only">{titulo}</caption>}

        <thead role="rowgroup" className="block">
          <tr
            role="row"
            className={`${rejilla} h-11 border-b border-borde bg-campo`}
            style={{ gridTemplateColumns: plantilla }}
          >
            {columnas.map((columna) => {
              const activa = estado.orden === columna.clave;
              const alineacion = ALINEACION[columna.alineacion ?? "izquierda"];

              const contenido = columna.ordenable ? (
                <Link
                  href={conOrden(ruta, estado, columna.clave)}
                  className={[
                    "inline-flex min-h-11 items-center gap-[5px]",
                    "suave hover:text-texto",
                    activa ? "text-texto" : "",
                  ].join(" ")}
                >
                  {columna.titulo}
                  <IconoOrden activa={activa} direccion={estado.direccion} />
                </Link>
              ) : (
                columna.titulo
              );

              return (
                <th
                  key={columna.clave}
                  role="columnheader"
                  scope="col"
                  aria-sort={
                    columna.ordenable
                      ? activa
                        ? estado.direccion === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                      : undefined
                  }
                  className={[
                    "min-w-0 truncate p-0 text-[10.5px] font-bold uppercase",
                    "tracking-[0.1em] text-suave",
                    alineacion,
                  ].join(" ")}
                >
                  {contenido}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody role="rowgroup" className="block">
          {filas.map((fila, indice) => (
            <tr
              role="row"
              key={claveFila ? claveFila(fila) : indice}
              className={[
                rejilla,
                "min-h-[62px] border-b border-borde py-3 last:border-b-0",
                // La fila se tine del acento diluido, no de gris: el gris
                // no distingue el tema y encima se confunde con una fila
                // desactivada.
                "suave hover:bg-acento-tenue",
              ].join(" ")}
              style={{ gridTemplateColumns: plantilla }}
            >
              {columnas.map((columna) => (
                <td
                  key={columna.clave}
                  role="cell"
                  className={[
                    "min-w-0 p-0 text-[13px]",
                    ALINEACION[columna.alineacion ?? "izquierda"],
                  ].join(" ")}
                >
                  {columna.render(fila)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </>
  );
}
