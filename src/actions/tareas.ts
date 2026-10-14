"use server";

import { revalidatePath } from "next/cache";

import { anotar } from "@/lib/auditoria";
import { conSesion, type Ejecutor } from "@/lib/db";
import { herramientaPorSlug } from "@/lib/herramientas";
import { notificarA } from "@/lib/notificaciones";
import { piezaGestionada } from "@/lib/portal/acceso";
import { nombreDeFase } from "@/lib/portal/catalogo";
import { RUTA_PROYECTOS, rutaPieza, rutaProyecto } from "@/lib/portal/rutas";
import { requerirCargo, requerirRol } from "@/lib/sesion";
import { comoIdentificador, validarTarea } from "@/lib/validaciones";
import * as piezas from "@/models/piezas";
import * as proyectos from "@/models/proyectos";
import * as tareas from "@/models/tareas";
import * as usuarios from "@/models/usuarios";
import type { EstadoFormulario, FaseDeTrabajo, UsuarioCompleto } from "@/types";

/**
 * Las tareas de las fases 1 y 3.
 *
 * Las crea, asigna y quita quien gestiona la pieza. Marcarlas como listas lo
 * puede hacer tambien quien la tiene asignada: es su trabajo.
 */

const RUTA_MI_TRABAJO = "/dashboard/mi-trabajo";

function revalidar(proyectoId: number, piezaId: number): void {
  revalidatePath(RUTA_PROYECTOS);
  revalidatePath(rutaProyecto(proyectoId));
  revalidatePath(rutaPieza(proyectoId, piezaId));
  revalidatePath(RUTA_MI_TRABAJO);
}

const NO_ALCANCE: EstadoFormulario = {
  ok: false,
  mensaje: "Esa tarea ya no esta a tu alcance",
};

function comoFaseDeTrabajo(valor: unknown): FaseDeTrabajo | null {
  const numero = Number(valor);
  return numero === 1 || numero === 3 ? numero : null;
}

/** Comprueba que el responsable elegido sea alguien activo del equipo. */
async function esDelEquipo(id: number | null, tx: Ejecutor): Promise<boolean> {
  if (id === null) return true;
  return (await usuarios.equipo(tx)).some((persona) => persona.id === id);
}

export async function crearTarea(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirCargo("cuentas");

  const piezaId = comoIdentificador(datos.get("piezaId"));
  const fase = comoFaseDeTrabajo(datos.get("fase"));
  if (piezaId === null || fase === null) return NO_ALCANCE;

  const validacion = validarTarea(datos);
  if (!validacion.valido) return { ok: false, errores: validacion.errores };

  const { titulo, responsableId, fechaEstimada } = validacion.valores;
  const herramienta = herramientaPorSlug(String(datos.get("herramienta") ?? ""));

  const resultado = await conSesion(usuario, async (tx) => {
    const contexto = await piezaGestionada(piezaId, tx);
    if (!contexto) return null;

    const { pieza, proyecto } = contexto;

    if (pieza.estado !== "activa") return "cancelada" as const;
    if (!(await esDelEquipo(responsableId, tx))) return "responsable" as const;

    const tareaId = await tareas.crear(
      piezaId,
      { fase, titulo, responsableId, fechaEstimada, herramienta: herramienta?.slug ?? null },
      usuario.id,
      tx,
    );

    await anotar(tx, usuario, "tarea.creada", {
      entidadId: tareaId,
      empresaId: proyecto.empresaId,
      despues: { pieza: pieza.titulo, fase, titulo, responsableId, fechaEstimada },
    });

    if (responsableId !== null && responsableId !== usuario.id) {
      await notificarA(tx, [responsableId], {
        tipo: "tarea.asignada",
        titulo: `Nueva tarea: ${titulo}`,
        cuerpo: `En «${pieza.titulo}», de ${proyecto.nombre}.`,
        href: RUTA_MI_TRABAJO,
        empresaId: proyecto.empresaId,
      });
    }

    return proyecto.id;
  });

  if (resultado === null) return NO_ALCANCE;
  if (resultado === "cancelada") return { ok: false, mensaje: "La pieza esta cancelada" };
  if (resultado === "responsable") {
    return { ok: false, errores: { responsableId: "Elige a alguien activo del equipo" } };
  }

  revalidar(resultado, piezaId);

  return { ok: true, mensaje: "Tarea anadida" };
}

export async function editarTarea(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirCargo("cuentas");

  const tareaId = comoIdentificador(datos.get("tareaId"));
  if (tareaId === null) return NO_ALCANCE;

  const validacion = validarTarea(datos);
  if (!validacion.valido) return { ok: false, errores: validacion.errores };

  const cambios = validacion.valores;

  const resultado = await conSesion(usuario, async (tx) => {
    const tarea = await tareas.buscarPorId(tareaId, tx);
    if (!tarea) return null;

    const contexto = await piezaGestionada(tarea.piezaId, tx);
    if (!contexto) return null;

    if (!(await esDelEquipo(cambios.responsableId, tx))) return "responsable" as const;

    await tareas.actualizar(tareaId, cambios, tx);
    await anotar(tx, usuario, "tarea.editada", {
      entidadId: tareaId,
      empresaId: contexto.proyecto.empresaId,
      antes: {
        titulo: tarea.titulo,
        responsableId: tarea.responsableId,
        fechaEstimada: tarea.fechaEstimada,
      },
      despues: cambios,
    });

    const nuevo = cambios.responsableId;

    if (nuevo !== null && nuevo !== tarea.responsableId && nuevo !== usuario.id) {
      await notificarA(tx, [nuevo], {
        tipo: "tarea.asignada",
        titulo: `Nueva tarea: ${cambios.titulo}`,
        cuerpo: `En «${contexto.pieza.titulo}», de ${contexto.proyecto.nombre}.`,
        href: RUTA_MI_TRABAJO,
        empresaId: contexto.proyecto.empresaId,
      });
    }

    return { proyectoId: contexto.proyecto.id, piezaId: tarea.piezaId };
  });

  if (resultado === null) return NO_ALCANCE;
  if (resultado === "responsable") {
    return { ok: false, errores: { responsableId: "Elige a alguien activo del equipo" } };
  }

  revalidar(resultado.proyectoId, resultado.piezaId);

  return { ok: true, mensaje: "Tarea actualizada" };
}

/**
 * Si la tarea la puede marcar quien llama: su responsable, o quien gestiona
 * la pieza. Devuelve la tarea con su proyecto, o null.
 */
async function tareaMarcable(tareaId: number, usuario: UsuarioCompleto, tx: Ejecutor) {
  const tarea = await tareas.buscarPorId(tareaId, tx);
  if (!tarea) return null;

  const gestiona = await proyectos.gestiona(tarea.proyectoId, tx);
  if (tarea.responsableId !== usuario.id && !gestiona) return null;

  const pieza = await piezas.buscarPorId(tarea.piezaId, tx);
  const proyecto = await proyectos.buscarPorId(tarea.proyectoId, tx);
  if (!pieza || !proyecto) return null;

  return { tarea, pieza, proyecto };
}

export async function marcarTareaLista(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirRol("admin", "trabajador");

  const tareaId = comoIdentificador(datos.get("tareaId"));
  if (tareaId === null) return NO_ALCANCE;

  const resultado = await conSesion(usuario, async (tx) => {
    const contexto = await tareaMarcable(tareaId, usuario, tx);
    if (!contexto) return null;

    const { tarea, pieza, proyecto } = contexto;

    if (!(await tareas.marcarLista(tareaId, usuario.id, tx))) return "ya" as const;

    await anotar(tx, usuario, "tarea.lista", {
      entidadId: tareaId,
      empresaId: proyecto.empresaId,
      despues: { titulo: tarea.titulo, pieza: pieza.titulo },
    });

    // Si con esta la fase queda lista, el ejecutivo la puede completar.
    const pendientes = (await tareas.dePieza(pieza.id, tx)).filter(
      (otra) => otra.fase === tarea.fase && otra.estado === "pendiente",
    );
    const enCurso = pieza.avance.faseActual === tarea.fase;

    if (pendientes.length === 0 && enCurso && proyecto.ejecutivoId !== usuario.id) {
      await notificarA(tx, [proyecto.ejecutivoId], {
        tipo: "fase.lista",
        titulo: `«${pieza.titulo}» esta lista para completar`,
        cuerpo: `${nombreDeFase(proyecto.tipo, tarea.fase)}, de ${proyecto.nombre}.`,
        href: rutaPieza(proyecto.id, pieza.id),
        empresaId: proyecto.empresaId,
      });
    }

    return { proyectoId: proyecto.id, piezaId: pieza.id };
  });

  if (resultado === null) return NO_ALCANCE;
  if (resultado === "ya") return { ok: false, mensaje: "La tarea ya estaba lista" };

  revalidar(resultado.proyectoId, resultado.piezaId);

  return { ok: true, mensaje: "Tarea lista" };
}

export async function reabrirTarea(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirRol("admin", "trabajador");

  const tareaId = comoIdentificador(datos.get("tareaId"));
  if (tareaId === null) return NO_ALCANCE;

  const resultado = await conSesion(usuario, async (tx) => {
    const contexto = await tareaMarcable(tareaId, usuario, tx);
    if (!contexto) return null;

    // Una tarea de una fase ya completada no se reabre: la fase daria por
    // hecho un trabajo que vuelve a estar pendiente.
    const fase = contexto.pieza.fases.find((f) => f.fase === contexto.tarea.fase);
    if (fase?.estado === "completada") return "fase_completada" as const;

    if (!(await tareas.reabrir(tareaId, tx))) return "ya" as const;

    await anotar(tx, usuario, "tarea.reabierta", {
      entidadId: tareaId,
      empresaId: contexto.proyecto.empresaId,
      despues: { titulo: contexto.tarea.titulo },
    });

    return { proyectoId: contexto.proyecto.id, piezaId: contexto.pieza.id };
  });

  if (resultado === null) return NO_ALCANCE;
  if (resultado === "ya") return { ok: false, mensaje: "La tarea ya estaba pendiente" };
  if (resultado === "fase_completada") {
    return { ok: false, mensaje: "Su fase ya se completo: regresa la fase antes" };
  }

  revalidar(resultado.proyectoId, resultado.piezaId);

  return { ok: true, mensaje: "La tarea vuelve a estar pendiente" };
}

export async function quitarTarea(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirCargo("cuentas");

  const tareaId = comoIdentificador(datos.get("tareaId"));
  if (tareaId === null) return NO_ALCANCE;

  const resultado = await conSesion(usuario, async (tx) => {
    const tarea = await tareas.buscarPorId(tareaId, tx);
    if (!tarea) return null;

    const contexto = await piezaGestionada(tarea.piezaId, tx);
    if (!contexto) return null;

    if (!(await tareas.quitar(tareaId, tx))) return "lista" as const;

    await anotar(tx, usuario, "tarea.quitada", {
      entidadId: tareaId,
      empresaId: contexto.proyecto.empresaId,
      antes: { titulo: tarea.titulo, pieza: contexto.pieza.titulo, fase: tarea.fase },
    });

    return { proyectoId: contexto.proyecto.id, piezaId: tarea.piezaId };
  });

  if (resultado === null) return NO_ALCANCE;
  if (resultado === "lista") {
    return { ok: false, mensaje: "Una tarea lista no se quita: reabrela antes" };
  }

  revalidar(resultado.proyectoId, resultado.piezaId);

  return { ok: true, mensaje: "Tarea quitada" };
}
