import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";

/**
 * Un bloque del inicio: lo que le toca a quien entra en un modulo, con su
 * cifra, los primeros pendientes y el enlace al modulo entero.
 *
 * El inicio no repite modulos: cada bloque es una pregunta («¿que tengo
 * por decidir?») con su respuesta corta, y lleva a donde se resuelve. Su
 * titulo es un <h2>, asi que tambien sale en el indice de la pagina.
 */

export type ElementoInicio = {
  clave: string | number;
  href: string;
  titulo: string;
  detalle?: string | null;
  /** Lo resaltado a la derecha (una fecha, un importe). */
  marca?: string | null;
  /** Pide atencion: atrasado, vencido. */
  alerta?: boolean;
};

export function BloqueInicio({
  titulo,
  cifra,
  nota,
  elementos = [],
  vacio,
  enlace,
}: {
  titulo: string;
  /** La cifra grande. Sin ella, el bloque es solo su lista. */
  cifra?: string | number;
  /** La linea bajo la cifra. */
  nota?: string;
  elementos?: ElementoInicio[];
  /** Lo que se dice si no hay nada. */
  vacio: string;
  enlace: { href: string; texto: string };
}) {
  const id = `bloque-${titulo.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <section
      aria-labelledby={id}
      className="flex h-full flex-col rounded-[15px] border border-borde bg-superficie p-5 shadow-[var(--sombra)]"
    >
      <h2 id={id} className="text-[15.5px] font-bold tracking-[-0.01em]">
        {titulo}
      </h2>

      {cifra !== undefined && (
        <p className="mt-2 text-[28px] leading-none font-extrabold tracking-[-0.02em] tabular-nums">{cifra}</p>
      )}
      {nota && <p className="mt-1.5 text-[12px] leading-relaxed text-suave">{nota}</p>}

      <div className="mt-3 flex-1">
        {elementos.length === 0 ? (
          <p className="text-[12.5px] text-suave">{vacio}</p>
        ) : (
          <ul className="-mx-2 flex flex-col">
            {elementos.map((elemento) => (
              <li key={elemento.clave}>
                <Link
                  href={elemento.href}
                  className="suave group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-acento-tenue"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{elemento.titulo}</span>
                    {elemento.detalle && (
                      <span className="block truncate text-[11.5px] text-suave">{elemento.detalle}</span>
                    )}
                  </span>
                  {elemento.marca && (
                    <span
                      className={[
                        "shrink-0 text-[11.5px] font-semibold tabular-nums",
                        elemento.alerta ? "text-blackberry dark-tema:text-acento" : "text-suave",
                      ].join(" ")}
                    >
                      {elemento.marca}
                    </span>
                  )}
                  <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-suave" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link
        href={enlace.href}
        className="suave group mt-3 inline-flex items-center gap-1.5 self-start text-[12.5px] font-semibold text-acento hover:underline"
      >
        {enlace.texto}
        <ArrowRight aria-hidden="true" className="suave size-3.5 group-hover:translate-x-0.5" />
      </Link>
    </section>
  );
}
