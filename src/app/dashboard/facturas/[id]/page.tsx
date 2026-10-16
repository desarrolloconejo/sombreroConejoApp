import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AnularFactura, EtiquetaCobro, ImprimirFactura, ProveedorFactura, ResumenCobro } from "@/components/facturas";
import { fechaDia, fechaHora, ResumenImportes, SECCION_DOCUMENTO, TablaRenglones } from "@/components/finanzas";
import { Wrapper } from "@/components/layout/Wrapper";
import { BotonCopiar } from "@/components/ui";
import { FormularioPago, ListaPagos } from "@/components/pagos";
import { registrarPago } from "@/actions/pagos";
import { conSesion } from "@/lib/db";
import { dolares, numeroDe, numeroFactura, tasaLegible } from "@/lib/finanzas/documentos";
import { RUTA_FACTURAS, rutaProforma } from "@/lib/finanzas/rutas";
import { hoyEnCaracas } from "@/lib/portal/fases";
import { requerirFinanzas } from "@/lib/sesion";
import { comoIdentificador } from "@/lib/validaciones";
import * as ajustesModelo from "@/models/ajustesFinanzas";
import * as facturasModelo from "@/models/facturas";
import * as pagosModelo from "@/models/pagos";
import type { ParteFactura } from "@/types";

export const metadata: Metadata = {
  title: "Factura",
};

/** Un dato con su boton de copiar al lado, si lo hay. */
function Copiable({ valor, que, falta }: { valor: string; que: string; falta: string }) {
  if (!valor) return <>{falta}</>;
  return (
    <span className="inline-flex max-w-full items-start gap-1.5">
      <span className="min-w-0">{valor}</span>
      <BotonCopiar texto={valor} que={que} className="-my-1" />
    </span>
  );
}

function Parte({ titulo, parte }: { titulo: string; parte: ParteFactura }) {
  const de = titulo.toLowerCase();
  return (
    <div>
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-suave">{titulo}</p>
      <p className="mt-1 text-[13.5px] font-bold">
        <Copiable valor={parte.razonSocial} que={`la razon social del ${de}`} falta="Sin razon social" />
      </p>
      <p className="text-[12.5px] tabular-nums">
        <Copiable valor={parte.rif} que={`el RIF del ${de}`} falta="Sin RIF" />
      </p>
      <p className="mt-0.5 text-[12.5px] leading-relaxed text-suave">
        <Copiable valor={parte.domicilio} que={`el domicilio del ${de}`} falta="Sin domicilio" />
      </p>
    </div>
  );
}

/**
 * Una factura: lo que se imprimio (copias congeladas del emisor y del
 * cliente, renglones e importes en bolivares, la tasa), su cobro, imprimirla
 * en un formato y anularla.
 */
export default async function PaginaFactura(props: PageProps<"/dashboard/facturas/[id]">) {
  const usuario = await requerirFinanzas();

  const id = comoIdentificador((await props.params).id);
  if (id === null) notFound();

  const datos = await conSesion(usuario, async (tx) => {
    const factura = await facturasModelo.buscarPorId(id, tx);
    if (!factura) return null;
    return {
      factura,
      renglones: await facturasModelo.renglones(id, tx),
      formatos: (await ajustesModelo.formatos(tx)).filter((f) => f.activo),
      pagos: await pagosModelo.deFactura(id, tx),
      medios: (await ajustesModelo.medios(tx)).filter((m) => m.activo),
      islr: (await ajustesModelo.leer(tx))?.islrActivo ?? false,
    };
  });
  if (!datos) notFound();

  const { factura, renglones, formatos, pagos, medios, islr } = datos;
  const numero = numeroFactura(factura.serie, factura.numero);
  const migas = [
    { texto: "Conejo App", href: "/dashboard" },
    { texto: "Facturas", href: RUTA_FACTURAS },
    { texto: numero },
  ];

  return (
    <Wrapper migas={migas} kicker={`${factura.empresaNombre} · control ${factura.numeroControl}`} titulo={`Factura ${numero}`}>
      <ProveedorFactura>
        <div className="surge flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-suave">
          <EtiquetaCobro cobro={factura.cobro} vencida={factura.vencida} />
          <span className="inline-flex items-center gap-1">
            Numero <b className="font-semibold text-texto tabular-nums">{numero}</b>
            <BotonCopiar texto={numero} que="el numero de factura" />
          </span>
          <span className="inline-flex items-center gap-1">
            Control <b className="font-semibold text-texto tabular-nums">{factura.numeroControl}</b>
            <BotonCopiar texto={factura.numeroControl} que="el numero de control" />
          </span>
          <span>Emitida el {fechaDia(factura.fechaEmision)}</span>
          <span>Vence el {fechaDia(factura.venceEl)}</span>
          <span>
            De la proforma{" "}
            <Link href={rutaProforma(factura.proformaId)} className="font-semibold text-acento hover:underline">
              {numeroDe("proforma", factura.proformaNumero)}
            </Link>
          </span>
          <span>Por {factura.emitidaPorNombre}</span>
        </div>

        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <section aria-labelledby="titulo-factura" className="surge flex flex-col gap-4 [--retraso:0.06s]">
            <h2 id="titulo-factura" className="text-[19px] font-extrabold tracking-[-0.02em]">
              Lo que se facturo
            </h2>
            <div className={SECCION_DOCUMENTO}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Parte titulo="Cliente" parte={factura.cliente} />
                <Parte titulo="Emisor" parte={factura.emisor} />
              </div>
              <div className="mt-4 border-t border-borde pt-4">
                <TablaRenglones moneda="VES" renglones={renglones.map((r) => ({ ...r, id: r.orden }))} />
              </div>
              <div className="mt-4 border-t border-borde pt-4">
                <ResumenImportes moneda="VES" importes={factura} />
              </div>
              <p className="mt-4 border-t border-borde pt-3 text-[12.5px] text-suave">
                Tasa BCV {tasaLegible(factura.tasa)} Bs por dolar, del {fechaDia(factura.tasaFecha)}. Referencia:{" "}
                {dolares(factura.totalUsd)}.
              </p>
            </div>
          </section>

          <section aria-labelledby="titulo-cobro" className="surge flex flex-col gap-4 [--retraso:0.1s]">
            <h2 id="titulo-cobro" className="text-[19px] font-extrabold tracking-[-0.02em]">
              Cobro
            </h2>
            <div className={SECCION_DOCUMENTO}>
              <ResumenCobro factura={factura} />
            </div>

            <div className={SECCION_DOCUMENTO}>
              <h3 className="mb-2 text-[14px] font-bold">Pagos y retenciones</h3>
              <ListaPagos
                pagos={pagos}
                operador
                tasaSugerida={factura.tasa}
                vacio="El cliente aun no ha reportado pagos."
              />
            </div>

            {factura.estado === "emitida" && (
              <details className={SECCION_DOCUMENTO}>
                <summary className="cursor-pointer text-[14px] font-bold">Registrar un pago a nombre del cliente</summary>
                <div className="mt-4">
                  <FormularioPago
                    accion={registrarPago}
                    facturaId={factura.id}
                    medios={medios}
                    hoy={hoyEnCaracas()}
                    conRetencionIslr={islr}
                    comprobanteObligatorio={false}
                  />
                </div>
              </details>
            )}

            {factura.estado === "emitida" && (
              <div className={SECCION_DOCUMENTO}>
                <h3 className="mb-3 text-[14px] font-bold">Imprimir sobre el talonario</h3>
                <ImprimirFactura
                  facturaId={factura.id}
                  formatos={formatos.map((f) => ({ id: f.id, nombre: f.nombre, habitual: f.habitual }))}
                  impresa={factura.impresaEn !== null}
                />
                {factura.impresaEn && (
                  <p className="mt-3 text-[12px] text-suave">Impresa el {fechaHora(factura.impresaEn)}.</p>
                )}
              </div>
            )}

            {factura.estado === "anulada" ? (
              <div className={SECCION_DOCUMENTO}>
                <p className="text-[13px] font-bold">Anulada el {fechaHora(factura.anuladaEn)}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-suave">{factura.motivoAnulacion}</p>
              </div>
            ) : (
              <div className={SECCION_DOCUMENTO}>
                <AnularFactura facturaId={factura.id} />
              </div>
            )}
          </section>
        </div>
      </ProveedorFactura>
    </Wrapper>
  );
}
