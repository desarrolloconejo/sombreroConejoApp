import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { fechaDia } from "@/components/finanzas/Documento";
import { bolivares, numeroFactura } from "@/lib/finanzas/documentos";
import type { Factura } from "@/types";
import { EtiquetaCobro } from "./ColumnasFacturas";

/**
 * Las facturas de una empresa en una lista corta: numero, vencimiento, estado
 * de cobro y saldo. La usa el cliente en su Facturacion.
 */
export function ListaFacturas({
  facturas,
  ruta,
  vacio,
}: {
  facturas: Factura[];
  ruta: (id: number) => string;
  vacio: string;
}) {
  if (facturas.length === 0) return <p className="text-[13px] text-suave">{vacio}</p>;

  return (
    <ul aria-label="Facturas" className="-my-1 flex flex-col">
      {facturas.map((factura) => (
        <li key={factura.id} className="border-b border-borde last:border-0">
          <Link
            href={ruta(factura.id)}
            className="suave -mx-2 flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-acento-tenue"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p className="text-[12px] font-semibold tabular-nums text-acento">
                  {numeroFactura(factura.serie, factura.numero)}
                </p>
                <EtiquetaCobro cobro={factura.cobro} vencida={factura.vencida} />
              </div>
              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-[12.5px] text-suave">
                  {factura.estado === "anulada" ? "Anulada" : `Vence el ${fechaDia(factura.venceEl)}`}
                </p>
                {factura.estado === "emitida" && (
                  <p className="text-[13.5px] font-bold tabular-nums">
                    {bolivares(factura.saldo)} <span className="text-[11.5px] font-normal text-suave">por pagar</span>
                  </p>
                )}
              </div>
            </div>
            <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-suave" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
