import { bolivares } from "@/lib/finanzas/documentos";
import type { Factura } from "@/types";

/** El estado de cobro de una factura, en una lista corta. Lo comparte el cliente. */
export function ResumenCobro({ factura }: { factura: Factura }) {
  const filas = [
    { texto: "Total", valor: bolivares(factura.total) },
    { texto: "Pagado", valor: bolivares(factura.pagado) },
    { texto: "Retenido", valor: bolivares(factura.retenido) },
  ];

  return (
    <dl className="flex flex-col gap-1.5 text-[13px]">
      {filas.map((fila) => (
        <div key={fila.texto} className="flex justify-between gap-4">
          <dt className="text-suave">{fila.texto}</dt>
          <dd className="tabular-nums">{fila.valor}</dd>
        </div>
      ))}
      <div className="mt-1 flex justify-between gap-4 border-t border-borde pt-2">
        <dt className="font-bold">Saldo</dt>
        <dd className="text-[16px] font-extrabold tabular-nums">{bolivares(factura.saldo)}</dd>
      </div>
      {!/^0(\.0+)?$/.test(factura.retencionEsperada) && (
        <p className="mt-2 rounded-lg bg-acento-tenue px-3 py-2 text-[12px] leading-relaxed">
          Agente de retencion ({factura.retencionIvaPct?.replace(/\.00$/, "")} % del IVA): se esperan{" "}
          {bolivares(factura.retencionEsperada)} en retencion.
          {factura.retencionAbierta ? " Aun no esta confirmada." : " Ya esta confirmada."}
        </p>
      )}
    </dl>
  );
}
