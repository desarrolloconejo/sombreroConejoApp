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
  AnularProforma,
  EditorProforma,
  PrepararSiguiente,
  ProveedorProforma,
  RecurrenciaProforma,
} from "@/components/proformas";
import { conSesion } from "@/lib/db";
import { numeroDe, sumarUnMes } from "@/lib/finanzas/documentos";
import { RUTA_PROFORMAS, rutaPresupuesto, rutaProforma } from "@/lib/finanzas/rutas";
import { hoyEnCaracas } from "@/lib/portal/fases";
import { rutaProyecto } from "@/lib/portal/rutas";
import { requerirFinanzas } from "@/lib/sesion";
import { comoIdentificador } from "@/lib/validaciones";
import * as proformasModelo from "@/models/proformas";
import * as renglonesModelo from "@/models/renglones";

export const metadata: Metadata = {
  title: "Proforma",
};

/**
 * Una proforma. En borrador es su editor; emitida, el documento con su
 * recurrencia y la opcion de anularla; anulada, el documento y el motivo.
 */
export default async function PaginaProforma(props: PageProps<"/dashboard/proformas/[id]">) {
  const usuario = await requerirFinanzas();

  const id = comoIdentificador((await props.params).id);
  if (id === null) notFound();

  const datos = await conSesion(usuario, async (tx) => {
    const proforma = await proformasModelo.buscarPorId(id, tx);
    if (!proforma) return null;

    return {
      proforma,
      renglones: await renglonesModelo.deDocumento("proforma", id, tx),
      ligados: await proformasModelo.proyectosDe(id, tx),
      ligables:
        proforma.estado === "borrador"
          ? await proformasModelo.proyectosLigables(proforma.empresaId, tx)
          : [],
    };
  });

  if (!datos) notFound();

  const { proforma, renglones, ligados, ligables } = datos;
  const numero = numeroDe("proforma", proforma.numero);
  const hoy = hoyEnCaracas();
  const tocaLaSiguiente =
    proforma.recurrente && proforma.proximaEmision !== null && proforma.proximaEmision <= hoy;

  const migas = [
    { texto: "Conejo App", href: "/dashboard" },
    { texto: "Proformas", href: RUTA_PROFORMAS },
    { texto: numero },
  ];

  return (
    <Wrapper migas={migas} kicker={`${proforma.empresaNombre} · ${numero}`} titulo={proforma.titulo}>
      <ProveedorProforma>
        <div className="surge flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-suave">
          <EtiquetaDocumento situacion={proforma.estado} />
          {proforma.presupuestoId !== null && proforma.presupuestoNumero !== null && (
            <span>
              Del presupuesto{" "}
              <Link href={rutaPresupuesto(proforma.presupuestoId)} className="font-semibold text-acento hover:underline">
                {numeroDe("presupuesto", proforma.presupuestoNumero)}
              </Link>
            </span>
          )}
          {proforma.origenId !== null && proforma.origenNumero !== null && (
            <span>
              Copia de la recurrente{" "}
              <Link href={rutaProforma(proforma.origenId)} className="font-semibold text-acento hover:underline">
                {numeroDe("proforma", proforma.origenNumero)}
              </Link>
            </span>
          )}
          <span>Creada por {proforma.creadoPorNombre}</span>
        </div>

        {proforma.estado === "borrador" ? (
          <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <section aria-label="Editar la proforma" className={`surge [--retraso:0.06s] ${SECCION_DOCUMENTO}`}>
              <EditorProforma proforma={proforma} renglones={renglones} ligados={ligados} ligables={ligables} />
            </section>
            <aside className="surge flex flex-col gap-4 [--retraso:0.1s]">
              <div className={SECCION_DOCUMENTO}>
                <h2 className="mb-1 text-[14px] font-bold">Antes de emitirla</h2>
                <p className="text-[12.5px] leading-relaxed text-suave">
                  Revisa los renglones y a que proyectos corresponde. Al emitirla, el
                  cliente la ve en su Facturacion y ya no se puede editar.
                </p>
              </div>
              <div className={SECCION_DOCUMENTO}>
                <AnularProforma proformaId={proforma.id} />
              </div>
            </aside>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <section aria-labelledby="titulo-renglones" className="surge [--retraso:0.06s]">
              <h2 id="titulo-renglones" className="mb-3 text-[19px] font-extrabold tracking-[-0.02em]">
                Renglones
              </h2>
              <div className={SECCION_DOCUMENTO}>
                <TablaRenglones renglones={renglones} />
                <div className="mt-4 border-t border-borde pt-4">
                  <ResumenImportes importes={proforma} />
                </div>
                {proforma.notas && (
                  <p className="mt-4 whitespace-pre-line border-t border-borde pt-4 text-[13px] leading-relaxed text-suave">
                    {proforma.notas}
                  </p>
                )}
              </div>
            </section>

            <section aria-labelledby="titulo-estado" className="surge flex flex-col gap-4 [--retraso:0.1s]">
              <h2 id="titulo-estado" className="text-[19px] font-extrabold tracking-[-0.02em]">
                Estado
              </h2>

              <div className={SECCION_DOCUMENTO}>
                <dl className="flex flex-col gap-2 text-[13px]">
                  <div className="flex justify-between gap-4">
                    <dt className="text-suave">Emitida</dt>
                    <dd className="text-right">{fechaHora(proforma.emitidaEn)}</dd>
                  </div>
                  {proforma.anuladaEn && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-suave">Anulada</dt>
                      <dd className="text-right">{fechaHora(proforma.anuladaEn)}</dd>
                    </div>
                  )}
                </dl>
                {proforma.motivoAnulacion && (
                  <p className="mt-3 border-t border-borde pt-3 text-[13px] leading-relaxed">
                    <span className="block text-[11.5px] font-semibold text-suave">Motivo</span>
                    {proforma.motivoAnulacion}
                  </p>
                )}
                <div className="mt-3 border-t border-borde pt-3">
                  <p className="mb-1.5 text-[11.5px] font-semibold text-suave">Proyectos</p>
                  {ligados.length === 0 ? (
                    <p className="text-[13px] text-suave">Ninguno</p>
                  ) : (
                    <ul className="flex flex-col gap-1 text-[13px]">
                      {ligados.map((proyecto) => (
                        <li key={proyecto.id}>
                          <Link href={rutaProyecto(proyecto.id)} className="font-semibold text-acento hover:underline">
                            {proyecto.nombre}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {proforma.estado !== "anulada" && (
                <div className={SECCION_DOCUMENTO}>
                  <h3 className="mb-3 text-[14px] font-bold">Recurrencia</h3>
                  {tocaLaSiguiente && (
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-acento-tenue px-3.5 py-3">
                      <p className="text-[12.5px]">
                        Toca la siguiente desde el {fechaDia(proforma.proximaEmision)}.
                      </p>
                      <PrepararSiguiente proformaId={proforma.id} etiqueta={`Preparar la siguiente de ${numero}`} />
                    </div>
                  )}
                  <RecurrenciaProforma proforma={proforma} sugerida={sumarUnMes(hoy)} />
                </div>
              )}

              {proforma.estado === "emitida" && (
                <div className={SECCION_DOCUMENTO}>
                  <AnularProforma proformaId={proforma.id} />
                </div>
              )}
            </section>
          </div>
        )}
      </ProveedorProforma>
    </Wrapper>
  );
}
