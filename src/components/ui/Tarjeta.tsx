import type { ReactNode } from "react";

/**
 * Una tarjeta con su titulo DENTRO: la cabecera (titulo y, a la derecha, algo
 * breve como una etiqueta) y el contenido debajo.
 *
 * Con el titulo dentro, dos columnas de tarjetas arrancan a la misma altura y
 * se leen igual. Con el titulo suelto encima, cada columna empezaba a una
 * altura distinta segun llevara titulo o no.
 */

export const CLASE_TARJETA =
  "rounded-[15px] border border-borde bg-superficie p-5 shadow-[var(--sombra)] sm:p-6";

/** El pie de una tarjeta: sus botones a la derecha, separados por una raya. */
export const PIE_TARJETA = "mt-5 flex flex-wrap justify-end gap-2.5 border-t border-borde pt-4";

export function Tarjeta({
  id,
  titulo,
  extra,
  className,
  children,
}: {
  /** Para enlazar el titulo con la seccion. */
  id: string;
  titulo: string;
  extra?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={[CLASE_TARJETA, className].filter(Boolean).join(" ")}>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 id={id} className="text-[15.5px] font-bold tracking-[-0.01em]">
          {titulo}
        </h2>
        {extra}
      </header>
      {children}
    </section>
  );
}
