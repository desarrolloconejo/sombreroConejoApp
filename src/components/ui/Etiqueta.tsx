import type { ReactNode } from "react";

/**
 * Pastilla corta para un rol, un tipo o un estado.
 *
 * La variante solida usa dorado sobre navy, que es donde el dorado es legal.
 * La contorneada se queda en gris para no competir con ella.
 */

const VARIANTES = {
  solida: "bg-acento text-acento-contraste border-transparent",
  contorno: "bg-transparent text-suave border-borde",
} as const;

export function Etiqueta({
  variante = "contorno",
  children,
  className,
}: {
  variante?: keyof typeof VARIANTES;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1",
        "text-[10.5px] font-semibold uppercase tracking-[0.06em]",
        VARIANTES[variante],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}

/**
 * Indicador de activo o inactivo.
 * El punto es decorativo: el texto que lo acompana es el que informa.
 */
export function Estado({ activo }: { activo: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12.5px]">
      <i
        aria-hidden="true"
        className={[
          "size-[7px] shrink-0 rounded-full",
          activo ? "bg-blackberry dark-tema:bg-gold" : "bg-borde",
        ].join(" ")}
      />
      {activo ? "Activa" : "Desactivada"}
    </span>
  );
}
