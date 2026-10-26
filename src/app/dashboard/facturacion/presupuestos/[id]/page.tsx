import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DecisionPresupuesto, ProveedorDecision } from "@/components/facturacion";
import {
  EtiquetaDocumento,
  fechaDia,
  fechaHora,
  ResumenImportes,
  SECCION_DOCUMENTO,
  TablaRenglones,
} from "@/components/finanzas";
import { Wrapper } from "@/components/layout/Wrapper";
import { conSesion } from "@/lib/db";
import { numeroDe, situacionDe } from "@/lib/finanzas/documentos";
import { RUTA_FACTURACION } from "@/lib/finanzas/rutas";
import { requerirFinanzasDeEmpresa } from "@/lib/sesion";
import { comoIdentificador } from "@/lib/validaciones";
import * as presupuestosModelo from "@/models/presupuestos";
import * as renglonesModelo from "@/models/renglones";

export const metadata: Metadata = {
  title: "Presupuesto",
};

/**
 * Un presupuesto, como lo ve el cliente: sus renglones e importes, y si
 * espera su decision, los botones para aprobarlo o rechazarlo.
 *
 * Uno de otra empresa, o un borrador, para el no existe: la base no lo
 * devuelve y la page responde 404.
 */
export default async function PaginaMiPresupuesto(
  props: PageProps<"/dashboard/facturacion/presupuestos/[id]">,
) {
  const { usuario } = await requerirFinanzasDeEmpresa();

  const id = comoIdentificador((await props.params).id);
  if (id === null) notFound();

  const datos = await conSesion(usuario, async (tx) => {
    const presupuesto = await presupuestosModelo.buscarPorId(id, tx);
    if (!presupuesto) return null;

    return { presupuesto, renglones: await renglonesModelo.deDocumento("presupuesto", id, tx) };
  });

  if (!datos) notFound();

  const { presupuesto, renglones } = datos;
  const numero = numeroDe("presupuesto", presupuesto.numero);
  const situacion = situacionDe(presupuesto.estado, presupuesto.vencido);

  const migas = [
    { texto: "Conejo App", href: "/dashboard" },
    { texto: "Facturacion", href: RUTA_FACTURACION },
    { texto: numero },
  ];

  return (
    <Wrapper migas={migas} kicker={`Presupuesto ${numero}`} titulo={presupuesto.titulo}>
      <ProveedorDecision>
        <div className="surge flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-suave">
          <EtiquetaDocumento situacion={situacion} />
          <span>Vale hasta el {fechaDia(presupuesto.validoHasta)}</span>
          {presupuesto.proyectoNombre && <span>Proyecto: {presupuesto.proyectoNombre}</span>}
        </div>

        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <section aria-labelledby="titulo-renglones" className="surge columna-pareja [--retraso:0.06s]">
            <h2 id="titulo-renglones" className="mb-3 text-[19px] font-extrabold tracking-[-0.02em]">
              Lo que incluye
            </h2>
            <div className={SECCION_DOCUMENTO}>
              <TablaRenglones renglones={renglones} />
              <div className="mt-4 border-t border-borde pt-4">
                <ResumenImportes importes={presupuesto} />
              </div>
              {presupuesto.notas && (
                <p className="mt-4 whitespace-pre-line border-t border-borde pt-4 text-[13px] leading-relaxed text-suave">
                  {presupuesto.notas}
                </p>
              )}
              <p className="mt-4 text-[11.5px] leading-relaxed text-suave">
                Importes en dolares. La factura se emite en bolivares a la tasa del dia de emision.
              </p>
            </div>
          </section>

          <section aria-labelledby="titulo-decision" className="surge columna-pareja [--retraso:0.1s]">
            <h2 id="titulo-decision" className="mb-3 text-[19px] font-extrabold tracking-[-0.02em]">
              {situacion === "enviado" ? "Tu decision" : "Estado"}
            </h2>
            <div className={SECCION_DOCUMENTO}>
              {situacion === "enviado" ? (
                <>
                  <p className="mb-4 text-[13px] leading-relaxed text-suave">
                    Al aprobarlo, preparamos la proforma. Si algo no encaja, rechazalo y
                    cuentanos que cambiarias.
                  </p>
                  <DecisionPresupuesto presupuestoId={presupuesto.id} />
                </>
              ) : situacion === "vencido" ? (
                <p className="text-[13px] leading-relaxed">
                  Su validez paso. Si te sigue interesando, escribenos y te enviamos uno nuevo.
                </p>
              ) : (
                <dl className="flex flex-col gap-2 text-[13px]">
                  <div className="flex justify-between gap-4">
                    <dt className="text-suave">{presupuesto.estado === "aprobado" ? "Aprobado" : "Rechazado"}</dt>
                    <dd className="text-right">{fechaHora(presupuesto.resueltoEn)}</dd>
                  </div>
                  {presupuesto.resueltoPorNombre && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-suave">Por</dt>
                      <dd className="text-right">
                        {presupuesto.aNombreDelCliente ? "La agencia, a tu nombre" : presupuesto.resueltoPorNombre}
                      </dd>
                    </div>
                  )}
                  {presupuesto.motivoRechazo && (
                    <div className="border-t border-borde pt-2">
                      <dt className="text-[11.5px] font-semibold text-suave">Motivo</dt>
                      <dd className="mt-1">{presupuesto.motivoRechazo}</dd>
                    </div>
                  )}
                </dl>
              )}
            </div>
          </section>
        </div>
      </ProveedorDecision>
    </Wrapper>
  );
}
