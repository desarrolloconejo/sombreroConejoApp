import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { EtiquetaDocumento, fechaDiaCorta } from "@/components/finanzas/Documento";
import { dolares, numeroDe, situacionDe } from "@/lib/finanzas/documentos";
import { rutaPresupuesto } from "@/lib/finanzas/rutas";
import {
  NOMBRES_DE_SITUACION,
  type Columna,
  type DefinicionFiltro,
  type NombreEmpresa,
  type Presupuesto,
} from "@/types";

/**
 * Las columnas del listado de presupuestos. Mismo contrato que el resto de
 * listados: el modulo dice que va en cada celda y el listado estandar monta la
 * tabla y las tarjetas.
 */

const ANCHOS = {
  numero: "104px",
  presupuesto: "2fr",
  situacion: "128px",
  validez: "120px",
  total: "120px",
  acciones: "56px",
} as const;

/** La misma rejilla que arma ListadoTabla. La usa el esqueleto de carga. */
export const REJILLA_PRESUPUESTOS = Object.values(ANCHOS)
  .map((ancho) => (ancho.endsWith("fr") ? `minmax(0, ${ancho})` : ancho))
  .join(" ");

export function columnasPresupuestos(): Columna<Presupuesto>[] {
  return [
    {
      clave: "numero",
      titulo: "Numero",
      ordenable: true,
      ancho: ANCHOS.numero,
      render: (presupuesto) => (
        <span className="text-[12.5px] font-semibold tabular-nums">
          {numeroDe("presupuesto", presupuesto.numero)}
        </span>
      ),
    },
    {
      clave: "presupuesto",
      titulo: "Cliente · Presupuesto",
      ancho: ANCHOS.presupuesto,
      tarjeta: "titulo",
      render: (presupuesto) => (
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold">{presupuesto.empresaNombre}</p>
          <p className="truncate text-[12px] text-suave">{presupuesto.titulo}</p>
        </div>
      ),
    },
    {
      clave: "situacion",
      titulo: "Estado",
      ancho: ANCHOS.situacion,
      render: (presupuesto) => (
        <EtiquetaDocumento situacion={situacionDe(presupuesto.estado, presupuesto.vencido)} />
      ),
    },
    {
      clave: "validez",
      titulo: "Vale hasta",
      ancho: ANCHOS.validez,
      render: (presupuesto) => (
        <span className="text-[12.5px] tabular-nums">{fechaDiaCorta(presupuesto.validoHasta)}</span>
      ),
    },
    {
      clave: "total",
      titulo: "Total",
      ordenable: true,
      ancho: ANCHOS.total,
      alineacion: "derecha",
      render: (presupuesto) => (
        <span className="text-[13px] font-semibold tabular-nums">{dolares(presupuesto.total)}</span>
      ),
    },
    {
      clave: "acciones",
      titulo: "Abrir",
      ancho: ANCHOS.acciones,
      alineacion: "derecha",
      tarjeta: "acciones",
      render: (presupuesto) => (
        <Link
          href={rutaPresupuesto(presupuesto.id)}
          aria-label={`Abrir el presupuesto ${numeroDe("presupuesto", presupuesto.numero)} de ${presupuesto.empresaNombre}`}
          title="Abrir el presupuesto"
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
export function filtrosPresupuestos(empresas: NombreEmpresa[]): DefinicionFiltro[] {
  const filtros: DefinicionFiltro[] = [
    {
      clave: "situacion",
      titulo: "Estado",
      opciones: Object.entries(NOMBRES_DE_SITUACION).map(([valor, texto]) => ({ valor, texto })),
    },
  ];

  if (empresas.length > 1) {
    filtros.push({
      clave: "empresa",
      titulo: "Empresa",
      opciones: empresas.map((empresa) => ({ valor: String(empresa.id), texto: empresa.nombre })),
    });
  }

  return filtros;
}
