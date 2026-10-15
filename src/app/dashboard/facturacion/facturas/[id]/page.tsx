import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { reportarPago } from "@/actions/pagos";
import { EtiquetaCobro, ResumenCobro } from "@/components/facturas";
import { fechaDia, ResumenImportes, SECCION_DOCUMENTO, TablaRenglones } from "@/components/finanzas";
import { Wrapper } from "@/components/layout/Wrapper";
import { FormularioPago, ListaPagos } from "@/components/pagos";
import { conSesion } from "@/lib/db";
import { dolares, numeroFactura, tasaLegible } from "@/lib/finanzas/documentos";
import { RUTA_FACTURACION } from "@/lib/finanzas/rutas";
import { hoyEnCaracas } from "@/lib/portal/fases";
import { requerirFinanzasDeEmpresa } from "@/lib/sesion";
import { comoIdentificador } from "@/lib/validaciones";
import * as ajustesModelo from "@/models/ajustesFinanzas";
import * as facturasModelo from "@/models/facturas";
import * as pagosModelo from "@/models/pagos";

export const metadata: Metadata = {
  title: "Factura",
};

/**
 * Una factura de la empresa, como la ve el cliente: lo facturado, cuanto
 * falta por pagar, lo que ya reporto y donde reportar un pago o una
 * retencion con su comprobante. Lo que ve lo decide la base.
 */
export default async function PaginaMiFactura(props: PageProps<"/dashboard/facturacion/facturas/[id]">) {
  const { usuario } = await requerirFinanzasDeEmpresa();

  const id = comoIdentificador((await props.params).id);
  if (id === null) notFound();

  const datos = await conSesion(usuario, async (tx) => {
    const factura = await facturasModelo.buscarPorId(id, tx);
    if (!factura) return null;
    return {
      factura,
      renglones: await facturasModelo.renglones(id, tx),
      pagos: await pagosModelo.deFactura(id, tx),
      medios: await ajustesModelo.medios(tx),
    };
  });
  if (!datos) notFound();

  const { factura, renglones, pagos, medios } = datos;
  const numero = numeroFactura(factura.serie, factura.numero);
  const migas = [
    { texto: "Conejo App", href: "/dashboard" },
    { texto: "Facturacion", href: RUTA_FACTURACION },
    { texto: numero },
  ];
  const puedeReportar = factura.estado === "emitida" && (factura.cobro !== "pagada" || factura.retencionAbierta);

  return (
    <Wrapper migas={migas} kicker={`Factura ${numero}`} titulo={`Factura ${numero}`}>
      <div className="surge flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-suave">
        <EtiquetaCobro cobro={factura.cobro} vencida={factura.vencida} />
        <span>Emitida el {fechaDia(factura.fechaEmision)}</span>
        <span>Vence el {fechaDia(factura.venceEl)}</span>
        <span>Control {factura.numeroControl}</span>
      </div>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          {puedeReportar && (
            <section aria-labelledby="titulo-reportar" className="surge [--retraso:0.04s]">
              <h2 id="titulo-reportar" className="mb-3 text-[19px] font-extrabold tracking-[-0.02em]">
                Reportar un pago
              </h2>
              <div className={SECCION_DOCUMENTO}>
                <FormularioPago
                  accion={reportarPago}
                  facturaId={factura.id}
                  medios={medios}
                  hoy={hoyEnCaracas()}
                  conRetencionIslr={false}
                  comprobanteObligatorio
                />
              </div>
            </section>
          )}

          <section aria-labelledby="titulo-factura" className="surge [--retraso:0.08s]">
            <h2 id="titulo-factura" className="mb-3 text-[19px] font-extrabold tracking-[-0.02em]">
              Lo que se facturo
            </h2>
            <div className={SECCION_DOCUMENTO}>
              <TablaRenglones moneda="VES" renglones={renglones.map((r) => ({ ...r, id: r.orden }))} />
              <div className="mt-4 border-t border-borde pt-4">
                <ResumenImportes moneda="VES" importes={factura} />
              </div>
              <p className="mt-4 border-t border-borde pt-3 text-[12.5px] text-suave">
                Tasa BCV {tasaLegible(factura.tasa)} Bs por dolar, del {fechaDia(factura.tasaFecha)}. Referencia:{" "}
                {dolares(factura.totalUsd)}.
              </p>
            </div>
          </section>
        </div>

        <section aria-labelledby="titulo-cobro" className="surge flex flex-col gap-4 [--retraso:0.12s]">
          <h2 id="titulo-cobro" className="text-[19px] font-extrabold tracking-[-0.02em]">
            Lo que falta por pagar
          </h2>
          <div className={SECCION_DOCUMENTO}>
            <ResumenCobro factura={factura} />
          </div>
          <div className={SECCION_DOCUMENTO}>
            <h3 className="mb-2 text-[14px] font-bold">Lo que reportaste</h3>
            <ListaPagos
              pagos={pagos}
              operador={false}
              vacio="Aun no has reportado pagos de esta factura."
            />
          </div>
        </section>
      </div>
    </Wrapper>
  );
}
