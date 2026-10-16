import type { ReactNode } from "react";

import type { Columna, DefinicionFiltro, EstadoListado } from "@/types";
import { hayCriterios } from "@/lib/parametros";
import { sinFiltros } from "@/lib/urlListado";
import { BotonEnlace } from "@/components/ui";

import { ListadoBuscador } from "./ListadoBuscador";
import { ListadoFiltros } from "./ListadoFiltros";
import { ListadoOrden } from "./ListadoOrden";
import { ListadoPaginacion } from "./ListadoPaginacion";
import { ListadoTabla } from "./ListadoTabla";
import { ListadoVacio } from "./ListadoVacio";

/**
 * El listado estandar. Todos los modulos que muestren registros usan este.
 *
 * La page consulta el modelo y le inyecta aqui las filas ya listas junto con
 * el estado leido de la URL; el componente no sabe de que modulo se trata.
 * Como cada interaccion es un enlace o un formulario GET, no hay estado que
 * mantener y todo el arbol se renderiza en el servidor.
 */

export type AccionListado = {
  texto: string;
  href: string;
  icono?: ReactNode;
};

export type PropsListado<T> = {
  /** Ruta de la page, sin querystring. Sobre ella se construyen los enlaces. */
  ruta: string;
  estado: EstadoListado;
  columnas: Columna<T>[];
  filas: T[];
  total: number;
  totalPaginas: number;

  filtros?: DefinicionFiltro[];

  /** Accion principal, normalmente la que abre el panel de alta. */
  accion?: AccionListado;

  /** El PanelLateral ya montado, cuando la URL lo pide. */
  panel?: ReactNode;

  /**
   * Estado vacio propio del modulo. Solo se usa cuando NO hay criterios: si
   * la lista esta vacia por una busqueda o un filtro, lo util es ofrecer
   * quitarlos, y de eso se encarga el estado vacio de serie.
   */
  vacio?: ReactNode;

  marcadorBusqueda?: string;
  etiquetaBusqueda?: string;

  /** Clave estable de cada fila. Sin ella se usa la posicion. */
  claveFila?: (fila: T) => string | number;

  /** Nombre de la tabla para lectores de pantalla. */
  titulo?: string;

  /**
   * Si viene, el listado se pinta como una rejilla de tarjetas en lugar de
   * una tabla: cada fila es lo que devuelve. El orden pasa a un control
   * propio, con las columnas que se declararon `ordenable`.
   */
  rejilla?: (fila: T) => ReactNode;

  className?: string;
};

export function Listado<T>({
  ruta,
  estado,
  columnas,
  filas,
  total,
  totalPaginas,
  filtros = [],
  accion,
  panel,
  vacio,
  marcadorBusqueda = "Buscar",
  etiquetaBusqueda = "Buscar",
  claveFila,
  titulo,
  rejilla,
  className,
}: PropsListado<T>) {
  const filtrado = hayCriterios(estado);
  const hayFilas = filas.length > 0;

  return (
    <>
      <div
        className={[
          "surge rounded-[15px] border border-borde bg-superficie shadow-[var(--sombra)]",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-borde px-5 py-4">
          <ListadoBuscador
            ruta={ruta}
            estado={estado}
            etiqueta={etiquetaBusqueda}
            marcador={marcadorBusqueda}
          />

          {accion && (
            <BotonEnlace href={accion.href} tamano="chico" className="ml-auto">
              {accion.icono}
              {accion.texto}
            </BotonEnlace>
          )}
        </div>

        <ListadoFiltros ruta={ruta} estado={estado} filtros={filtros} />

        {rejilla && hayFilas && <ListadoOrden ruta={ruta} estado={estado} columnas={columnas} />}

        {hayFilas && rejilla ? (
          <ul aria-label={titulo} className="grid grid-cols-[minmax(0,1fr)] gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
            {filas.map((fila, indice) => (
              <li key={claveFila ? claveFila(fila) : indice} className="min-w-0">
                {rejilla(fila)}
              </li>
            ))}
          </ul>
        ) : hayFilas ? (
          <ListadoTabla
            ruta={ruta}
            estado={estado}
            columnas={columnas}
            filas={filas}
            claveFila={claveFila}
            titulo={titulo}
          />
        ) : filtrado ? (
          <ListadoVacio filtrado hrefLimpiar={sinFiltros(ruta, { ...estado, busqueda: "" })} />
        ) : (
          (vacio ?? <ListadoVacio />)
        )}

        {/*
          La paginacion sigue estando aunque esta pagina concreta haya salido
          vacia: es la unica forma de volver desde un "?pagina=99" escrito a
          mano sin tener que tocar la URL.
        */}
        {total > 0 && (
          <ListadoPaginacion
            ruta={ruta}
            estado={estado}
            total={total}
            totalPaginas={totalPaginas}
            mostradas={filas.length}
          />
        )}
      </div>

      {panel}
    </>
  );
}
