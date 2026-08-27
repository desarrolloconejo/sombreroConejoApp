import Link from "next/link";
import { Inbox, SearchX } from "lucide-react";
import type { ReactNode } from "react";

/**
 * El hueco cuando no hay filas.
 *
 * Distingue los dos casos, porque piden cosas distintas: si todavia no existe
 * ningun registro, lo que hace falta es crear el primero; si hay criterios
 * puestos, lo que hace falta es quitarlos.
 */
export function ListadoVacio({
  filtrado = false,
  titulo,
  descripcion,
  icono,
  hrefLimpiar,
  accion,
}: {
  filtrado?: boolean;
  titulo?: string;
  descripcion?: string;
  icono?: ReactNode;
  hrefLimpiar?: string;
  accion?: ReactNode;
}) {
  const Icono = filtrado ? SearchX : Inbox;

  const tituloFinal =
    titulo ?? (filtrado ? "Sin resultados" : "Todavia no hay registros");

  const descripcionFinal =
    descripcion ??
    (filtrado
      ? "Nada coincide con lo que buscas. Prueba con otras palabras o quita los filtros."
      : "Cuando se cree el primero aparecera en esta lista.");

  return (
    <div className="surge flex flex-col items-center px-6 py-14 text-center">
      <div
        aria-hidden="true"
        className="grid size-14 place-items-center rounded-full bg-campo text-suave [&>svg]:size-6"
      >
        {icono ?? <Icono />}
      </div>

      <p className="mt-4 text-[15px] font-semibold">{tituloFinal}</p>

      <p className="mt-2 max-w-[42ch] text-[12.5px] leading-relaxed text-suave">
        {descripcionFinal}
      </p>

      {filtrado && hrefLimpiar && (
        <Link
          href={hrefLimpiar}
          className={[
            "mt-5 inline-flex min-h-10 items-center rounded-full border-[1.5px] border-borde",
            "px-[15px] text-[12.5px] font-semibold text-suave",
            "  ",
            "suave hover:border-acento hover:text-texto",
          ].join(" ")}
        >
          Quitar la busqueda y los filtros
        </Link>
      )}

      {!filtrado && accion && <div className="mt-5">{accion}</div>}
    </div>
  );
}
