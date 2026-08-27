import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * La ruta de migas de una page del dashboard.
 *
 * Es un componente de servidor: solo pinta lo que le inyectan, no necesita
 * saber en que ruta esta. Quien la usa es el Wrapper, que ya recibe las migas
 * de la page.
 */

export type Miga = {
  texto: string;

  /** Sin href la miga no es navegable. La ultima nunca lo es. */
  href?: string;
};

export function Breadcrumb({
  migas,
  className,
}: {
  migas: Miga[];
  className?: string;
}) {
  if (migas.length === 0) return null;

  return (
    <nav
      aria-label="Ruta"
      className={["text-[11.5px] text-suave lg:text-[12.5px]", className]
        .filter(Boolean)
        .join(" ")}
    >
      <ol className="flex flex-wrap items-center gap-x-[7px] gap-y-1">
        {migas.map((miga, indice) => {
          const ultima = indice === migas.length - 1;

          return (
            <li
              key={`${indice}-${miga.texto}`}
              className="flex items-center gap-x-[7px]"
            >
              {indice > 0 && (
                <ChevronRight
                  aria-hidden="true"
                  strokeWidth={2.5}
                  className="size-3 shrink-0 opacity-50 lg:size-[13px]"
                />
              )}

              {miga.href && !ultima ? (
                <Link
                  href={miga.href}
                  // El texto de la miga mide 17 px de alto, muy por debajo del
                  // objetivo tactil. Se estira con el pseudoelemento, igual que
                  // el boton de la camara: lo que responde al dedo llega a 45 px
                  // sin que la miga engorde ni se descoloque la fila.
                  className={
                    "suave relative text-suave hover:text-acento " +
                    "before:absolute before:-inset-x-1 before:-inset-y-[14px] before:content-['']"
                  }
                >
                  {miga.texto}
                </Link>
              ) : (
                <span
                  // aria-current marca donde esta la persona ahora mismo, que
                  // es la unica miga que no lleva a ningun sitio
                  aria-current={ultima ? "page" : undefined}
                  className={ultima ? "font-semibold text-texto" : undefined}
                >
                  {miga.texto}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
