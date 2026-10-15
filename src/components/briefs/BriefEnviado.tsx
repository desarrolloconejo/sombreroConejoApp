import Link from "next/link";

import { AbrirVersion } from "./AccionesMisBriefs";
import { HiloAclaraciones } from "./HiloAclaraciones";
import { ContenidoBrief, cuandoBrief, diaBrief, EtiquetaBrief, SECCION_BRIEF } from "./LecturaBrief";
import type { AclaracionBrief, Brief, EstadoFormulario, VersionBrief } from "@/types";

/**
 * Un brief enviado, del lado de quien lo pidio: lo que envio tal como se
 * congelo, en que punto esta, y el hilo con el equipo. Es igual para el
 * cliente y para el prospecto; cambian las actions, que llegan atadas a la
 * identidad de cada uno.
 */

type Accion = (estado: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;

/** Mientras se puede cambiar algo: enviado, en validacion o en presupuesto (S-08). */
const VIVOS = new Set(["enviado", "en_validacion", "en_presupuesto"]);

export function BriefEnviado({
  brief,
  ultima,
  aclaraciones,
  aclarar,
  abrirVersion,
  rutaProyecto,
}: {
  brief: Brief;
  ultima: VersionBrief | undefined;
  aclaraciones: AclaracionBrief[];
  aclarar: Accion;
  abrirVersion?: Accion;
  /** Donde ver el avance del proyecto, si quien mira tiene cuenta para verlo. */
  rutaProyecto: string | null;
}) {
  const vivo = VIVOS.has(brief.estado);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <section aria-labelledby="titulo-contenido" className="surge">
        <h2 id="titulo-contenido" className="mb-3 text-[19px] font-extrabold tracking-[-0.02em]">
          Lo que enviaste{ultima && ultima.numero > 1 ? ` (version ${ultima.numero})` : ""}
        </h2>
        <div className={SECCION_BRIEF}>{ultima ? <ContenidoBrief contenido={ultima.contenido} /> : null}</div>
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
              Ya es un proyecto
              {rutaProyecto ? (
                <>
                  :{" "}
                  <Link href={rutaProyecto} className="font-semibold text-acento hover:underline">
                    ver su avance
                  </Link>
                </>
              ) : (
                ". Tu ejecutivo de cuentas te dara acceso para seguir su avance."
              )}
            </p>
          )}
          {vivo && (
            <div className="mt-4 border-t border-borde pt-3.5">
              <AbrirVersion briefId={brief.id} accion={abrirVersion} />
            </div>
          )}
        </div>

        <div className={SECCION_BRIEF}>
          <h3 className="mb-3 text-[14px] font-bold">Aclaraciones</h3>
          <HiloAclaraciones
            briefId={brief.id}
            mensajes={aclaraciones}
            accion={aclarar}
            abierto={vivo}
            vacio="Si el equipo necesita aclarar algo, te escribira aqui."
          />
        </div>
      </section>
    </div>
  );
}
