import type { Metadata } from "next";
import { PartyPopper } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { Wrapper } from "@/components/layout/Wrapper";
import { DecisionCliente, VisorVersion } from "@/components/misProyectos";
import { CopyPieza } from "@/components/piezas";
import { Alerta, Bateria, CLASE_TARJETA, segmentosDePieza, Tarjeta } from "@/components/ui";
import { conSesion } from "@/lib/db";
import { RUTA_MIS_PROYECTOS, rutaMiProyecto } from "@/lib/portal/rutas";
import { requerirEmpresa } from "@/lib/sesion";
import { comoIdentificador } from "@/lib/validaciones";
import * as piezasModelo from "@/models/piezas";
import * as proyectosModelo from "@/models/proyectos";
import * as revisionesModelo from "@/models/revisiones";
import * as versionesModelo from "@/models/versiones";
import { NOMBRES_DE_CORRECCION } from "@/types";
import { ZONA_HORARIA } from "@/lib/fechas";

/**
 * La revision de una pieza: lo que se le envio al cliente, su copy y su
 * decision. Solo se abre con la pieza en la fase 5 o ya aprobada; antes, la
 * base ni siquiera le devuelve el copy ni la version.
 */

export const metadata: Metadata = {
  title: "Revision",
};

const FECHA = new Intl.DateTimeFormat("es-VE", { timeZone: ZONA_HORARIA, dateStyle: "medium" });

export default async function PaginaRevision(
  props: PageProps<"/dashboard/mis-proyectos/[id]/piezas/[piezaId]">,
) {
  const { usuario } = await requerirEmpresa();

  const parametros = await props.params;
  const proyectoId = comoIdentificador(parametros.id);
  const piezaId = comoIdentificador(parametros.piezaId);
  if (proyectoId === null || piezaId === null) notFound();

  const datos = await conSesion(usuario, async (tx) => {
    const pieza = await piezasModelo.buscarPorId(piezaId, tx);
    if (!pieza || pieza.proyectoId !== proyectoId) return null;

    const proyecto = await proyectosModelo.buscarPorId(proyectoId, tx);
    if (!proyecto) return null;

    return {
      pieza,
      proyecto,
      version: await versionesModelo.enviadaDeRonda(piezaId, pieza.ronda, tx),
      copy: await piezasModelo.leerCopy(piezaId, tx),
      revisiones: await revisionesModelo.dePieza(piezaId, tx),
    };
  });

  if (!datos) notFound();

  const { pieza, proyecto, version, copy, revisiones } = datos;
  const enRevision = pieza.avance.faseActual === 5;
  const aprobada = pieza.avance.aprobada;
  const enCorreccion = !enRevision && !aprobada && revisiones.length > 0;

  // Lo que nunca estuvo frente al cliente no se abre: vuelve al proyecto.
  if (!enRevision && !aprobada && !enCorreccion) redirect(rutaMiProyecto(proyectoId));

  // La confirmacion de la decision que acaba de tomar.
  const hecho = (await props.searchParams).hecho;

  const migas = [
    { texto: "Conejo App", href: "/dashboard" },
    { texto: "Mis proyectos", href: RUTA_MIS_PROYECTOS },
    { texto: proyecto.nombre, href: rutaMiProyecto(proyectoId) },
    { texto: pieza.titulo },
  ];

  return (
    <Wrapper
      migas={migas}
      kicker={aprobada ? "Aprobada" : enCorreccion ? "En correccion" : "Espera tu revision"}
      titulo={pieza.titulo}
      descripcion={pieza.ronda > 1 ? `Ronda ${pieza.ronda}: ya incluye la correccion que pediste.` : undefined}
    >
      {hecho === "aprobada" && aprobada && (
        <Alerta tono="logro" icono={<PartyPopper />} className="mb-5">
          <b className="font-semibold">«{pieza.titulo}» aprobada. Ya puedes descargarla.</b>
        </Alerta>
      )}
      {hecho === "correccion" && enCorreccion && (
        <Alerta tono="info" className="surge mb-5">
          <b className="font-semibold">Correccion enviada. El equipo ya la tiene.</b> Te avisaremos
          cuando la nueva version este lista para revisar.
        </Alerta>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section aria-label="La pieza" className="surge [--retraso:0.1s]">
          {enCorreccion ? (
            <p className="rounded-[15px] border border-borde bg-superficie px-5 py-8 text-center text-[13px] text-suave">
              El equipo trabaja en la correccion (ronda {pieza.ronda}). La nueva version aparecera
              aqui cuando este lista para que la revises.
            </p>
          ) : version ? (
            <VisorVersion version={version} aprobada={aprobada} />
          ) : (
            <p className="rounded-[15px] border border-borde bg-superficie px-5 py-8 text-center text-[13px] text-suave">
              Esta pieza no tiene archivo que mostrar.
            </p>
          )}
        </section>

        <div className="surge flex flex-col gap-6 [--retraso:0.16s]">
          <section aria-label="Avance de la pieza" className={`${CLASE_TARJETA} flex flex-wrap items-center gap-x-5 gap-y-3`}>
            <Bateria
              segmentos={segmentosDePieza(pieza.fases)}
              porcentaje={pieza.avance.porcentaje}
              etiqueta="Avance de la pieza"
            />
            <p className="text-[13px] font-semibold">
              {aprobada
                ? "Aprobada"
                : enCorreccion
                  ? `En correccion · fase ${pieza.avance.faseActual} de 5`
                  : "Fase 5 de 5 · tu revision"}
            </p>
          </section>

          {enRevision && (
            <Tarjeta id="titulo-decision" titulo="Tu decision" className="border-acento!">
              {usuario.puedeAprobar ? (
                <DecisionCliente piezaId={piezaId} tipo={proyecto.tipo} />
              ) : (
                <Alerta tono="info">
                  Decidir sobre las piezas es de quien tiene ese permiso en tu empresa. Puedes verla
                  y copiar su texto; para aprobar, pidelo a la agencia.
                </Alerta>
              )}
            </Tarjeta>
          )}

          {copy !== null && (
            <Tarjeta id="titulo-copy-cliente" titulo="Texto de la publicacion">
              <CopyPieza piezaId={piezaId} copy={copy} editable={false} />
            </Tarjeta>
          )}

          {revisiones.length > 0 && (
            <Tarjeta id="titulo-historial" titulo="Historial">
              <ul className="flex flex-col gap-2.5">
                {revisiones.map((revision) => (
                  <li key={revision.id} className="rounded-xl bg-campo px-4 py-3 text-[12.5px] leading-relaxed">
                    <b className="font-semibold">Ronda {revision.ronda}:</b>{" "}
                    {revision.decision === "aprobada"
                      ? "aprobada"
                      : `correccion de ${NOMBRES_DE_CORRECCION[revision.tipoCorreccion ?? "ambas"].toLowerCase()}`}{" "}
                    <span className="text-suave">
                      · {revision.autorNombre} · {FECHA.format(new Date(revision.creadaEn))}
                    </span>
                    {revision.comentario && <p className="mt-1 text-suave">«{revision.comentario}»</p>}
                  </li>
                ))}
              </ul>
            </Tarjeta>
          )}
        </div>
      </div>
    </Wrapper>
  );
}
