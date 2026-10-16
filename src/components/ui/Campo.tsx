import type { ComponentProps, ReactNode } from "react";

/**
 * Campo de formulario: etiqueta, control, ayuda y error, en una sola pieza.
 *
 * El error se anuncia con role="alert" y el control queda enlazado a el con
 * aria-describedby, para que un lector de pantalla lo lea al enfocar y no
 * haya que verlo para enterarse.
 */

/**
 * El aspecto de un control, SIN medidas: borde, fondo, foco y error. Las
 * medidas van aparte para que nunca se pisen dos alturas en la misma clase:
 * "min-h-11 py-3" mas un "min-h-10 py-2" anadido despues daba un alto
 * distinto segun el orden de las reglas en la hoja de estilos.
 */
export const ASPECTO_CONTROL =
  "w-full rounded-xl border-[1.5px] border-borde bg-campo text-texto placeholder:text-suave " +
  "focus:outline-none focus:border-acento focus:bg-superficie focus:shadow-[var(--foco)] " +
  "disabled:opacity-60 disabled:cursor-not-allowed " +
  "aria-[invalid=true]:border-blackberry aria-[invalid=true]:shadow-[0_0_0_3px_rgb(96_34_73_/_0.14)]";

/**
 * Los dos altos de un control de una linea (texto, Selector, CampoFecha).
 * Son fijos, no minimos: en una fila, todos miden exactamente lo mismo.
 */
export const ALTO_CONTROL = {
  normal: "h-11 px-3.5 text-[13.5px]",
  compacto: "h-10 px-3 text-[13px]",
} as const;

export type TamanoControl = keyof typeof ALTO_CONTROL;

/** Un control de una linea con su alto: lo comparten Campo, Selector y CampoFecha. */
export function claseLinea(tamano: TamanoControl = "normal"): string {
  return `${ASPECTO_CONTROL} ${ALTO_CONTROL[tamano]}`;
}

/**
 * Para un area de texto: el aspecto, con su relleno. El alto minimo lo pone
 * quien la usa (min-h-[84px]).
 */
export const CLASE_CONTROL = `${ASPECTO_CONTROL} px-3.5 py-2.5 text-[13.5px]`;

const CONTROL = claseLinea("normal");

export function Campo({
  id,
  etiqueta,
  error,
  ayuda,
  opcional,
  icono,
  className,
  ...resto
}: {
  id: string;
  etiqueta: string;
  error?: string;
  ayuda?: string;
  opcional?: boolean;
  icono?: ReactNode;
  className?: string;
} & Omit<ComponentProps<"input">, "id" | "className">) {
  const idError = `${id}-error`;
  const idAyuda = `${id}-ayuda`;

  const descrito =
    [error ? idError : null, ayuda ? idAyuda : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-xs font-semibold">
        {etiqueta}
        {opcional && (
          <span className="ml-1.5 font-normal text-suave">(opcional)</span>
        )}
      </label>

      <div className="relative">
        {icono && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-suave [&>svg]:size-4"
          >
            {icono}
          </span>
        )}
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={descrito}
          className={[CONTROL, icono ? "pl-10" : null].filter(Boolean).join(" ")}
          {...resto}
        />
      </div>

      {ayuda && !error && (
        <p id={idAyuda} className="mt-1.5 text-[11.5px] leading-relaxed text-suave">
          {ayuda}
        </p>
      )}

      {error && (
        <p
          id={idError}
          role="alert"
          className="mt-1.5 text-[11.5px] font-medium leading-relaxed text-blackberry dark-tema:text-[#e9a9cd]"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/** Dato que se muestra pero no se puede editar aqui. */
export function CampoFijo({
  etiqueta,
  valor,
  ayuda,
  icono,
  className,
}: {
  etiqueta: string;
  valor: string;
  ayuda?: string;
  icono?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-2 text-xs font-semibold">{etiqueta}</p>
      <div className="flex min-h-11 items-center gap-2.5 rounded-xl border-[1.5px] border-dashed border-borde px-3.5 py-3 text-[13.5px] text-suave [&>svg]:size-4 [&>svg]:shrink-0">
        {icono}
        {valor}
      </div>
      {ayuda && (
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-suave">{ayuda}</p>
      )}
    </div>
  );
}
