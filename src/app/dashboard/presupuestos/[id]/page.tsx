import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  EtiquetaDocumento,
  fechaDia,
  fechaHora,
  ResumenImportes,
  SECCION_DOCUMENTO,
  TablaRenglones,
} from "@/components/finanzas";
import { Wrapper } from "@/components/layout/Wrapper";
import {
  DecisionANombre,
  EditorPresupuesto,
  GenerarProforma,
  ProveedorGuardado,
} from "@/components/presupuestos";
import { Alerta } from "@/components/ui";
import { conSesion } from "@/lib/db";
import { numeroDe, situacionDe } from "@/lib/finanzas/documentos";
import { RUTA_PRESUPUESTOS, rutaProforma } from "@/lib/finanzas/rutas";
import { rutaBrief, rutaProyecto } from "@/lib/portal/rutas";
import { requerirFinanzas } from "@/lib/sesion";
import { comoIdentificador } from "@/lib/validaciones";
import * as clientesModelo from "@/models/clientes";
import * as presupuestosModelo from "@/models/presupuestos";
import * as proformasModelo from "@/models/proformas";
import * as renglonesModelo from "@/models/renglones";

export const metadata: Metadata = {
  title: "Presupuesto",
};

/**
 * Un presupuesto. En borrador es su editor; despues, el documento como lo ve
 * el cliente, con lo que toca hacer segun en que punto esta: esperar su
 * decision (o registrarla a su nombre) o generar la proforma.
 */
export default async function PaginaPresupuesto(props: PageProps<"/dashboard/presupuestos/[id]">) {
  const usuario = await requerirFinanzas();

  const id = comoIdentificador((await props.params).id);
  if (id === null) notFound();

  const datos = await conSesion(usuario, async (tx) => {
    const presupuesto = await presupuestosModelo.buscarPorId(id, tx);
    if (!presupuesto) return null;

    return {
      presupuesto,
      renglones: await renglonesModelo.deDocumento("presupuesto", id, tx),
      proyectos:
        presupuesto.estado === "borrador"
          ? await proformasModelo.proyectosLigables(presupuesto.empresaId, tx)
          : [],
      conFinanzas: (await clientesModelo.conFinanzasDe(presupuesto.empresaId, tx)).length,
    };
  });

  if (!datos) notFound();

  const { presupuesto, renglones, proyectos, conFinanzas } = datos;
  const numero = numeroDe("presupuesto", presupuesto.numero);
  const situacion = situacionDe(presupuesto.estado, presupuesto.vencido);

  const migas = [
    { texto: "Conejo App", href: "/dashboard" },
    { texto: "Presupuestos", href: RUTA_PRESUPUESTOS },
    { texto: numero },
  ];

  return (
    <Wrapper migas={migas} kicker={`${presupuesto.empresaNombre} · ${numero}`} titulo={presupuesto.titulo}>
      <ProveedorGuardado>
      <div className="surge flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-suave">
        <EtiquetaDocumento situacion={situacion} />
        <span>Vale hasta el {fechaDia(presupuesto.validoHasta)}</span>
        {presupuesto.proyectoId !== null && (
          <span>
            Proyecto:{" "}
            <Link href={rutaProyecto(presupuesto.proyectoId)} className="font-semibold text-acento hover:underline">
              {presupuesto.proyectoNombre}
            </Link>
          </span>
        )}
        {presupuesto.briefId !== null && (
          <span>
            Del brief{" "}
            <Link href={rutaBrief(presupuesto.briefId)} className="font-semibold text-acento hover:underline">
              {presupuesto.briefCodigo}
            </Link>
          </span>
        )}
        <span>Creado por {presupuesto.creadoPorNombre}</span>
      </div>

      {presupuesto.estado === "borrador" ? (
        <section aria-label="Editar el presupuesto" className={`surge mt-6 [--retraso:0.06s] ${SECCION_DOCUMENTO}`}>
          {conFinanzas === 0 && (
            <Alerta className="mb-5">
              <b className="font-semibold">Nadie de {presupuesto.empresaNombre} ve sus finanzas.</b>{" "}
              Al enviarlo no le llegara a nadie: marca a alguien en Usuarios, o registra tu
              la decision del cliente cuando responda.
            </Alerta>
          )}
          <EditorPresupuesto presupuesto={presupuesto} renglones={renglones} proyectos={proyectos} />
        </section>
      ) : (
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <section aria-labelledby="titulo-renglones" className="surge [--retraso:0.06s]">
            <h2 id="titulo-renglones" className="mb-3 text-[19px] font-extrabold tracking-[-0.02em]">
              Renglones
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
            </div>
          </section>

          <section aria-labelledby="titulo-situacion" className="surge flex flex-col gap-4 [--retraso:0.1s]">
            <h2 id="titulo-situacion" className="text-[19px] font-extrabold tracking-[-0.02em]">
              {situacion === "enviado" ? "Esperando al cliente" : "Decision"}
            </h2>

            <div className={SECCION_DOCUMENTO}>
              <dl className="flex flex-col gap-2 text-[13px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-suave">Enviado</dt>
                  <dd>{fechaHora(presupuesto.enviadoEn)}</dd>
                </div>
                {presupuesto.resueltoEn && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-suave">{presupuesto.estado === "aprobado" ? "Aprobado" : "Rechazado"}</dt>
                    <dd className="text-right">
                      {fechaHora(presupuesto.resueltoEn)}
                      <span className="block text-[12px] text-suave">
                        {presupuesto.aNombreDelCliente
                          ? `Registrado por ${presupuesto.resueltoPorNombre}, a nombre del cliente`
                          : `Por ${presupuesto.resueltoPorNombre}`}
                      </span>
                    </dd>
                  </div>
                )}
              </dl>

              {presupuesto.motivoRechazo && (
                <p className="mt-3 border-t border-borde pt-3 text-[13px] leading-relaxed">
                  <span className="block text-[11.5px] font-semibold text-suave">Motivo</span>
                  {presupuesto.motivoRechazo}
                </p>
              )}

              {situacion === "vencido" && (
                <p className="mt-3 border-t border-borde pt-3 text-[12.5px] leading-relaxed text-suave">
                  Su validez paso sin respuesta. Para ofrecerlo de nuevo, abre otro presupuesto.
                </p>
              )}
            </div>

            {situacion === "enviado" && (
              <div className={SECCION_DOCUMENTO}>
                <h3 className="mb-1 text-[14px] font-bold">Registrar la respuesta del cliente</h3>
                <p className="mb-4 text-[12.5px] leading-relaxed text-suave">
                  Si respondio por otro medio, o la empresa no tiene a nadie con cuenta.
                  Quedara dicho que lo registraste tu.
                </p>
                <DecisionANombre presupuestoId={presupuesto.id} />
              </div>
            )}

            {presupuesto.estado === "aprobado" && (
              <div className={SECCION_DOCUMENTO}>
                <h3 className="mb-1 text-[14px] font-bold">Proforma</h3>
                {presupuesto.proformaId !== null && presupuesto.proformaNumero !== null ? (
                  <p className="text-[13px]">
                    Ya tiene la suya:{" "}
                    <Link href={rutaProforma(presupuesto.proformaId)} className="font-semibold text-acento hover:underline">
                      {numeroDe("proforma", presupuesto.proformaNumero)}
                    </Link>
                  </p>
                ) : (
                  <>
                    <p className="mb-4 text-[12.5px] leading-relaxed text-suave">
                      Copia sus renglones y su proyecto. Se queda en borrador hasta que la emitas.
                    </p>
                    <GenerarProforma presupuestoId={presupuesto.id} />
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      )}
      </ProveedorGuardado>
    </Wrapper>
  );
}
