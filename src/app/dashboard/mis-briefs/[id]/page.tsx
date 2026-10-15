import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { aclararMiBrief, enviarMiBrief, guardarMiBrief } from "@/actions/misBriefs";
import {
  ContenidoBrief,
  cuandoBrief,
  diaBrief,
  EtiquetaBrief,
  FormularioBrief,
  HiloAclaraciones,
  ProveedorEnvioBrief,
  SECCION_BRIEF,
} from "@/components/briefs";
import { AbrirVersion } from "@/components/briefs/AccionesMisBriefs";
import { Wrapper } from "@/components/layout/Wrapper";
import { conSesion } from "@/lib/db";
import { formatoPor } from "@/lib/portal/briefs";
import { hoyEnCaracas } from "@/lib/portal/fases";
import { RUTA_MIS_BRIEFS, rutaMiProyecto } from "@/lib/portal/rutas";
import { requerirEmpresa } from "@/lib/sesion";
import { comoIdentificador } from "@/lib/validaciones";
import * as briefsModelo from "@/models/briefs";

export const metadata: Metadata = {
  title: "Brief",
};

/** Mientras se puede cambiar algo: enviado, en validacion o en presupuesto (S-08). */
const VIVOS = new Set(["enviado", "en_validacion", "en_presupuesto"]);

/**
 * Un brief de la empresa. Con un borrador abierto es su formulario; si no, lo
 * enviado tal como se congelo, sus fechas y el hilo con el equipo.
 */
export default async function PaginaMiBrief(props: PageProps<"/dashboard/mis-briefs/[id]">) {
  const { usuario } = await requerirEmpresa();

  const id = comoIdentificador((await props.params).id);
  if (id === null) notFound();

  const datos = await conSesion(usuario, async (tx) => {
    const brief = await briefsModelo.buscarPorId(id, tx);
    if (!brief) return null;

    return {
      brief,
      borrador: brief.borradorAbierto ? await briefsModelo.borradorDe(id, tx) : null,
      versiones: await briefsModelo.versionesDe(id, tx),
      aclaraciones: await briefsModelo.aclaracionesDe(id, tx),
    };
  });

  if (!datos) notFound();

  const { brief, borrador, versiones, aclaraciones } = datos;
  const formato = formatoPor(brief.formato, brief.formatoVersion);
  if (!formato) notFound();

  const ultima = versiones.at(-1);
  const migas = [
    { texto: "Conejo App", href: "/dashboard" },
    { texto: "Mis briefs", href: RUTA_MIS_BRIEFS },
    { texto: brief.codigo ?? "Borrador" },
  ];

  return (
    <Wrapper
      migas={migas}
      kicker={brief.codigo ? `Brief ${brief.codigo}` : "Borrador"}
      titulo={formato.nombre}
      descripcion={formato.lema}
    >
      <ProveedorEnvioBrief accion={enviarMiBrief}>
        {borrador ? (
          <FormularioBrief
            briefId={brief.id}
            formato={formato}
            iniciales={borrador.respuestas}
            fechaInicial={borrador.fechaAspirada}
            hoy={hoyEnCaracas()}
            version={brief.versionActual + 1}
            guardar={guardarMiBrief}
          />
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <section aria-labelledby="titulo-contenido" className="surge">
              <h2 id="titulo-contenido" className="mb-3 text-[19px] font-extrabold tracking-[-0.02em]">
                Lo que enviaste{ultima && ultima.numero > 1 ? ` (version ${ultima.numero})` : ""}
              </h2>
              <div className={SECCION_BRIEF}>
                {ultima ? <ContenidoBrief contenido={ultima.contenido} /> : null}
              </div>
            </section>

            <section aria-labelledby="titulo-estado" className="surge flex flex-col gap-4 [--retraso:0.06s]">
              <h2 id="titulo-estado" className="text-[19px] font-extrabold tracking-[-0.02em]">
                En que punto esta
              </h2>
              <div className={SECCION_BRIEF}>
                <EtiquetaBrief estado={brief.estado} />
                <dl className="mt-3 flex flex-col gap-2 text-[13px]">
                  <div className="flex justify-between gap-4">
                    <dt className="text-suave">Enviado</dt>
                    <dd className="text-right">{cuandoBrief(brief.enviadoEn)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-suave">Fecha que aspiras</dt>
                    <dd className="text-right">{diaBrief(brief.fechaAspirada)}</dd>
                  </div>
                  {brief.fechaPropuesta && (
                    <div className="border-t border-borde pt-2">
                      <dt className="text-suave">Fecha que te proponemos</dt>
                      <dd className="font-semibold">{diaBrief(brief.fechaPropuesta)}</dd>
                      {brief.motivoFechaPropuesta && (
                        <dd className="mt-1 text-[12.5px] leading-relaxed text-suave">{brief.motivoFechaPropuesta}</dd>
                      )}
                    </div>
                  )}
                  {brief.motivoDescarte && (
                    <div className="border-t border-borde pt-2">
                      <dt className="text-suave">Por que no seguimos</dt>
                      <dd className="mt-1 leading-relaxed">{brief.motivoDescarte}</dd>
                    </div>
                  )}
                </dl>
                {brief.proyectoId !== null && (
                  <p className="mt-3 border-t border-borde pt-3 text-[13px]">
                    Ya es un proyecto:{" "}
                    <Link href={rutaMiProyecto(brief.proyectoId)} className="font-semibold text-acento hover:underline">
                      ver su avance
                    </Link>
                  </p>
                )}
                {VIVOS.has(brief.estado) && (
                  <div className="mt-4 border-t border-borde pt-3.5">
                    <AbrirVersion briefId={brief.id} />
                  </div>
                )}
              </div>

              <div className={SECCION_BRIEF}>
                <h3 className="mb-3 text-[14px] font-bold">Aclaraciones</h3>
                <HiloAclaraciones
                  briefId={brief.id}
                  mensajes={aclaraciones}
                  accion={aclararMiBrief}
                  abierto={VIVOS.has(brief.estado)}
                  vacio="Si el equipo necesita aclarar algo, te escribira aqui."
                />
              </div>
            </section>
          </div>
        )}
      </ProveedorEnvioBrief>
    </Wrapper>
  );
}
