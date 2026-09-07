import Link from "next/link";
import { Eye, Pencil, Power, PowerOff } from "lucide-react";

import { Estado } from "@/components/ui";
import { conPanel } from "@/lib/urlListado";
import type {
  Columna,
  DefinicionFiltro,
  EstadoListado,
  ResumenEmpresa,
} from "@/types";

/**
 * Las columnas del listado de empresas.
 *
 * Mismo contrato que las de usuarios: el modulo no dibuja su tabla, solo
 * declara que va en cada celda y deja que el listado estandar la monte. Por eso
 * es una funcion que devuelve datos y no un componente.
 */

const ANCHOS = {
  empresa: "2.4fr",
  sector: "1.2fr",
  contacto: "1.4fr",
  actividad: "1fr",
  estado: "0.9fr",
  // Tres botones de 36 px con sus separaciones. Fija y no fraccion: las
  // acciones no deben encoger cuando un nombre es largo.
  acciones: "128px",
} as const;

/** La misma rejilla que arma ListadoTabla. La usa el esqueleto de carga. */
export const REJILLA_EMPRESAS = Object.values(ANCHOS)
  .map((ancho) => (ancho.endsWith("fr") ? `minmax(0, ${ancho})` : ancho))
  .join(" ");

/**
 * Un boton de accion de la fila.
 *
 * Son enlaces, no botones: abren un panel, y eso aqui significa cambiar un
 * parametro de la URL. Asi se puede compartir el enlace de «editar a Fulana» y
 * el boton atras cierra lo que se abrio.
 */
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

/** Las iniciales del nombre, para el cuadro de la primera columna. */
function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((palabra) => palabra[0]?.toUpperCase() ?? "")
    .join("");
}

export function columnasEmpresas(
  ruta: string,
  estado: EstadoListado,
): Columna<ResumenEmpresa>[] {
  return [
    {
      clave: "empresa",
      titulo: "Empresa",
      ordenable: true,
      ancho: ANCHOS.empresa,
      tarjeta: "titulo",
      render: (empresa) => (
        <div className="flex min-w-0 items-center gap-3">
          {/*
            Un cuadro con iniciales en lugar de un logo. La columna `logo_url`
            existe, pero la subida de archivos esta apagada mientras la app
            viva en Vercel: pintar un hueco de imagen que nunca se llena seria
            prometer algo que no hay.
          */}
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-acento-tenue text-[12.5px] font-extrabold text-acento"
          >
            {iniciales(empresa.nombre)}
          </span>

          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-semibold">{empresa.nombre}</p>
            <p className="truncate text-[11.5px] text-suave">
              {empresa.rif ?? "Sin RIF"}
            </p>
          </div>
        </div>
      ),
    },

    {
      clave: "sector",
      titulo: "Sector",
      ancho: ANCHOS.sector,
      render: (empresa) =>
        empresa.sector ? (
          <span className="block truncate text-[12.5px]">{empresa.sector}</span>
        ) : (
          /*
            Sin sector NO es un detalle cosmetico, y por eso no se deja el
            hueco en blanco: el auditor resuelve la regla de una cuenta
            buscando primero la suya, luego la de su sector y luego el estandar
            de la casa. Sin sector, ese escalon del medio no existe.
          */
          <span className="text-[12px] text-suave italic">Sin sector</span>
        ),
    },

    {
      clave: "contacto",
      titulo: "Contacto",
      ancho: ANCHOS.contacto,
      render: (empresa) => (
        <div className="min-w-0">
          <p className="truncate text-[12.5px]">
            {empresa.telefono ?? <span className="text-suave">Sin telefono</span>}
          </p>
          <p className="truncate text-[11.5px] text-suave">
            {empresa.contactos === 0
              ? "Sin personas de contacto"
              : `${empresa.contactos} ${empresa.contactos === 1 ? "persona" : "personas"}`}
          </p>
        </div>
      ),
    },

    {
      clave: "actividad",
      titulo: "Piezas",
      ancho: ANCHOS.actividad,
      alineacion: "derecha",
      render: (empresa) => (
        <div className="text-right">
          <p className="text-[15px] font-extrabold tracking-[-0.02em]">
            {empresa.piezas}
          </p>
          <p className="text-[11.5px] text-suave">
            {empresa.piezas === 1 ? "hook" : "hooks"}
          </p>
        </div>
      ),
    },

    {
      clave: "estado",
      titulo: "Estado",
      ancho: ANCHOS.estado,
      render: (empresa) => (
        <Estado activo={empresa.activo} />
      ),
    },

    {
      clave: "acciones",
      titulo: "Acciones",
      ancho: ANCHOS.acciones,
      alineacion: "derecha",
      tarjeta: "acciones",
      render: (empresa) => (
        <div className="flex items-center justify-end gap-1">
          <AccionFila
            href={conPanel(ruta, estado, "ver", empresa.id)}
            etiqueta={`Ver la ficha de ${empresa.nombre}`}
          >
            <Eye aria-hidden="true" />
          </AccionFila>

          <AccionFila
            href={conPanel(ruta, estado, "editar", empresa.id)}
            etiqueta={`Editar ${empresa.nombre}`}
          >
            <Pencil aria-hidden="true" />
          </AccionFila>

          {/*
            No hay boton de borrar, y no es un olvido: `clientes` y
            `fichas_hook` referencian a empresas con ON DELETE RESTRICT, asi
            que una cuenta con personas o con piezas no se puede borrar sin
            perder su historia. Se desactiva, igual que un usuario.
          */}
          <AccionFila
            href={conPanel(ruta, estado, "estado", empresa.id)}
            etiqueta={
              empresa.activo
                ? `Desactivar ${empresa.nombre}`
                : `Reactivar ${empresa.nombre}`
            }
            tono={empresa.activo ? "aviso" : "normal"}
          >
            {empresa.activo ? (
              <PowerOff aria-hidden="true" />
            ) : (
              <Power aria-hidden="true" />
            )}
          </AccionFila>
        </div>
      ),
    },
  ];
}

/**
 * Los filtros del listado. El «Todos» lo antepone ListadoFiltros.
 *
 * Los sectores llegan de la base y no de una lista escrita aqui: al contrario
 * que los cargos de un usuario, que son un conjunto cerrado del esquema, el
 * sector es texto libre. Si no hay ninguno el grupo no se pinta, en lugar de
 * ofrecer un desplegable vacio.
 */
export function filtrosEmpresas(sectores: string[]): DefinicionFiltro[] {
  const grupos: DefinicionFiltro[] = [];

  if (sectores.length > 0) {
    grupos.push({
      clave: "sector",
      titulo: "Sector",
      opciones: sectores.map((sector) => ({ valor: sector, texto: sector })),
    });
  }

  grupos.push({
    clave: "activo",
    titulo: "Estado de la cuenta",
    opciones: [
      { valor: "true", texto: "Activas" },
      { valor: "false", texto: "Desactivadas" },
    ],
  });

  return grupos;
}
