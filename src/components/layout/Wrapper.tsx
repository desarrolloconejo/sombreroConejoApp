import type { ReactNode } from "react";
import { Breadcrumb, type Miga } from "./Breadcrumb";

/**
 * El envoltorio comun de toda page del dashboard: migas, cabecera y contenido.
 *
 * Es de servidor y no consulta nada: la page le inyecta el texto ya resuelto.
 * Asi el titulo de cada modulo se decide en un solo sitio, la page, y todas
 * las secciones entran con el mismo ritmo.
 *
 * La tipografia va invertida a proposito, que es la regla de la marca: la
 */
export function Wrapper({
  migas,
  kicker,
  titulo,
  descripcion,
  accion,
  children,
}: {
  migas: Miga[];
  kicker: string;
  titulo: string;
  descripcion?: string;

  /** El boton principal de la seccion, si lo hay. */
  accion?: ReactNode;

  children: ReactNode;
}) {
  return (
    <>
      <Breadcrumb
        migas={migas}
        className="surge mb-3 [--retraso:0.02s] lg:mb-[13px]"
      />

      <header className="surge mb-5 flex flex-col gap-4 border-b border-borde pb-[18px] [--retraso:0.06s] sm:flex-row sm:items-end sm:justify-between sm:gap-6 lg:mb-6 lg:pb-5">
        <div className="min-w-0">
          <p className="mb-[5px] text-[12.5px] font-bold text-acento lg:mb-1.5 lg:text-[13px]">
            {kicker}
          </p>

          <h1 className="text-[26px] leading-[1.1] font-extrabold tracking-[-0.028em] text-balance lg:text-4xl lg:leading-[1.05] lg:tracking-[-0.03em]">
            {titulo}
          </h1>

          {descripcion && (
            <p className="mt-2 max-w-[76ch] text-[12.5px] leading-[1.55] text-pretty text-suave lg:mt-[9px] lg:text-sm">
              {descripcion}
            </p>
          )}
        </div>

        {accion && <div className="shrink-0">{accion}</div>}
      </header>

      {children}
    </>
  );
}
