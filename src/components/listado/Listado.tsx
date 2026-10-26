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

  /**
   * Como `rejilla`, pero en filas de lectura de arriba abajo, una debajo de
   * otra (la bandeja de briefs). El orden tambien pasa a su control propio.
   */
  lista?: (fila: T) => ReactNode;

  /**
   * El cuerpo entero lo pinta la page (una tabla de importes que no cabe en
   * la estandar, la de Cobranza). El listado pone igual el buscador, los
   * filtros, el orden, las paginas y los estados vacios.
   */
  cuerpo?: (filas: T[]) => ReactNode;

  /**
   * Filtros que forman parte de donde se esta, no del criterio de quien
   * busca (la pestana de una bandeja): «Limpiar filtros» no los quita.
   */
  fijos?: readonly string[];

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
  lista,
  cuerpo,
  fijos = [],
  className,
}: PropsListado<T>) {
  // Un filtro fijo (la pestana) no es un criterio: sin resultados en ella se
  // muestra su estado vacio, no «quita los filtros».
  const filtrado = hayCriterios({
    ...estado,
    filtros: Object.fromEntries(Object.entries(estado.filtros).filter(([clave]) => !fijos.includes(clave))),
  });
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

        {/* El titulo de la lista, para el indice de la pagina y los lectores de pantalla. */}
        {titulo && <h2 className="sr-only">{titulo}</h2>}

        <ListadoFiltros ruta={ruta} estado={estado} filtros={filtros} fijos={fijos} />

        {(rejilla || lista || cuerpo) && hayFilas && <ListadoOrden ruta={ruta} estado={estado} columnas={columnas} />}

        {hayFilas && cuerpo ? (
          cuerpo(filas)
        ) : hayFilas && lista ? (
          <ul aria-label={titulo} className="flex flex-col px-5 py-2">
            {filas.map((fila, indice) => (
              <li key={claveFila ? claveFila(fila) : indice} className="min-w-0 border-b border-borde last:border-0">
                {lista(fila)}
              </li>
            ))}
          </ul>
        ) : hayFilas && rejilla ? (
          <ul aria-label={titulo} className="grid grid-cols-[minmax(0,1fr)] gap-4 p-4 sm:grid-cols-2 sm:p-5 2xl:grid-cols-3">
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
          <ListadoVacio filtrado hrefLimpiar={sinFiltros(ruta, { ...estado, busqueda: "" }, fijos)} />
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
