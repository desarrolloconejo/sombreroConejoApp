import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Bateria, Etiqueta, segmentosDeProyecto } from "@/components/ui";
import { SERVICIOS } from "@/lib/portal/catalogo";
import { rutaProyecto } from "@/lib/portal/rutas";
import {
  NOMBRES_DE_ESTADO_PROYECTO,
  type Columna,
  type DefinicionFiltro,
  type NombreEmpresa,
  type Proyecto,
} from "@/types";
import { EtiquetaAlerta, ORDEN_DE_ALERTAS } from "./EtiquetaAlerta";

/**
 * Las columnas del listado de proyectos. El listado se pinta en rejilla con
 * TarjetaProyecto; de aqui salen el orden (las columnas `ordenable`) y la
 * tabla si alguna vez se pidiera sin rejilla.
 */

const ANCHOS = {
  proyecto: "2fr",
  ejecutivo: "1.1fr",
  // Fija: la bateria y el porcentaje no encogen.
  avance: "176px",
  cierre: "84px",
  alertas: "1.6fr",
  acciones: "56px",
} as const;

const FECHA = new Intl.DateTimeFormat("es-VE", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** Una fecha AAAA-MM-DD, corta. Sin zona: la fecha ya es del dia que dice. */
export function fechaCorta(fecha: string | null): string {
  return fecha ? FECHA.format(new Date(`${fecha}T00:00:00Z`)) : "Sin fecha";
}

/** El nombre del servicio del catalogo, o su slug si ya no esta. */
export function nombreDeServicio(slug: string): string {
  return SERVICIOS.find((servicio) => servicio.slug === slug)?.titulo ?? slug;
}

export function columnasProyectos(): Columna<Proyecto>[] {
  return [
    {
      clave: "nombre",
      titulo: "Cliente · Proyecto",
      ordenable: true,
      ancho: ANCHOS.proyecto,
      tarjeta: "titulo",
      render: (proyecto) => (
        <div className="min-w-0">
          <p className="flex items-center gap-2">
            <span className="truncate text-[13.5px] font-semibold">{proyecto.empresaNombre}</span>
            {proyecto.estado !== "activo" && <Etiqueta>{NOMBRES_DE_ESTADO_PROYECTO[proyecto.estado]}</Etiqueta>}
          </p>
          <p className="truncate text-[12px] text-suave">
            {proyecto.nombre} · {nombreDeServicio(proyecto.servicio)}
          </p>
        </div>
      ),
    },

    {
      clave: "ejecutivo",
      titulo: "Ejecutivo",
      ancho: ANCHOS.ejecutivo,
      render: (proyecto) => (
        <span className="truncate text-[12.5px]">{proyecto.ejecutivoNombre}</span>
      ),
    },

    {
      clave: "avance",
      titulo: "Bateria",
      ancho: ANCHOS.avance,
      render: (proyecto) => (
        <div className="flex items-center gap-2.5">
          <Bateria
            segmentos={segmentosDeProyecto(proyecto.avance.porcentaje)}
            porcentaje={proyecto.avance.porcentaje}
            etiqueta={`Avance de ${proyecto.nombre}`}
            tamano="chico"
          />
          <span className="text-[12.5px] font-bold tabular-nums">
            {Math.round(proyecto.avance.porcentaje)}%
          </span>
        </div>
      ),
    },

    {
      clave: "cierre",
      titulo: "Cierre",
      ordenable: true,
      ancho: ANCHOS.cierre,
      render: (proyecto) => (
        <span className="text-[12.5px] tabular-nums">
          {fechaCorta(proyecto.fechaEstimadaCierre)}
        </span>
      ),
    },

    {
      clave: "alertas",
      titulo: "Alertas",
      ancho: ANCHOS.alertas,
      render: (proyecto) => {
        const presentes = ORDEN_DE_ALERTAS.filter((alerta) => proyecto.alertas[alerta] > 0);

        return presentes.length === 0 ? (
          <span className="text-[12px] text-suave">Al dia</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {presentes.map((alerta) => (
              <EtiquetaAlerta
                key={alerta}
                alerta={alerta}
                cantidad={proyecto.alertas[alerta]}
              />
            ))}
          </div>
        );
      },
    },

    {
      clave: "acciones",
      titulo: "Abrir",
      ancho: ANCHOS.acciones,
      alineacion: "derecha",
      tarjeta: "acciones",
      render: (proyecto) => (
        <Link
          href={rutaProyecto(proyecto.id)}
          aria-label={`Abrir el proyecto ${proyecto.nombre} de ${proyecto.empresaNombre}`}
          title="Abrir el proyecto"
          className={[
            "suave ml-auto grid size-9 shrink-0 place-items-center rounded-[10px]",
            "border border-transparent text-suave",
            "hover:border-acento hover:bg-acento hover:text-acento-contraste",
            "[&>svg]:size-[16px]",
          ].join(" ")}
        >
          <ArrowRight aria-hidden="true" />
        </Link>
      ),
    },
  ];
}

/** Los filtros del listado. El «Todos» lo antepone ListadoFiltros. */
export function filtrosProyectos(empresas: NombreEmpresa[]): DefinicionFiltro[] {
  const filtros: DefinicionFiltro[] = [
    {
      clave: "estado",
      titulo: "Estado",
      opciones: Object.entries(NOMBRES_DE_ESTADO_PROYECTO).map(([valor, texto]) => ({
        valor,
        texto,
      })),
    },
    {
      clave: "tipo",
      titulo: "Tipo",
      opciones: [
        { valor: "redes_sociales", texto: "Redes sociales" },
        { valor: "especial", texto: "Otros proyectos" },
      ],
    },
  ];

  if (empresas.length > 1) {
    filtros.push({
      clave: "empresa",
      titulo: "Empresa",
      opciones: empresas.map((empresa) => ({
        valor: String(empresa.id),
        texto: empresa.nombre,
      })),
    });
  }

  return filtros;
}
