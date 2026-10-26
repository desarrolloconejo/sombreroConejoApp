import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Ban, Pencil } from "lucide-react";

import { Wrapper } from "@/components/layout/Wrapper";
import { ModalConfirmacion, PanelLateral } from "@/components/listado";
import {
  CabeceraPieza,
  CancelarPieza,
  ComentariosPieza,
  CopyPieza,
  EditarPieza,
  FasesPieza,
  RevisionesPieza,
  VersionesPieza,
} from "@/components/piezas";
import { Alerta, BotonEnlace, Tarjeta } from "@/components/ui";
import { conSesion } from "@/lib/db";
import { leerEstadoListado } from "@/lib/parametros";
import { servicioPorSlug } from "@/lib/portal/catalogo";
import { rutaAjustable } from "@/lib/portal/fases";
import { RUTA_PROYECTOS, rutaPieza, rutaProyecto } from "@/lib/portal/rutas";
import { requerirRol } from "@/lib/sesion";
import { conPanel } from "@/lib/urlListado";
import { comoIdentificador } from "@/lib/validaciones";
import * as clientesModelo from "@/models/clientes";
import * as comentariosModelo from "@/models/comentariosPieza";
import * as piezasModelo from "@/models/piezas";
import * as proyectosModelo from "@/models/proyectos";
import * as revisionesModelo from "@/models/revisiones";
import * as tareasModelo from "@/models/tareas";
import * as usuariosModelo from "@/models/usuarios";
import * as versionesModelo from "@/models/versiones";

/**
 * La ficha de una pieza: sus cinco fases con sus tareas, su copy y la
 * conversacion interna.
 *
 * La abren quien gestiona el proyecto y quien trabaja en la pieza. El primero
 * la mueve; el segundo marca sus tareas y escribe el copy. Para cualquier otro
 * la pieza no existe: la base no la devuelve.
 */

export const metadata: Metadata = {
  title: "Pieza",
};

/** El titulo de cada columna: los dos iguales, para que arranquen a la par. */
const TITULO_COLUMNA = "mb-4 text-[19px] font-extrabold tracking-[-0.02em]";

export default async function PaginaPieza(
  props: PageProps<"/dashboard/proyectos/[id]/piezas/[piezaId]">,
) {
  const usuario = await requerirRol("admin", "trabajador");

  const parametros = await props.params;
  const proyectoId = comoIdentificador(parametros.id);
  const piezaId = comoIdentificador(parametros.piezaId);
  if (proyectoId === null || piezaId === null) notFound();

  const estado = leerEstadoListado(await props.searchParams, {
    ordenPermitido: ["fase"],
    ordenPorDefecto: "fase",
    direccionPorDefecto: "asc",
    filtrosPermitidos: [],
  });

  const datos = await conSesion(usuario, async (tx) => {
    const pieza = await piezasModelo.buscarPorId(piezaId, tx);

    // La pieza tiene que ser de ESTE proyecto: una URL armada a mano con otro
    // proyecto no debe pintar migas falsas.
    if (!pieza || pieza.proyectoId !== proyectoId) return null;

    const proyecto = await proyectosModelo.buscarPorId(proyectoId, tx);
    if (!proyecto) return null;

    const gestiona = await proyectosModelo.gestiona(proyectoId, tx);

    return {
      pieza,
      proyecto,
      gestiona,
      tareas: await tareasModelo.dePieza(piezaId, tx),
      comentarios: await comentariosModelo.dePieza(piezaId, tx),
      copy: (await piezasModelo.leerCopy(piezaId, tx)) ?? "",
      equipo: gestiona ? await usuariosModelo.equipo(tx) : [],
      versiones: await versionesModelo.dePieza(piezaId, tx),
      revisiones: await revisionesModelo.dePieza(piezaId, tx),
      puedeTrabajar: await piezasModelo.puedeTrabajar(piezaId, tx),
      // C1: si nadie de la empresa puede aprobar, el ejecutivo lo tiene que saber.
      aprobadores: gestiona ? (await clientesModelo.aprobadoresDe(proyecto.empresaId, tx)).length : null,
    };
  });

  if (!datos) notFound();

  const {
    pieza,
    proyecto,
    gestiona,
    tareas,
    comentarios,
    copy,
    equipo,
    versiones,
    revisiones,
    puedeTrabajar,
    aprobadores,
  } = datos;
  const ruta = rutaPieza(proyectoId, piezaId);
  const hrefCerrar = conPanel(ruta, estado, null);
  const activa = pieza.estado === "activa";
  const tipos = servicioPorSlug(proyecto.servicio)?.tiposDePieza ?? [pieza.tipo];

  const migas = [
    { texto: "Conejo App", href: "/dashboard" },
    { texto: "Proyectos", href: RUTA_PROYECTOS },
    { texto: proyecto.nombre, href: rutaProyecto(proyectoId) },
    { texto: pieza.titulo },
  ];

  return (
    <Wrapper
      migas={migas}
      kicker={`${proyecto.empresaNombre} · Pieza ${String(pieza.orden).padStart(2, "0")}`}
      titulo={pieza.titulo}
    >
      <CabeceraPieza
        pieza={pieza}
        tipo={proyecto.tipo}
        acciones={
          gestiona &&
          activa && (
            <>
              <BotonEnlace href={conPanel(ruta, estado, "editar")} variante="fantasma" tamano="chico">
                <Pencil aria-hidden="true" />
                Editar
              </BotonEnlace>
              <BotonEnlace href={conPanel(ruta, estado, "estado")} variante="fantasma" tamano="chico">
                <Ban aria-hidden="true" />
                Cancelar pieza
              </BotonEnlace>
            </>
          )
        }
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section aria-labelledby="titulo-fases" className="surge [--retraso:0.14s]">
          <h2 id="titulo-fases" className={TITULO_COLUMNA}>
            Fases y tareas
          </h2>
          <FasesPieza
            pieza={pieza}
            tipo={proyecto.tipo}
            tareas={tareas}
            comentarios={comentarios}
            versiones={versiones}
            gestiona={gestiona}
            usuarioId={usuario.id}
            equipo={equipo}
          />
        </section>

        <div className="surge flex flex-col gap-6 [--retraso:0.18s]">
          <p aria-hidden="true" className={`${TITULO_COLUMNA} -mb-2`}>
            Entrega
          </p>
          {gestiona && aprobadores === 0 && (pieza.avance.faseActual ?? 0) >= 4 && (
            <Alerta>
              <b className="font-semibold">Nadie de {proyecto.empresaNombre} puede aprobar.</b>{" "}
              Hasta que un administrador marque a alguien en Usuarios, la pieza no
              se podra aprobar ni corregir.
            </Alerta>
          )}

          <Tarjeta id="titulo-versiones" titulo="Versiones">
            <VersionesPieza
              piezaId={piezaId}
              versiones={versiones}
              puedeSubir={puedeTrabajar && activa}
            />
          </Tarjeta>

          <Tarjeta id="titulo-copy" titulo="Copy">
            <CopyPieza piezaId={piezaId} copy={copy} editable={activa} />
            <p className="mt-3 text-[11.5px] leading-relaxed text-suave">
              El cliente lo ve cuando la pieza llega a la fase 5.
            </p>
          </Tarjeta>

          <Tarjeta id="titulo-revisiones" titulo="Decisiones del cliente">
            <RevisionesPieza
              piezaId={piezaId}
              tipo={proyecto.tipo}
              revisiones={revisiones}
              ajustable={gestiona && activa && rutaAjustable(pieza.fases, pieza.ronda)}
            />
          </Tarjeta>

          <Tarjeta id="titulo-comentarios" titulo="Comentarios generales">
            <ComentariosPieza piezaId={piezaId} comentarios={comentarios} />
          </Tarjeta>
        </div>
      </div>

      {gestiona && activa && estado.panel === "editar" && (
        <PanelLateral
          hrefCerrar={hrefCerrar}
          kicker="Editar pieza"
          titulo={pieza.titulo}
          descripcion="El orden en la matriz no cambia."
        >
          <EditarPieza pieza={pieza} tipos={tipos} equipo={equipo} hrefCancelar={hrefCerrar} />
        </PanelLateral>
      )}

      {/* Sin exigir que este activa: al cancelarla, el modal tiene que seguir
          ahi para dar el aviso y el boton de cerrar. */}
      {gestiona && estado.panel === "estado" && (
        <ModalConfirmacion hrefCerrar={hrefCerrar} tono="aviso" kicker="Cancelar" titulo="¿Cancelar esta pieza?">
          <CancelarPieza pieza={pieza} hrefCerrar={hrefCerrar} />
        </ModalConfirmacion>
      )}
    </Wrapper>
  );
}
