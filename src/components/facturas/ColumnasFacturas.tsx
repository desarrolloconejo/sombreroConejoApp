import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { fechaDiaCorta } from "@/components/finanzas/Documento";
import { bolivares, numeroFactura } from "@/lib/finanzas/documentos";
import {
  NOMBRES_DE_ESTADO_COBRO,
  type Columna,
  type DefinicionFiltro,
  type EstadoCobro,
  type Factura,
  type NombreEmpresa,
} from "@/types";

/**
 * Las columnas del listado de facturas y la etiqueta de su estado de cobro.
 * Mismo contrato que el resto de listados. Sirven al operador y al cliente:
 * solo cambia a donde lleva cada fila.
 */

/** Pendiente y vencida piden atencion; pagada y anulada, no. */
export function EtiquetaCobro({ cobro, vencida = false }: { cobro: EstadoCobro; vencida?: boolean }) {
  const texto = vencida ? "Vencida" : NOMBRES_DE_ESTADO_COBRO[cobro];
  const clase = vencida
    ? "border-blackberry/40 text-blackberry dark-tema:border-gold/40 dark-tema:text-acento"
    : cobro === "pendiente" || cobro === "parcial"
      ? "border-transparent bg-acento text-acento-contraste"
      : "border-borde text-suave";

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1",
        "text-[10.5px] font-semibold uppercase tracking-[0.06em]",
        clase,
      ].join(" ")}
    >
      {texto}
    </span>
  );
}

const ANCHOS = {
  numero: "104px",
  factura: "2fr",
  fecha: "112px",
  cobro: "120px",
  total: "150px",
  saldo: "150px",
  acciones: "56px",
} as const;

/** La misma rejilla que arma ListadoTabla. La usa el esqueleto de carga. */
export const REJILLA_FACTURAS = Object.values(ANCHOS)
  .map((ancho) => (ancho.endsWith("fr") ? `minmax(0, ${ancho})` : ancho))
  .join(" ");

export function columnasFacturas(ruta: (id: number) => string): Columna<Factura>[] {
  return [
    {
      clave: "numero",
      titulo: "Numero",
      ordenable: true,
      ancho: ANCHOS.numero,
      render: (factura) => (
        <span className="text-[12.5px] font-semibold tabular-nums">{numeroFactura(factura.serie, factura.numero)}</span>
      ),
    },
    {
      clave: "factura",
      titulo: "Cliente · Control",
      ancho: ANCHOS.factura,
      tarjeta: "titulo",
      render: (factura) => (
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold">{factura.empresaNombre}</p>
          <p className="truncate text-[12px] text-suave">Control {factura.numeroControl}</p>
        </div>
      ),
    },
    {
      clave: "fechaEmision",
      titulo: "Emitida",
      ordenable: true,
      ancho: ANCHOS.fecha,
      render: (factura) => <span className="text-[12.5px]">{fechaDiaCorta(factura.fechaEmision)}</span>,
    },
    {
      clave: "cobro",
      titulo: "Cobro",
      ancho: ANCHOS.cobro,
      render: (factura) => <EtiquetaCobro cobro={factura.cobro} vencida={factura.vencida} />,
    },
    {
      clave: "total",
      titulo: "Total",
      ordenable: true,
      ancho: ANCHOS.total,
      alineacion: "derecha",
      render: (factura) => <span className="text-[13px] font-semibold tabular-nums">{bolivares(factura.total)}</span>,
    },
    {
      clave: "saldo",
      titulo: "Saldo",
      ancho: ANCHOS.saldo,
      alineacion: "derecha",
      render: (factura) => <span className="text-[13px] tabular-nums">{bolivares(factura.saldo)}</span>,
    },
    {
      clave: "acciones",
      titulo: "Abrir",
      ancho: ANCHOS.acciones,
      alineacion: "derecha",
      tarjeta: "acciones",
      render: (factura) => (
        <Link
          href={ruta(factura.id)}
          aria-label={`Abrir la factura ${numeroFactura(factura.serie, factura.numero)} de ${factura.empresaNombre}`}
          title="Abrir la factura"
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
export function filtrosFacturas(empresas: NombreEmpresa[]): DefinicionFiltro[] {
  const filtros: DefinicionFiltro[] = [
    {
      clave: "cobro",
      titulo: "Cobro",
      opciones: Object.entries(NOMBRES_DE_ESTADO_COBRO).map(([valor, texto]) => ({ valor, texto })),
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
