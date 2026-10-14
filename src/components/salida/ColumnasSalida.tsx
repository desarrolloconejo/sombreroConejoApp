import Link from "next/link";
import { Eye } from "lucide-react";

import { Etiqueta } from "@/components/ui";
import { conPanel } from "@/lib/urlListado";
import {
  NOMBRES_DE_CORREO,
  NOMBRES_DE_ESTADO_CORREO,
  type Columna,
  type CorreoSalida,
  type DefinicionFiltro,
  type EstadoListado,
  type TipoCorreo,
} from "@/types";
import { ZONA_HORARIA } from "@/lib/fechas";

/**
 * Las columnas de la bandeja de salida.
 *
 * Mismo contrato que el resto de listados: el modulo declara que va en cada
 * celda y el listado estandar monta la tabla y las tarjetas.
 */

const ANCHOS = {
  creadoEn: "1fr",
  para: "1.6fr",
  asunto: "2fr",
  estado: "1.1fr",
  acciones: "56px",
} as const;

/** La misma rejilla que arma ListadoTabla. La usa el esqueleto de carga. */
export const REJILLA_SALIDA = Object.values(ANCHOS)
  .map((ancho) => (ancho.endsWith("fr") ? `minmax(0, ${ancho})` : ancho))
  .join(" ");

const FECHA = new Intl.DateTimeFormat("es-VE", { timeZone: ZONA_HORARIA, dateStyle: "medium" });
const HORA = new Intl.DateTimeFormat("es-VE", { timeZone: ZONA_HORARIA, timeStyle: "short" });

/** Como se lee un tipo de correo. Uno sin nombre se muestra tal cual. */
export function nombreDeCorreo(tipo: string): string {
  return NOMBRES_DE_CORREO[tipo as TipoCorreo] ?? tipo;
}

/**
 * El estado, dicho para quien tiene que actuar.
 *
 * Un correo simulado tiene dos momentos que la base guarda en columnas
 * distintas: esperando a que alguien lo entregue, o ya entregado a mano. En
 * pantalla son dos estados, porque uno pide hacer algo y el otro no.
 */
export function estadoDeCorreo(correo: CorreoSalida): string {
  if (correo.estado === "simulado") {
    return correo.entregadoEn ? "Entregado a mano" : "Por entregar";
  }

  return NOMBRES_DE_ESTADO_CORREO[correo.estado];
}

export function columnasSalida(
  ruta: string,
  estado: EstadoListado,
): Columna<CorreoSalida>[] {
  return [
    {
      clave: "creadoEn",
      titulo: "Cuando",
      ordenable: true,
      ancho: ANCHOS.creadoEn,
      render: (correo) => (
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-medium">
            {FECHA.format(new Date(correo.creadoEn))}
          </p>
          <p className="truncate text-[11.5px] text-suave tabular-nums">
            {HORA.format(new Date(correo.creadoEn))}
          </p>
        </div>
      ),
    },

    {
      clave: "para",
      titulo: "Para",
      ancho: ANCHOS.para,
      tarjeta: "titulo",
      render: (correo) => (
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold">
            {correo.paraNombre ?? correo.para}
          </p>
          <p className="truncate text-[11.5px] text-suave">{correo.para}</p>
        </div>
      ),
    },

    {
      clave: "asunto",
      titulo: "Asunto",
      ancho: ANCHOS.asunto,
      render: (correo) => (
        <div className="min-w-0">
          <p className="truncate text-[12.5px]">{correo.asunto}</p>
          <p className="truncate text-[11.5px] text-suave">
            {nombreDeCorreo(correo.tipo)}
          </p>
        </div>
      ),
    },

    {
      clave: "estado",
      titulo: "Estado",
      ancho: ANCHOS.estado,
      render: (correo) => <Etiqueta>{estadoDeCorreo(correo)}</Etiqueta>,
    },

    {
      clave: "acciones",
      titulo: "Abrir",
      ancho: ANCHOS.acciones,
      alineacion: "derecha",
      tarjeta: "acciones",
      render: (correo) => (
        <Link
          href={conPanel(ruta, estado, "ver", correo.id)}
          scroll={false}
          aria-label={`Abrir el correo para ${correo.paraNombre ?? correo.para}: ${correo.asunto}`}
          title="Abrir el correo"
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
export function filtrosSalida(): DefinicionFiltro[] {
  return [
    {
      clave: "estado",
      titulo: "Estado",
      opciones: [
        { valor: "por_entregar", texto: "Por entregar a mano" },
        { valor: "enviado", texto: "Enviados" },
        { valor: "fallido", texto: "Fallidos" },
        { valor: "pendiente", texto: "Pendientes" },
      ],
    },
  ];
}
