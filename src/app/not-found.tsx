import type { Metadata } from "next";
import { Compass, MoveLeft } from "lucide-react";

import { BotonEnlace } from "@/components/ui";

export const metadata: Metadata = {
  title: "Pagina no encontrada",
};

/**
 * El 404 de toda la aplicacion.
 *
 * Vive en la raiz para que cubra tanto las rutas publicas como las del panel,
 * y por eso ofrece las dos salidas: el panel para quien ya entro y el acceso
 * para quien no. Quien no tenga sesion y pulse "Volver al panel" acabara igual
 * en el login, porque el proxy lo desvia antes de llegar.
 */
export default function NoEncontrada() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-14 lg:px-8">
      <section className="surge w-full max-w-[540px] rounded-[18px] border border-borde bg-superficie p-6 text-center shadow-[var(--sombra)] sm:p-10">
        <span
          aria-hidden="true"
          className="mx-auto grid size-14 place-items-center rounded-full bg-acento text-acento-contraste [&>svg]:size-6"
        >
          <Compass />
        </span>

        <p className="mt-5 text-[13px] font-bold text-acento">
          Error 404
        </p>

        <h1 className="mt-1.5 text-[27px] leading-[1.08] font-extrabold tracking-[-0.03em] text-balance sm:text-4xl">
          Esta pagina no existe
        </h1>

        <p className="mx-auto mt-3 max-w-[46ch] text-[13.5px] leading-[1.6] text-pretty text-suave">
          La direccion que abriste no corresponde a ninguna seccion de la
          plataforma. Puede que el enlace este mal escrito o que la seccion se
          haya movido de sitio.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          <BotonEnlace href="/dashboard" scroll>
            <MoveLeft aria-hidden="true" />
            Volver al panel
          </BotonEnlace>

          <BotonEnlace href="/login" variante="fantasma" scroll>
            Ir al acceso
          </BotonEnlace>
        </div>
      </section>
    </main>
  );
}
