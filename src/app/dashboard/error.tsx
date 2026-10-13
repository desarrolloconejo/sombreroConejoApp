"use client";

import { useEffect } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";

import { Boton, BotonEnlace } from "@/components/ui";

/**
 * La barrera de error del panel.
 *
 * Al colgar de /dashboard sustituye solo el contenido: la barra lateral, la
 * cabecera y el buscador siguen en pie, asi que quien se topa con el fallo no
 * se queda encerrado y puede irse a otro modulo sin recargar.
 *
 * No cubre los fallos del layout de /dashboard, que ocurren por encima de
 * ella; de esos se encarga la barrera de la raiz.
 *
 * Igual que alli, el error crudo va a la consola y en pantalla queda un texto
 * general con el `digest`: el mensaje real puede delatar como funciona el
 * servidor por dentro.
 */
export default function ErrorPanel({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Fallo no controlado en el panel:", error);
  }, [error]);

  return (
    <section className="surge flex min-h-[420px] items-center justify-center rounded-[15px] border border-borde bg-superficie px-5 py-12 text-center shadow-[var(--sombra)] sm:px-8">
      <div className="w-full max-w-[46ch]">
        <span
          aria-hidden="true"
          className="mx-auto grid size-14 place-items-center rounded-full bg-acento text-acento-contraste [&>svg]:size-6"
        >
          <TriangleAlert />
        </span>

        <p className="mt-5 text-[13px] font-bold text-acento">
          Algo se rompio
        </p>

        <h1 className="mt-1.5 text-[26px] leading-[1.1] font-extrabold tracking-[-0.03em] text-balance lg:text-[32px]">
          No pudimos cargar esta seccion
        </h1>

        <p className="mt-3 text-[13.5px] leading-[1.6] text-pretty text-suave">
          El fallo es nuestro y ya quedo registrado. Puedes reintentarlo aqui
          mismo o seguir trabajando en otro modulo desde el menu.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          <Boton type="button" onClick={() => retry()}>
            <RotateCw aria-hidden="true" />
            Reintentar
          </Boton>

          <BotonEnlace href="/dashboard" variante="fantasma" scroll>
            Ir al inicio
          </BotonEnlace>
        </div>

        {error.digest && (
          <p className="mt-6 border-t border-borde pt-4 text-[11.5px] text-suave">
            Referencia del fallo:{" "}
            <span className="font-mono break-all">{error.digest}</span>
          </p>
        )}
      </div>
    </section>
  );
}
