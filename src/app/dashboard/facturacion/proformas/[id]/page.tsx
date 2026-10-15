import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  EtiquetaDocumento,
  fechaHora,
  ResumenImportes,
  SECCION_DOCUMENTO,
  TablaRenglones,
} from "@/components/finanzas";
import { Wrapper } from "@/components/layout/Wrapper";
import { conSesion } from "@/lib/db";
import { numeroDe } from "@/lib/finanzas/documentos";
import { RUTA_FACTURACION, rutaMiPresupuesto } from "@/lib/finanzas/rutas";
import { requerirFinanzasDeEmpresa } from "@/lib/sesion";
import { comoIdentificador } from "@/lib/validaciones";
import * as proformasModelo from "@/models/proformas";
import * as renglonesModelo from "@/models/renglones";

export const metadata: Metadata = {
  title: "Proforma",
};

/**
 * Una proforma emitida, como la ve el cliente: solo lectura. Lo que se le va
 * a facturar, y a que proyectos corresponde.
 */
export default async function PaginaMiProforma(
  props: PageProps<"/dashboard/facturacion/proformas/[id]">,
) {
  const { usuario } = await requerirFinanzasDeEmpresa();

  const id = comoIdentificador((await props.params).id);
  if (id === null) notFound();

  const datos = await conSesion(usuario, async (tx) => {
    const proforma = await proformasModelo.buscarPorId(id, tx);
    if (!proforma) return null;

    return {
      proforma,
      renglones: await renglonesModelo.deDocumento("proforma", id, tx),
      proyectos: await proformasModelo.proyectosDe(id, tx),
    };
  });

  if (!datos) notFound();

  const { proforma, renglones, proyectos } = datos;
  const numero = numeroDe("proforma", proforma.numero);

  const migas = [
    { texto: "Conejo App", href: "/dashboard" },
    { texto: "Facturacion", href: RUTA_FACTURACION },
    { texto: numero },
  ];

  return (
    <Wrapper migas={migas} kicker={`Proforma ${numero}`} titulo={proforma.titulo}>
      <div className="surge flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-suave">
        <EtiquetaDocumento situacion={proforma.estado} />
        <span>Emitida el {fechaHora(proforma.emitidaEn)}</span>
        {proforma.presupuestoId !== null && proforma.presupuestoNumero !== null && (
          <span>
            Del presupuesto{" "}
            <Link href={rutaMiPresupuesto(proforma.presupuestoId)} className="font-semibold text-acento hover:underline">
              {numeroDe("presupuesto", proforma.presupuestoNumero)}
            </Link>
          </span>
        )}
      </div>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section aria-labelledby="titulo-renglones" className="surge [--retraso:0.06s]">
          <h2 id="titulo-renglones" className="mb-3 text-[19px] font-extrabold tracking-[-0.02em]">
            Lo que incluye
          </h2>
          <div className={SECCION_DOCUMENTO}>
            <TablaRenglones renglones={renglones} />
            <div className="mt-4 border-t border-borde pt-4">
              <ResumenImportes importes={proforma} />
            </div>
          </div>
        </section>

        <section aria-labelledby="titulo-proyectos" className="surge [--retraso:0.1s]">
          <h2 id="titulo-proyectos" className="mb-3 text-[19px] font-extrabold tracking-[-0.02em]">
            Proyectos
          </h2>
          <div className={SECCION_DOCUMENTO}>
            {proyectos.length === 0 ? (
              <p className="text-[13px] text-suave">No corresponde a un proyecto en concreto.</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-[13.5px]">
                {proyectos.map((proyecto) => (
                  <li key={proyecto.id} className="font-semibold">
                    {proyecto.nombre}
                  </li>
                ))}
              </ul>
            )}
            {proforma.notas && (
              <p className="mt-4 whitespace-pre-line border-t border-borde pt-4 text-[13px] leading-relaxed text-suave">
                {proforma.notas}
              </p>
            )}
          </div>
        </section>
      </div>
    </Wrapper>
  );
}
