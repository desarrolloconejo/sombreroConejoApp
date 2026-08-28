import Link from "next/link";
import { BookmarkCheck, BookmarkPlus, Copy, Eye, History, Pencil, Trash2 } from "lucide-react";

import { Etiqueta } from "@/components/ui";
import { metricaDe, nombrePlataforma, objetivoDe, porcentajeDe } from "@/lib/hooks/catalogo";
import { conPanel } from "@/lib/urlListado";
import type { Columna, EstadoListado, FichaConResultado } from "@/types";

/**
 * Las columnas del historial de fichas.
 *
 * El modulo no dibuja su tabla: declara que se ve en cada celda y deja que el
 * listado estandar la monte, con su version en tarjetas para movil.
 */

const ANCHOS = {
  hook: "2.4fr",
  cliente: "1.1fr",
  estado: "1.1fr",
  resultado: "0.9fr",
  acciones: "244px",
} as const;

export const REJILLA_FICHAS = Object.values(ANCHOS)
  .map((ancho) => (ancho.endsWith("fr") ? `minmax(0, ${ancho})` : ancho))
  .join(" ");

/** Los tres hitos, y en cual se quedo la pieza. */
const ESTADOS = {
  borrador: { nombre: "Borrador", punto: "bg-suave", pie: "Sin auditar" },
  auditada: { nombre: "Auditada", punto: "bg-acento", pie: "Sin medir" },
  medida: { nombre: "Medida", punto: "bg-[#35603c] dark-tema:bg-[#8fd39b]", pie: "Terminada" },
} as const;

function AccionFila({
  href,
  etiqueta,
  children,
  tono = "normal",
}: {
  href: string;
  etiqueta: string;
  children: React.ReactNode;
  tono?: "normal" | "aviso";
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-label={etiqueta}
      title={etiqueta}
      className={[
        "suave grid size-9 shrink-0 place-items-center rounded-[10px]",
        "border border-transparent",
        tono === "aviso"
          ? "text-blackberry hover:border-blackberry hover:bg-blackberry hover:text-white dark-tema:text-[#e9a9cd]"
          : "text-suave hover:border-acento hover:bg-acento hover:text-acento-contraste",
        "[&>svg]:size-[16px]",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

export function columnasFichas(
  ruta: string,
  estado: EstadoListado,

  /**
   * Que fichas de esta pagina ya estan en el banco de referencias.
   *
   * Se recibe resuelto porque una columna no consulta: la page pregunta una
   * vez por el lote visible y aqui solo se decide si la fila ofrece guardar o
   * dice que ya esta guardada.
   */
  guardadas: Set<number> = new Set(),
): Columna<FichaConResultado>[] {
  return [
    {
      clave: "hook",
      titulo: "Hook",
      ancho: ANCHOS.hook,
      tarjeta: "titulo",
      render: (ficha) => (
        <div className="min-w-0">
          <p className="mb-1 line-clamp-2 text-[13.5px] leading-snug font-semibold">
            {ficha.hablado}
          </p>
          <p className="text-[11.5px] text-suave">
            {objetivoDe(ficha.objetivo).nombre} · {nombrePlataforma(ficha.plataforma)}
            {ficha.creadoPorNombre ? ` · ${ficha.creadoPorNombre}` : ""}
          </p>
        </div>
      ),
    },

    {
      clave: "empresa",
      titulo: "Cliente",
      ordenable: true,
      ancho: ANCHOS.cliente,
      render: (ficha) => (
        <span className="block truncate text-[12.5px]">{ficha.empresaNombre}</span>
      ),
    },

    {
      clave: "estado",
      titulo: "Estado",
      ancho: ANCHOS.estado,
      render: (ficha) => {
        const hito = ESTADOS[ficha.estado];
        const porcentaje = porcentajeDe(ficha.estado);

        return (
          <div>
            <span className="flex items-center gap-[7px] text-xs font-semibold">
              <span
                aria-hidden="true"
                className={["size-2 shrink-0 rounded-full", hito.punto].join(" ")}
              />
              {hito.nombre}
            </span>

            {/*
              Tres tramos, uno por hito. Es la misma escala que el porcentaje
              de la raiz: 33, 66 y 100. Se pinta aqui tambien para poder
              comparar dos fichas de un vistazo sin leer la etiqueta.
            */}
            <span
              aria-hidden="true"
              className="mt-1.5 flex gap-[3px]"
              title={`${porcentaje}% del recorrido`}
            >
              {[33, 66, 100].map((tramo) => (
                <i
                  key={tramo}
                  className={[
                    "h-[3px] w-[15px] rounded-full",
                    porcentaje >= tramo
                      ? tramo === 100
                        ? "bg-[#35603c] dark-tema:bg-[#8fd39b]"
                        : "bg-acento"
                      : "bg-borde",
                  ].join(" ")}
                />
              ))}
            </span>
          </div>
        );
      },
    },

    {
      clave: "resultado",
      titulo: "Resultado",
      ancho: ANCHOS.resultado,
      alineacion: "derecha",
      render: (ficha) => {
        if (ficha.hookRate !== null) {
          return (
            <div className="text-right">
              <p className="text-[15px] font-extrabold tracking-[-0.02em]">
                {ficha.hookRate.toFixed(1).replace(".", ",")}%
              </p>
              <p className="text-[11.5px] text-suave">hook rate</p>
            </div>
          );
        }

        return (
          <div className="text-right">
            <p className="text-[13px] font-semibold text-suave">
              {ESTADOS[ficha.estado].pie}
            </p>
            {ficha.notaAuditor !== null && (
              <p className="text-[11.5px] text-suave">nota {ficha.notaAuditor}</p>
            )}
          </div>
        );
      },
    },

    {
      clave: "acciones",
      titulo: "Acciones",
      ancho: ANCHOS.acciones,
      alineacion: "derecha",
      tarjeta: "acciones",
      render: (ficha) => {
        const corto =
          ficha.hablado.length > 42 ? `${ficha.hablado.slice(0, 42)}…` : ficha.hablado;

        return (
          <div className="flex items-center justify-end gap-1">
            <AccionFila
              href={conPanel(ruta, estado, "ver", ficha.id)}
              etiqueta={`Ver la ficha «${corto}»`}
            >
              <Eye aria-hidden="true" />
            </AccionFila>

            <AccionFila
              href={`/dashboard/hooks/nuevo?panel=editar&id=${ficha.id}`}
              etiqueta={`Editar «${corto}»`}
            >
              <Pencil aria-hidden="true" />
            </AccionFila>

            {/*
              Usar como plantilla NO toca esta ficha: abre el canvas con sus
              campos copiados y sin su id, asi que al guardar nace una pieza
              nueva. El cliente se deja en blanco a proposito.
            */}
            <AccionFila
              href={`/dashboard/hooks/nuevo?panel=plantilla&id=${ficha.id}`}
              etiqueta={`Usar «${corto}» como plantilla`}
            >
              <Copy aria-hidden="true" />
            </AccionFila>

            {/*
              El banco de referencias es para lo que merece repetirse, asi que
              esta fila ofrece dos cosas distintas segun el caso: guardarla, o
              decir que ya esta guardada. Ocultar la marca dejaria la duda de
              si el boton falto o si ya se hizo.
            */}
            {guardadas.has(ficha.id) ? (
              <span
                title="Ya esta en el banco de referencias"
                className="grid size-9 shrink-0 place-items-center rounded-[10px] text-acento [&>svg]:size-4"
              >
                <BookmarkCheck aria-label="Ya guardada como referencia" />
              </span>
            ) : (
              <AccionFila
                href={conPanel(ruta, estado, "referencia", ficha.id)}
                etiqueta={`Guardar «${corto}» como referencia`}
              >
                <BookmarkPlus aria-hidden="true" />
              </AccionFila>
            )}

            {/*
              Quien ha tocado la ficha. Aqui cualquiera edita la de cualquiera,
              asi que saber cuantas manos han pasado es parte de la fila.
            */}
            <AccionFila
              href={conPanel(ruta, estado, "cambios", ficha.id)}
              etiqueta={`Ver quien ha modificado «${corto}»`}
            >
              <History aria-hidden="true" />
            </AccionFila>

            <AccionFila
              href={conPanel(ruta, estado, "borrar", ficha.id)}
              etiqueta={`Borrar «${corto}»`}
              tono="aviso"
            >
              <Trash2 aria-hidden="true" />
            </AccionFila>
          </div>
        );
      },
    },
  ];
}

/** Los filtros del historial. El "Todos" lo antepone ListadoFiltros. */
export function filtrosFichas(
  empresas: { id: number; nombre: string }[],
) {
  return [
    {
      clave: "estado",
      titulo: "Estado",
      opciones: [
        { valor: "borrador", texto: "Borrador" },
        { valor: "auditada", texto: "Auditada" },
        { valor: "medida", texto: "Medida" },
      ],
    },
    {
      clave: "empresa",
      titulo: "Cliente",
      opciones: empresas.map((e) => ({ valor: String(e.id), texto: e.nombre })),
    },
    {
      clave: "objetivo",
      titulo: "Objetivo",
      opciones: (
        ["alcance", "guardados", "compartidos", "comunidad", "consideracion", "accion"] as const
      ).map((slug) => ({
        valor: slug,
        texto: `${objetivoDe(slug).nombre} · ${metricaDe(slug)}`,
      })),
    },
  ];
}

export { Etiqueta };
