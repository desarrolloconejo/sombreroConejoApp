"use client";

import { useEffect } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";

import { Boton, BotonEnlace } from "@/components/ui";

/**
 * La red de seguridad de la aplicacion.
 *
 * Una barrera de error TIENE que ser de cliente: React la monta en el
 * navegador para poder reemplazar el arbol que fallo sin recargar la pagina, y
 * `reset` vuelve a intentar el renderizado desde ahi.
 *
 * El mensaje real del error no se pinta nunca. Puede llevar dentro una
 * consulta, una ruta del servidor o el detalle de por que fallo la base, y eso
 * no le sirve a quien mira mientras que a un atacante si. Va a la consola, que
 * es donde lo busca quien programa, y en pantalla queda el `digest`, el
 * identificador con el que Next lo relaciona con el registro del servidor.
 */
export default function ErrorAplicacion({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Fallo no controlado en la aplicacion:", error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-14 lg:px-8">
      <section className="surge w-full max-w-[540px] rounded-[18px] border border-borde bg-superficie p-6 text-center shadow-[var(--sombra)] sm:p-10">
        <span
          aria-hidden="true"
          className="mx-auto grid size-14 place-items-center rounded-full bg-acento text-acento-contraste [&>svg]:size-6"
        >
          <TriangleAlert />
        </span>

        <p className="mt-5 text-[13px] font-bold text-acento">
          Algo se rompio
        </p>

        <h1 className="mt-1.5 text-[27px] leading-[1.08] font-extrabold tracking-[-0.03em] text-balance sm:text-4xl">
          No pudimos cargar esta pagina
        </h1>

        <p className="mx-auto mt-3 max-w-[46ch] text-[13.5px] leading-[1.6] text-pretty text-suave">
          El fallo es nuestro, no tuyo, y ya quedo registrado. Vuelve a
          intentarlo: si se repite, avisa al equipo de tecnologia con la
          referencia de abajo.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          <Boton type="button" onClick={reset}>
            <RotateCw aria-hidden="true" />
            Reintentar
          </Boton>

          <BotonEnlace href="/dashboard" variante="fantasma">
            Ir al panel
          </BotonEnlace>
        </div>

        {error.digest && (
          <p className="mt-6 border-t border-borde pt-4 text-[11.5px] text-suave">
            Referencia del fallo:{" "}
            <span className="font-mono break-all">{error.digest}</span>
          </p>
        )}
      </section>
    </main>
  );
}
