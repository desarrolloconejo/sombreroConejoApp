import Link from "next/link";
import { Eye } from "lucide-react";

import { conPanel } from "@/lib/urlListado";
import {
  MODULOS_DE_AUDITORIA,
  NOMBRES_DE_ACCION,
  type AccionAuditoria,
  type Columna,
  type DefinicionFiltro,
  type EstadoListado,
  type LineaAuditoria,
} from "@/types";
import { ZONA_HORARIA } from "@/lib/fechas";

/**
 * Las columnas del listado de auditoria.
 *
 * Mismo contrato que las de usuarios y empresas: el modulo no dibuja su tabla,
 * declara que va en cada celda y deja que el listado estandar la monte.
 */

const ANCHOS = {
  creadoEn: "1.1fr",
  quien: "1.6fr",
  accion: "1.7fr",
  empresa: "1.3fr",
  acciones: "56px",
} as const;

/** La misma rejilla que arma ListadoTabla. La usa el esqueleto de carga. */
export const REJILLA_AUDITORIA = Object.values(ANCHOS)
  .map((ancho) => (ancho.endsWith("fr") ? `minmax(0, ${ancho})` : ancho))
  .join(" ");

const FECHA = new Intl.DateTimeFormat("es-VE", { timeZone: ZONA_HORARIA, dateStyle: "medium" });
const HORA = new Intl.DateTimeFormat("es-VE", { timeZone: ZONA_HORARIA, timeStyle: "short" });

/**
 * Como se lee una accion.
 *
 * Una que no este en la lista se muestra tal cual esta guardada: es preferible
 * ver `factura.anulada` a ver un hueco, y pasa justo cuando un modulo nuevo
 * anota algo antes de darle nombre.
 */
export function nombreDeAccion(accion: string): string {
  return NOMBRES_DE_ACCION[accion as AccionAuditoria] ?? accion;
}

/** Quien lo hizo, o por que no hay nadie. */
export function nombreDeActor(linea: LineaAuditoria): string {
  return linea.actorNombre ?? "Sin identificar";
}

export function columnasAuditoria(
  ruta: string,
  estado: EstadoListado,
): Columna<LineaAuditoria>[] {
  return [
    {
      clave: "creadoEn",
      titulo: "Cuando",
      ordenable: true,
      ancho: ANCHOS.creadoEn,
      render: (linea) => (
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-medium">
            {FECHA.format(new Date(linea.creadoEn))}
          </p>
          <p className="truncate text-[11.5px] text-suave tabular-nums">
            {HORA.format(new Date(linea.creadoEn))}
          </p>
        </div>
      ),
    },

    {
      clave: "quien",
      titulo: "Quien",
      ancho: ANCHOS.quien,
      tarjeta: "titulo",
      render: (linea) => (
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold">
            {nombreDeActor(linea)}
          </p>
          <p className="truncate text-[11.5px] text-suave">
            {linea.actorEmail ?? "No habia sesion iniciada"}
          </p>
        </div>
      ),
    },

    {
      clave: "accion",
      titulo: "Que hizo",
      ancho: ANCHOS.accion,
      render: (linea) => (
        <div className="min-w-0">
          <p className="truncate text-[12.5px]">{nombreDeAccion(linea.accion)}</p>
          <p className="truncate font-mono text-[11px] text-suave">
            {linea.accion}
          </p>
        </div>
      ),
    },

    {
      clave: "empresa",
      titulo: "Empresa",
      ancho: ANCHOS.empresa,
      render: (linea) =>
        linea.empresaNombre ? (
          <span className="block truncate text-[12.5px]">
            {linea.empresaNombre}
          </span>
        ) : (
          <span className="text-[12px] text-suave">—</span>
        ),
    },

    {
      clave: "acciones",
      titulo: "Detalle",
      ancho: ANCHOS.acciones,
      alineacion: "derecha",
      tarjeta: "acciones",
      render: (linea) => (
        <Link
          href={conPanel(ruta, estado, "ver", linea.id)}
          scroll={false}
          aria-label={`Ver el detalle: ${nombreDeAccion(linea.accion)}, ${nombreDeActor(linea)}`}
          title="Ver el detalle"
          className={[
            "suave ml-auto grid size-9 shrink-0 place-items-center rounded-[10px]",
            "border border-transparent text-suave",
            "hover:border-acento hover:bg-acento hover:text-acento-contraste",
            "[&>svg]:size-[16px]",
          ].join(" ")}
        >
          <Eye aria-hidden="true" />
        </Link>
      ),
    },
  ];
}

/** Los filtros del listado. El «Todos» lo antepone ListadoFiltros. */
export function filtrosAuditoria(): DefinicionFiltro[] {
  return [
    {
      clave: "modulo",
      titulo: "Modulo",
      opciones: Object.entries(MODULOS_DE_AUDITORIA).map(([valor, texto]) => ({
        valor,
        texto,
      })),
    },
    {
      clave: "periodo",
      titulo: "Periodo",
      opciones: [
        { valor: "hoy", texto: "Ultimas 24 horas" },
        { valor: "semana", texto: "Ultimos 7 dias" },
        { valor: "mes", texto: "Ultimos 30 dias" },
      ],
    },
  ];
}
