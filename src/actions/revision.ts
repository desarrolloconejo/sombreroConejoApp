"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { anotar } from "@/lib/auditoria";
import { conSesion, type Ejecutor } from "@/lib/db";
import { notificarA } from "@/lib/notificaciones";
import { nombreDeFase } from "@/lib/portal/catalogo";
import { rutaDeCorreccion } from "@/lib/portal/fases";
import {
  RUTA_MIS_PROYECTOS,
  rutaMiPieza,
  rutaMiProyecto,
  rutaPieza,
  rutaProyecto,
} from "@/lib/portal/rutas";
import { requerirEmpresa } from "@/lib/sesion";
import { comoIdentificador, LIMITES, limpiarTexto } from "@/lib/validaciones";
import * as piezas from "@/models/piezas";
import * as proyectos from "@/models/proyectos";
import * as revisiones from "@/models/revisiones";
import * as versiones from "@/models/versiones";
import type { EstadoFormulario, TipoCorreccion, UsuarioCompleto } from "@/types";

/**
 * La decision del cliente en la fase 5: aprobar la pieza o pedir una
 * correccion.
 *
 * Solo decide quien tiene el permiso de aprobar de su empresa. La base lo
 * vuelve a comprobar: la decision se guarda con una politica que lo exige, y
 * las fases las mueve `portal.decidir_fase_5`, la unica via del cliente.
 */

/** Por que no se pudo decidir sobre una pieza. */
class NoSePudo extends Error {}

function revalidar(proyectoId: number, piezaId: number): void {
  revalidatePath(RUTA_MIS_PROYECTOS);
  revalidatePath(rutaMiProyecto(proyectoId));
  revalidatePath(rutaMiPieza(proyectoId, piezaId));
  revalidatePath(rutaProyecto(proyectoId));
  revalidatePath(rutaPieza(proyectoId, piezaId));
  revalidatePath("/dashboard");
}

/**
 * Decide sobre una pieza dentro de la transaccion en curso. Lanza `NoSePudo`
 * con el motivo si algo no cuadra: en un lote, eso deshace todo.
 */
async function decidir(
  tx: Ejecutor,
  usuario: UsuarioCompleto,
  piezaId: number,
  decision: { aprobar: true } | { aprobar: false; tipo: TipoCorreccion; comentario: string },
): Promise<{ proyectoId: number; piezaId: number; titulo: string }> {
  const pieza = await piezas.buscarPorId(piezaId, tx);
  if (!pieza) throw new NoSePudo("Esa pieza ya no esta a tu alcance.");

  const proyecto = await proyectos.buscarPorId(pieza.proyectoId, tx);
  if (!proyecto) throw new NoSePudo("Esa pieza ya no esta a tu alcance.");

  if (pieza.avance.faseActual !== 5) {
    throw new NoSePudo(`«${pieza.titulo}» ya no esta esperando tu decision.`);
  }

  const enviada = await versiones.enviadaDeRonda(piezaId, pieza.ronda, tx);
  const reabre = decision.aprobar ? [] : rutaDeCorreccion(proyecto.tipo, decision.tipo).reabre;

  try {
    await revisiones.crear(
      {
        piezaId,
        ronda: pieza.ronda,
        aprobar: decision.aprobar,
        tipoCorreccion: decision.aprobar ? null : decision.tipo,
        comentario: decision.aprobar ? null : decision.comentario,
        fasesReabiertas: reabre,
        versionId: enviada?.id ?? null,
      },
      usuario.id,
      tx,
    );
    await revisiones.aplicarDecision(piezaId, decision.aprobar, reabre, tx);
  } catch (error) {
    const codigo = (error as { code?: string }).code;
    if (codigo === "42501") throw new NoSePudo("No tienes permiso para decidir por tu empresa.");
    // 23505: otra persona decidio sobre la misma pieza a la vez y gano.
    if (codigo === "23505" || codigo === "23514") {
      throw new NoSePudo(`«${pieza.titulo}» ya no esta esperando tu decision.`);
    }
    throw error;
  }

  await anotar(tx, usuario, decision.aprobar ? "pieza.aprobada" : "pieza.correccion_pedida", {
    entidad: "pieza",
    entidadId: piezaId,
    empresaId: proyecto.empresaId,
    despues: decision.aprobar
      ? { ronda: pieza.ronda, titulo: pieza.titulo }
      : { ronda: pieza.ronda, tipo: decision.tipo, reabre: reabre.join(",") },
  });

  // Se avisa al ejecutivo y, si es una correccion, a quien lleva las fases
  // que vuelven a abrirse.
  const responsables = decision.aprobar
    ? []
    : pieza.fases
        .filter((fase) => reabre.includes(fase.fase) && fase.responsableId !== null)
        .map((fase) => fase.responsableId as number);

  await notificarA(tx, [proyecto.ejecutivoId, ...responsables], {
    tipo: decision.aprobar ? "pieza.aprobada" : "pieza.correccion",
    titulo: decision.aprobar
      ? `${proyecto.empresaNombre} aprobo «${pieza.titulo}»`
      : `${proyecto.empresaNombre} pidio corregir «${pieza.titulo}»`,
    cuerpo: decision.aprobar
      ? `Del proyecto ${proyecto.nombre}.`
      : `Vuelve a ${nombreDeFase(proyecto.tipo, Math.min(...reabre) as 1)}: «${decision.comentario}»`,
    href: rutaPieza(proyecto.id, piezaId),
    empresaId: proyecto.empresaId,
  });

  return { proyectoId: proyecto.id, piezaId, titulo: pieza.titulo };
}

const TIPOS: readonly TipoCorreccion[] = ["redaccion", "diseno", "ambas"];

/** Aprobar o pedir correccion de una pieza. */
export async function decidirPieza(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const { usuario } = await requerirEmpresa();

  const piezaId = comoIdentificador(datos.get("piezaId"));
  if (piezaId === null) return { ok: false, mensaje: "Esa pieza ya no esta a tu alcance" };

  if (!usuario.puedeAprobar) {
    return { ok: false, mensaje: "No tienes permiso para decidir por tu empresa" };
  }

  const aprobar = datos.get("decision") === "aprobar";

  // Las casillas: redaccion, diseno, o las dos.
  const marcadas = datos.getAll("corregir");
  const tipo: TipoCorreccion | null =
    marcadas.includes("redaccion") && marcadas.includes("diseno")
      ? "ambas"
      : (TIPOS.find((valor) => marcadas.includes(valor)) ?? null);
  const comentario = limpiarTexto(datos.get("comentario"), LIMITES.comentario);

  if (!aprobar) {
    const errores: Record<string, string> = {};
    if (!tipo) errores.corregir = "Marca que hay que corregir";
    if (!comentario) errores.comentario = "Cuentanos que cambiar";
    if (Object.keys(errores).length > 0) return { ok: false, errores };
  }

  let hecho: { proyectoId: number };

  try {
    hecho = await conSesion(usuario, (tx) =>
      decidir(
        tx,
        usuario,
        piezaId,
        aprobar ? { aprobar: true } : { aprobar: false, tipo: tipo as TipoCorreccion, comentario },
      ),
    );
  } catch (error) {
    if (error instanceof NoSePudo) return { ok: false, mensaje: error.message };
    throw error;
  }

  revalidar(hecho.proyectoId, piezaId);

  /*
   * La confirmacion la pinta la page, no un aviso del formulario: decidir saca
   * a la pieza de la fase 5, la pantalla se rehace sin el formulario, y su
   * aviso se perderia con el.
   */
  redirect(`${rutaMiPieza(hecho.proyectoId, piezaId)}?hecho=${aprobar ? "aprobada" : "correccion"}`);
}

/**
 * Aprueba varias piezas de una vez: todas o ninguna. Si una falla, se deshace
 * el lote entero y se dice cual.
 */
export async function aprobarVarias(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const { usuario } = await requerirEmpresa();

  if (!usuario.puedeAprobar) {
    return { ok: false, mensaje: "No tienes permiso para decidir por tu empresa" };
  }

  const ids = [
    ...new Set(
      datos
        .getAll("piezaId")
        .map(comoIdentificador)
        .filter((id): id is number => id !== null),
    ),
  ];

  if (ids.length === 0) return { ok: false, mensaje: "Marca las piezas que apruebas" };

  try {
    const hechas = await conSesion(usuario, async (tx) => {
      const resultado = [];
      for (const id of ids) resultado.push(await decidir(tx, usuario, id, { aprobar: true }));
      return resultado;
    });

    for (const hecha of hechas) revalidar(hecha.proyectoId, hecha.piezaId);

    return {
      ok: true,
      mensaje: hechas.length === 1 ? "Pieza aprobada" : `${hechas.length} piezas aprobadas`,
    };
  } catch (error) {
    if (error instanceof NoSePudo) {
      return { ok: false, mensaje: `No se aprobo ninguna. ${error.message}` };
    }
    throw error;
  }
}
