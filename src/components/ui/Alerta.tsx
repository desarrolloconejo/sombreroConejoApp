import type { ReactNode } from "react";

/**
 * Mensaje destacado dentro de un formulario o una pagina.
 *
 * Lleva role="alert" para que un lector de pantalla lo anuncie en cuanto
 * aparece: es la unica forma de que quien no lo ve se entere de que su intento
 * de entrar fallo.
 */

const TONOS = {
  aviso: {
    caja: "bg-blackberry/[0.07] border-blackberry/25 border-l-blackberry dark-tema:bg-gold/[0.08] dark-tema:border-acento/30 dark-tema:border-l-gold",
    icono: "text-blackberry dark-tema:text-acento",
  },
  info: {
    caja: "bg-navy/[0.05] border-navy/15 border-l-navy dark-tema:bg-white/[0.05] dark-tema:border-white/15 dark-tema:border-l-gold",
    icono: "text-navy dark-tema:text-acento",
  },
} as const;

export function Alerta({
  tono = "aviso",
  icono,
  children,
  className,
}: {
  tono?: keyof typeof TONOS;
  icono?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const estilo = TONOS[tono];

  return (
    <div
      role="alert"
      className={[
        "flex items-start gap-2.5 rounded-xl border border-l-[3px] px-3.5 py-3",
        estilo.caja,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icono && (
        <span
          aria-hidden="true"
          className={`mt-px shrink-0 [&>svg]:size-[17px] ${estilo.icono}`}
        >
          {icono}
        </span>
      )}
      <p className="m-0 text-[13px] leading-relaxed">{children}</p>
    </div>
  );
}
