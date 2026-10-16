import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { aclararBrief } from "@/actions/briefs";
import {
  BotonesDecision,
  ContenidoBrief,
  cuandoBrief,
  diaBrief,
  EtiquetaBrief,
  FechaViable,
  HiloAclaraciones,
  ProveedorDecisiones,
  TarjetaBrief,
} from "@/components/briefs";
import { Wrapper } from "@/components/layout/Wrapper";
import { conSesion } from "@/lib/db";
import { rutaPresupuesto } from "@/lib/finanzas/rutas";
import { cambiosEntre, contarNoSe, formatoPor, respuestasDesdeContenido } from "@/lib/portal/briefs";
import { hoyEnCaracas } from "@/lib/portal/fases";
import { RUTA_BRIEFS, rutaProyecto } from "@/lib/portal/rutas";
import { requerirCargo } from "@/lib/sesion";
import { comoIdentificador } from "@/lib/validaciones";
import * as briefsModelo from "@/models/briefs";

export const metadata: Metadata = {
  title: "Brief",
};

const VIVOS = new Set(["enviado", "en_validacion", "en_presupuesto"]);

/**
 * Un brief recibido: lo que se envio (y que cambio entre versiones), sus
 * fechas, el hilo con el cliente y las decisiones. Lo abre tambien
 * administracion, para armar su presupuesto; las decisiones son de cuentas.
 */
export default async function PaginaBrief(props: PageProps<"/dashboard/briefs/[id]">) {
  const usuario = await requerirCargo("cuentas", "administracion");

  const id = comoIdentificador((await props.params).id);
  if (id === null) notFound();

  const datos = await conSesion(usuario, async (tx) => {
    const brief = await briefsModelo.buscarPorId(id, tx);
    if (!brief || brief.codigo === null) return null;
    return {
      brief,
      versiones: await briefsModelo.versionesDe(id, tx),
      aclaraciones: await briefsModelo.aclaracionesDe(id, tx),
    };
  });

  if (!datos) notFound();

  const { brief, versiones, aclaraciones } = datos;
  const formato = formatoPor(brief.formato, brief.formatoVersion);
  const ultima = versiones.at(-1);
  const anterior = versiones.length > 1 ? versiones.at(-2) : undefined;
  const cambios = ultima && anterior ? cambiosEntre(anterior.contenido, ultima.contenido) : [];
  const noSe = formato && ultima ? contarNoSe(formato, respuestasDesdeContenido(ultima.contenido)) : 0;

  const decide = usuario.rol === "admin" || usuario.cargoSlug === "cuentas";
  const presupuestoResuelto =
    brief.estado === "en_presupuesto" &&
    (brief.presupuestoEstado === "rechazado" || brief.presupuestoVencido);
  const puedeAceptar =
    brief.estado === "enviado" || (brief.estado === "en_presupuesto" && brief.presupuestoEstado === "aprobado");
  const puedePresupuestar = brief.estado === "enviado" || presupuestoResuelto;
  const puedeDescartar = brief.estado === "enviado" || presupuestoResuelto;

  const migas = [
    { texto: "Conejo App", href: "/dashboard" },
    { texto: "Briefs", href: RUTA_BRIEFS },
    { texto: brief.codigo ?? "Brief" },
  ];

  return (
    <Wrapper
      migas={migas}
      kicker={`${brief.codigo}${brief.empresaId === null ? " · prospecto" : ""}`}
      titulo={brief.solicitante}
      descripcion={`${formato?.nombre ?? brief.formato} · version ${brief.versionActual}`}
    >
      <ProveedorDecisiones>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-6">
            {cambios.length > 0 && (
              <TarjetaBrief id="titulo-cambios" titulo={`Que cambio en la version ${ultima?.numero}`} className="surge">
                  <ul aria-label="Cambios entre versiones" className="flex flex-col">
                    {cambios.map((cambio) => (
                      <li key={cambio.clave} className="border-b border-borde/70 py-2.5 last:border-0">
                        <p className="text-[12.5px] font-semibold">{cambio.pregunta}</p>
                        <p className="mt-1 text-[12.5px] text-suave line-through">{cambio.antes}</p>
                        <p className="text-[13.5px]">{cambio.despues}</p>
                      </li>
                    ))}
                  </ul>
              </TarjetaBrief>
            )}

            <TarjetaBrief id="titulo-contenido" titulo="Brief completo" className="surge [--retraso:0.04s]">
              {ultima ? <ContenidoBrief contenido={ultima.contenido} /> : null}
            </TarjetaBrief>
          </div>

          <div className="surge flex flex-col gap-4 [--retraso:0.08s]">
            <TarjetaBrief id="titulo-estado" titulo="Estado" extra={<EtiquetaBrief estado={brief.estado} />}>
              {brief.estado === "enviado" && (
                <p className="-mt-2 mb-3 text-[12px] text-suave">Fase 0 · brief recibido</p>
              )}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
                <div>
                  <dt className="text-[11.5px] text-suave">Enviado</dt>
                  <dd className="font-semibold">{cuandoBrief(brief.enviadoEn)}</dd>
                </div>
                <div>
                  <dt className="text-[11.5px] text-suave">Fecha que aspira</dt>
                  <dd className="font-semibold">{diaBrief(brief.fechaAspirada)}</dd>
                </div>
                <div>
                  <dt className="text-[11.5px] text-suave">Origen</dt>
                  <dd className="font-semibold">{brief.empresaId === null ? "Enlace privado" : "Su cuenta"}</dd>
                </div>
                <div>
                  <dt className="text-[11.5px] text-suave">«No se»</dt>
                  <dd className="font-semibold">{noSe === 0 ? "Ninguno" : `${noSe} para la reunion`}</dd>
                </div>
              </dl>
              {brief.motivoDescarte && (
                <p className="mt-3 border-t border-borde pt-3 text-[13px]">
                  <span className="block text-[11.5px] text-suave">Motivo del descarte</span>
                  {brief.motivoDescarte}
                </p>
              )}
              {brief.proyectoId !== null && (
                <p className="mt-3 border-t border-borde pt-3 text-[13px]">
                  <Link href={rutaProyecto(brief.proyectoId)} className="font-semibold text-acento hover:underline">
                    Abrir su proyecto
                  </Link>
                  {brief.estado === "en_validacion" && (
                    <span className="block text-[12px] text-suave">Completar su fase 1 valida el brief.</span>
                  )}
                </p>
              )}
              {brief.presupuestoId !== null && (
                <p className="mt-3 border-t border-borde pt-3 text-[13px]">
                  <Link href={rutaPresupuesto(brief.presupuestoId)} className="font-semibold text-acento hover:underline">
                    Ver su presupuesto
                  </Link>
                </p>
              )}
            </TarjetaBrief>

            {decide && VIVOS.has(brief.estado) && brief.fechaAspirada && (
              <TarjetaBrief id="titulo-fecha" titulo="Fecha de entrega">
                <FechaViable
                  briefId={brief.id}
                  fechaAspirada={diaBrief(brief.fechaAspirada)}
                  fechaPropuesta={brief.fechaPropuesta}
                  motivo={brief.motivoFechaPropuesta}
                  hoy={hoyEnCaracas()}
                />
              </TarjetaBrief>
            )}

            {decide && (puedeAceptar || puedePresupuestar || puedeDescartar) && (
              <TarjetaBrief id="titulo-decision" titulo="Decision">
                <BotonesDecision
                  briefId={brief.id}
                  aceptar={puedeAceptar}
                  presupuestar={puedePresupuestar}
                  descartar={puedeDescartar}
                />
                <p className="mt-3 text-[12px] leading-relaxed text-suave">
                  Convertir en presupuesto lo pasa a la cola de administracion. Al descartar, el
                  cliente recibe el motivo y el brief queda archivado.
                </p>
              </TarjetaBrief>
            )}

            <TarjetaBrief id="titulo-aclaraciones" titulo="Aclaraciones">
              <HiloAclaraciones
                briefId={brief.id}
                mensajes={aclaraciones}
                accion={aclararBrief}
                abierto={VIVOS.has(brief.estado)}
                vacio="Pide aqui lo que falte. El cliente lo responde desde su cuenta."
              />
            </TarjetaBrief>
          </div>
        </div>
      </ProveedorDecisiones>
    </Wrapper>
  );
}

