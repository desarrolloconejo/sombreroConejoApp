import Link from "next/link";
import { ArrowRight, Repeat } from "lucide-react";

import { EtiquetaDocumento, fechaDiaCorta } from "@/components/finanzas/Documento";
import { dolares, numeroDe } from "@/lib/finanzas/documentos";
import { rutaProforma } from "@/lib/finanzas/rutas";
import {
  NOMBRES_DE_ESTADO_PROFORMA,
  type Columna,
  type DefinicionFiltro,
  type NombreEmpresa,
  type Proforma,
} from "@/types";

/**
 * Las columnas del listado de proformas. Mismo contrato que el resto de
 * listados.
 */

const ANCHOS = {
  numero: "104px",
  proforma: "2fr",
  estado: "112px",
  recurrencia: "150px",
  total: "120px",
  acciones: "56px",
} as const;

/** La misma rejilla que arma ListadoTabla. La usa el esqueleto de carga. */
export const REJILLA_PROFORMAS = Object.values(ANCHOS)
  .map((ancho) => (ancho.endsWith("fr") ? `minmax(0, ${ancho})` : ancho))
  .join(" ");

export function columnasProformas(): Columna<Proforma>[] {
  return [
    {
      clave: "numero",
      titulo: "Numero",
      ordenable: true,
      ancho: ANCHOS.numero,
      render: (proforma) => (
        <span className="text-[12.5px] font-semibold tabular-nums">{numeroDe("proforma", proforma.numero)}</span>
      ),
    },
    {
      clave: "proforma",
      titulo: "Cliente · Proforma",
      ancho: ANCHOS.proforma,
      tarjeta: "titulo",
      render: (proforma) => (
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold">{proforma.empresaNombre}</p>
          <p className="truncate text-[12px] text-suave">{proforma.titulo}</p>
        </div>
      ),
    },
    {
      clave: "estado",
      titulo: "Estado",
      ancho: ANCHOS.estado,
      render: (proforma) => <EtiquetaDocumento situacion={proforma.estado} />,
    },
    {
      clave: "recurrencia",
      titulo: "Se repite",
      ancho: ANCHOS.recurrencia,
      render: (proforma) =>
        proforma.recurrente ? (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] [&>svg]:size-3.5">
            <Repeat aria-hidden="true" />
            {fechaDiaCorta(proforma.proximaEmision)}
          </span>
        ) : (
          <span className="text-[12px] text-suave">No</span>
        ),
    },
    {
      clave: "total",
      titulo: "Total",
      ordenable: true,
      ancho: ANCHOS.total,
      alineacion: "derecha",
      render: (proforma) => (
        <span className="text-[13px] font-semibold tabular-nums">{dolares(proforma.total)}</span>
      ),
    },
    {
      clave: "acciones",
      titulo: "Abrir",
      ancho: ANCHOS.acciones,
      alineacion: "derecha",
      tarjeta: "acciones",
      render: (proforma) => (
        <Link
          href={rutaProforma(proforma.id)}
          aria-label={`Abrir la proforma ${numeroDe("proforma", proforma.numero)} de ${proforma.empresaNombre}`}
          title="Abrir la proforma"
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
export function filtrosProformas(empresas: NombreEmpresa[]): DefinicionFiltro[] {
  const filtros: DefinicionFiltro[] = [
    {
      clave: "estado",
      titulo: "Estado",
      opciones: Object.entries(NOMBRES_DE_ESTADO_PROFORMA).map(([valor, texto]) => ({ valor, texto })),
    },
    {
      clave: "recurrente",
      titulo: "Se repite",
      opciones: [{ valor: "si", texto: "Solo las recurrentes" }],
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
