import type { ComponentProps, ReactNode } from "react";

/**
 * Campo de formulario: etiqueta, control, ayuda y error, en una sola pieza.
 *
 * El error se anuncia con role="alert" y el control queda enlazado a el con
 * aria-describedby, para que un lector de pantalla lo lea al enfocar y no
 * haya que verlo para enterarse.
 */

const CONTROL =
  "w-full min-h-11 rounded-xl border-[1.5px] border-borde bg-campo px-3.5 py-3 " +
  "text-[13.5px] text-texto placeholder:text-suave " +

  "focus:outline-none focus:border-acento focus:bg-superficie focus:shadow-[var(--foco)] " +
  "" +
  "disabled:opacity-60 disabled:cursor-not-allowed " +
  "aria-[invalid=true]:border-blackberry aria-[invalid=true]:shadow-[0_0_0_3px_rgb(96_34_73_/_0.14)]";

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

/** Igual que Campo pero con un desplegable. */
export function CampoSelect({
  id,
  etiqueta,
  error,
  ayuda,
  className,
  children,
  ...resto
}: {
  id: string;
  etiqueta: string;
  error?: string;
  ayuda?: string;
  className?: string;
  children: ReactNode;
} & Omit<ComponentProps<"select">, "id" | "className" | "children">) {
  const idError = `${id}-error`;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-xs font-semibold">
        {etiqueta}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? idError : undefined}
        className={`${CONTROL} cursor-pointer appearance-none pr-10`}
        {...resto}
      >
        {children}
      </select>
      {ayuda && !error && (
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-suave">{ayuda}</p>
      )}
      {error && (
        <p
          id={idError}
          role="alert"
          className="mt-1.5 text-[11.5px] font-medium text-blackberry dark-tema:text-[#e9a9cd]"
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
