import Link from "next/link";
import { Check, FilterX } from "lucide-react";

import type { DefinicionFiltro, EstadoListado, OpcionFiltro } from "@/types";
import { alternarFiltro, sinFiltros } from "@/lib/urlListado";

import { FiltroDesplegable } from "./FiltroDesplegable";

/**
 * Los filtros del listado.
 *
 * Cada opcion sigue siendo un <Link> que cambia un parametro de la URL, asi
 * que el filtrado funciona sin JavaScript y se puede compartir el enlace. Lo
 * unico de cliente es abrir y cerrar el grupo.
 *
 * Se pueden elegir VARIOS valores del mismo grupo. Cada opcion alterna: si ya
 * estaba puesta, el mismo enlace la quita, asi que no hace falta una "x" en
 * cada una. Por eso "Todos" no es una opcion mas sino el atajo para dejar el
 * grupo entero sin filtrar.
 *
 * La opcion de quitar el filtro la pone SIEMPRE este componente, y siempre se
 * llama "Todos". Antes la declaraba cada modulo y salieron cuatro nombres
 * distintos para la misma cosa ("Cualquier rol", "Activos y desactivados"...):
 * quien filtra no lee cuatro etiquetas, busca la de siempre en el primer
 * sitio. Un modulo puede seguir declarando su propia opcion de valor vacio si
 * de verdad necesita otro texto, y entonces no se anade nada.
 */

/** Antepone el "Todos" del grupo, salvo que el modulo ya traiga el suyo. */
function conOpcionTodos(opciones: OpcionFiltro[]): OpcionFiltro[] {
  if (opciones.some((opcion) => opcion.valor === "")) return opciones;

  return [{ valor: "", texto: "Todos" }, ...opciones];
}

const OPCION =
  "flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-[13px] " +
  "  ";

export function ListadoFiltros({
  ruta,
  estado,
  filtros,
  fijos = [],
}: {
  ruta: string;
  estado: EstadoListado;
  filtros: DefinicionFiltro[];
  /** Claves de filtro que «Limpiar filtros» conserva (la pestana de una bandeja). */
  fijos?: readonly string[];
}) {
  if (filtros.length === 0) return null;

  /*
   * SOLO CUENTA LO QUE EL GRUPO SABE PINTAR.
   *
   * La URL es texto y cualquiera puede escribir "?empresa=999". Las pages ya
   * descartan esos valores antes de consultar, asi que la lista sale sin
   * filtrar; el chip, en cambio, leia el parametro en crudo y acababa
   * anunciando "999" sobre una tabla completa. Descartarlos aqui tambien deja
   * las dos cosas contando la misma historia.
   */
  const elegidosDe = (filtro: DefinicionFiltro): string[] =>
    (estado.filtros[filtro.clave] ?? []).filter((valor) =>
      filtro.opciones.some((opcion) => opcion.valor === valor),
    );

  const hayAlguno = filtros.some((filtro) => elegidosDe(filtro).length > 0);

  return (
    // En movil se apilan, uno por fila; desde sm vuelven a compartirla
    <div className="flex flex-col gap-2 border-b border-borde px-5 py-3 sm:flex-row sm:flex-wrap sm:items-center">
      {filtros.map((filtro) => {
        const elegidos = elegidosDe(filtro);
        const opciones = conOpcionTodos(filtro.opciones);

        /*
         * Con un valor se muestra su nombre; con varios, cuantos hay.
         *
         * Listar los nombres separados por comas parece mas informativo y no
         * lo es: el boton tiene ancho acotado, asi que con tres nombres se
         * recorta a mitad de la segunda palabra y deja de decir nada.
         */
        const nombreDe = (valor: string): string =>
          opciones.find((o) => o.valor === valor)?.texto ?? valor;

        const resumen =
          elegidos.length === 0
            ? nombreDe("")
            : elegidos.length === 1
              ? nombreDe(elegidos[0])
              : `${elegidos.length} seleccionados`;

        return (
          <FiltroDesplegable
            key={filtro.clave}
            titulo={filtro.titulo}
            resumen={resumen}
            activo={elegidos.length > 0}
          >
            <ul className="flex flex-col gap-0.5">
              {opciones.map((opcion) => {
                // "Todos" se enciende cuando no hay ninguno elegido, que es
                // justo lo que significa: el grupo sin filtrar.
                const activa =
                  opcion.valor === ""
                    ? elegidos.length === 0
                    : elegidos.includes(opcion.valor);

                return (
                  <li key={opcion.valor || "todos"}>
                    <Link
                      href={alternarFiltro(ruta, estado, filtro.clave, opcion.valor || null)}
                      scroll={false}
                      aria-current={activa ? "true" : undefined}
                      className={[
                        OPCION,
                        activa
                          ? "bg-acento font-semibold text-acento-contraste"
                          : "suave text-texto hover:bg-acento-tenue",
                      ].join(" ")}
                    >
                      <span className="min-w-0 flex-1 truncate">{opcion.texto}</span>
                      {activa && (
                        <Check aria-hidden="true" className="size-4 shrink-0" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </FiltroDesplegable>
        );
      })}

      {/* Solo aparece cuando hay algo que limpiar: un boton que nunca hace
          nada es ruido permanente. */}
      {hayAlguno && (
        <Link
          href={sinFiltros(ruta, estado, fijos)}
          scroll={false}
          className={[
            // En columna no hay margen automatico que empuje: se centra, y
            // desde sm se va al extremo derecho de la fila.
            "suave inline-flex min-h-10 items-center justify-center gap-2 rounded-[10px] px-3",
            "text-[12.5px] font-semibold text-suave",
            "sm:ml-auto",
            "hover:bg-acento-tenue hover:text-acento",
          ].join(" ")}
        >
          <FilterX aria-hidden="true" className="size-4 shrink-0" />
          Limpiar filtros
        </Link>
      )}
    </div>
  );
}
