"use server";

import { revalidatePath } from "next/cache";

import { anotar } from "@/lib/auditoria";
import { conSesion } from "@/lib/db";
import { correoDePiezaEnRevision } from "@/lib/correos/plantillas";
import { encolarCorreo, entregarCorreos } from "@/lib/externos/correo";
import { notificarA } from "@/lib/notificaciones";
import { piezaGestionada } from "@/lib/portal/acceso";
import { nombreDeFase, servicioPorSlug } from "@/lib/portal/catalogo";
import {
  esFaseDeTrabajo,
  faltaVersionEnviada,
  rutaAjustable,
  rutaConAnadidas,
  faseQueSePuedeRegresar,
  motivoParaNoCompletar,
} from "@/lib/portal/fases";
import { RUTA_PROYECTOS, rutaMiPieza, rutaPieza, rutaProyecto } from "@/lib/portal/rutas";
import { requerirCargo, requerirRol } from "@/lib/sesion";
import {
  comoFecha,
  comoIdentificador,
  LIMITES,
  limpiarTexto,
} from "@/lib/validaciones";
import * as clientes from "@/models/clientes";
import * as comentarios from "@/models/comentariosPieza";
import * as piezas from "@/models/piezas";
import * as proyectos from "@/models/proyectos";
import * as revisiones from "@/models/revisiones";
import * as tareas from "@/models/tareas";
import * as usuarios from "@/models/usuarios";
import * as versiones from "@/models/versiones";
import type { EstadoFormulario, NumeroFase, TipoPieza } from "@/types";

/**
 * Piezas y fases: lo que el ejecutivo hace con la bateria.
 *
 * Mover una fase se hace siempre igual: se bloquea la pieza, se lee su estado
 * ya bloqueado, se decide con `src/lib/portal/fases.ts` y se escribe, todo en
 * la misma transaccion. Dos personas que muevan la misma pieza a la vez no se
 * pisan: la segunda espera y decide sobre lo que dejo la primera.
 */

function revalidar(proyectoId: number, piezaId?: number): void {
  revalidatePath(RUTA_PROYECTOS);
  revalidatePath(rutaProyecto(proyectoId));
  if (piezaId) revalidatePath(rutaPieza(proyectoId, piezaId));
}

function comoFase(valor: unknown): NumeroFase | null {
  const numero = Number(valor);
  return [1, 2, 3, 4, 5].includes(numero) ? (numero as NumeroFase) : null;
}

const NO_ALCANCE: EstadoFormulario = {
  ok: false,
  mensaje: "Esa pieza ya no esta a tu alcance",
};

export async function crearPieza(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirCargo("cuentas");

  const proyectoId = comoIdentificador(datos.get("proyectoId"));
  if (proyectoId === null) return { ok: false, mensaje: "No se pudo identificar el proyecto" };

  const titulo = limpiarTexto(datos.get("titulo"), LIMITES.pieza);
  const sugeridas = datos.get("sugeridas") === "on";

  const resultado = await conSesion(usuario, async (tx) => {
    const proyecto = await proyectos.buscarPorId(proyectoId, tx);

    if (!proyecto || !(await proyectos.gestiona(proyectoId, tx))) return "no_existe" as const;

    const servicio = servicioPorSlug(proyecto.servicio);
    if (!servicio || servicio.piezaUnica) return "pieza_unica" as const;

    const tipo = servicio.tiposDePieza.find((permitido) => permitido === datos.get("tipo"));
    if (!tipo) return "tipo" as const;
    if (!titulo) return "titulo" as const;

    if (proyecto.avance.totalPiezas >= LIMITES.piezasPorProyecto) return "limite" as const;

    const piezaId = await piezas.crear(proyectoId, { tipo, titulo }, usuario.id, tx);

    if (sugeridas) {
      for (const tarea of servicio.tareasSugeridas(tipo)) {
        await tareas.crear(piezaId, tarea, usuario.id, tx);
      }
    }

    await anotar(tx, usuario, "pieza.creada", {
      entidadId: piezaId,
      empresaId: proyecto.empresaId,
      despues: { proyecto: proyecto.nombre, titulo, tipo, tareasSugeridas: sugeridas },
    });

    return "ok" as const;
  });

  switch (resultado) {
    case "no_existe":
      return { ok: false, mensaje: "Ese proyecto ya no esta a tu alcance" };
    case "pieza_unica":
      return { ok: false, mensaje: "Este proyecto es de una sola pieza" };
    case "tipo":
      return { ok: false, errores: { tipo: "Elige el tipo de pieza" } };
    case "titulo":
      return { ok: false, errores: { titulo: "Ponle un titulo" } };
    case "limite":
      return { ok: false, mensaje: `Como mucho ${LIMITES.piezasPorProyecto} piezas por proyecto` };
  }

  revalidar(proyectoId);

  return { ok: true, mensaje: `«${titulo}» anadida al proyecto` };
}

export async function editarPieza(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirCargo("cuentas");

  const piezaId = comoIdentificador(datos.get("piezaId"));
  if (piezaId === null) return NO_ALCANCE;

  const titulo = limpiarTexto(datos.get("titulo"), LIMITES.pieza);
  const responsableId = comoIdentificador(datos.get("responsableId"));

  if (!titulo) return { ok: false, errores: { titulo: "Ponle un titulo" } };

  const resultado = await conSesion(usuario, async (tx) => {
    const contexto = await piezaGestionada(piezaId, tx);
    if (!contexto) return null;

    const { pieza, proyecto } = contexto;
    const servicio = servicioPorSlug(proyecto.servicio);
    const tipo: TipoPieza =
      servicio?.tiposDePieza.find((permitido) => permitido === datos.get("tipo")) ?? pieza.tipo;

    if (responsableId !== null) {
      const equipo = await usuarios.equipo(tx);
      if (!equipo.some((persona) => persona.id === responsableId)) return "responsable" as const;
    }

    await piezas.actualizar(piezaId, { titulo, tipo, responsableId }, tx);
    await anotar(tx, usuario, "pieza.editada", {
      entidadId: piezaId,
      empresaId: proyecto.empresaId,
      antes: { titulo: pieza.titulo, tipo: pieza.tipo, responsableId: pieza.responsableId },
      despues: { titulo, tipo, responsableId },
    });

    return proyecto.id;
  });

  if (resultado === null) return NO_ALCANCE;
  if (resultado === "responsable") {
    return { ok: false, errores: { responsableId: "Elige a alguien activo del equipo" } };
  }

  revalidar(resultado, piezaId);

  return { ok: true, mensaje: "Pieza actualizada" };
}

export async function cancelarPieza(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirCargo("cuentas");

  const piezaId = comoIdentificador(datos.get("piezaId"));
  if (piezaId === null) return NO_ALCANCE;

  const motivo = limpiarTexto(datos.get("motivo"), LIMITES.motivo);
  if (!motivo) return { ok: false, errores: { motivo: "Di por que se cancela" } };

  const resultado = await conSesion(usuario, async (tx) => {
    const contexto = await piezaGestionada(piezaId, tx);
    if (!contexto) return null;

    if (!(await piezas.cancelar(piezaId, motivo, usuario.id, tx))) return "ya" as const;

    await anotar(tx, usuario, "pieza.cancelada", {
      entidadId: piezaId,
      empresaId: contexto.proyecto.empresaId,
      despues: { titulo: contexto.pieza.titulo, motivo },
    });

    return contexto.proyecto.id;
  });

  if (resultado === null) return NO_ALCANCE;
  if (resultado === "ya") return { ok: false, mensaje: "La pieza ya estaba cancelada" };

  revalidar(resultado, piezaId);

  return { ok: true, mensaje: "Pieza cancelada. Deja de contar para el avance" };
}

export async function completarFase(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirCargo("cuentas");

  const piezaId = comoIdentificador(datos.get("piezaId"));
  const fase = comoFase(datos.get("fase"));

  if (piezaId === null || fase === null) return NO_ALCANCE;

  const resultado = await conSesion(usuario, async (tx) => {
    const contexto = await piezaGestionada(piezaId, tx);
    if (!contexto) return null;

    const { pieza, proyecto } = contexto;

    if (pieza.estado !== "activa") return { motivo: "La pieza esta cancelada." };

    const todas = await tareas.dePieza(piezaId, tx);
    const motivo =
      motivoParaNoCompletar(pieza.fases, fase, todas.filter((tarea) => tarea.fase === fase)) ??
      faltaVersionEnviada(fase, (await versiones.enviadaDeRonda(piezaId, pieza.ronda, tx)) !== null);

    if (motivo) return { motivo };

    await piezas.completarFase(piezaId, fase, pieza.ronda, usuario.id, tx);

    await anotar(tx, usuario, "fase.completada", {
      entidad: "pieza",
      entidadId: piezaId,
      empresaId: proyecto.empresaId,
      antes: { fase, estado: "en_curso" },
      despues: { fase, estado: "completada", siguiente: fase + 1 },
    });

    // Si lo siguiente es una fase de trabajo, quien tiene tareas en ella ya
    // puede empezar: se le dice.
    const siguiente = (fase + 1) as NumeroFase;

    if (esFaseDeTrabajo(siguiente)) {
      const responsables = todas
        .filter((tarea) => tarea.fase === siguiente && tarea.estado === "pendiente")
        .map((tarea) => tarea.responsableId)
        .filter((id): id is number => id !== null && id !== usuario.id);

      await notificarA(tx, responsables, {
        tipo: "tarea.puede_empezar",
        titulo: `Ya puedes empezar en «${pieza.titulo}»`,
        cuerpo: `${nombreDeFase(proyecto.tipo, siguiente)}, de ${proyecto.nombre}.`,
        href: rutaPieza(proyecto.id, piezaId),
        empresaId: proyecto.empresaId,
      });
    }

    // Completar la fase 4 es enviarla al cliente: se avisa a quien aprueba
    // por la empresa, en la campana y por correo.
    const correos: number[] = [];

    if (fase === 4) {
      const aprobadores = await clientes.aprobadoresDe(proyecto.empresaId, tx);

      await notificarA(
        tx,
        aprobadores.map((persona) => persona.id),
        {
          tipo: "pieza.en_revision",
          titulo: `«${pieza.titulo}» espera tu revision`,
          cuerpo: `Del proyecto ${proyecto.nombre}.`,
          href: rutaMiPieza(proyecto.id, piezaId),
          empresaId: proyecto.empresaId,
        },
      );

      for (const persona of aprobadores) {
        correos.push(
          await encolarCorreo(
            tx,
            usuario,
            correoDePiezaEnRevision(persona, { titulo: pieza.titulo, proyecto: proyecto.nombre }),
          ),
        );
      }
    }

    return { proyectoId: proyecto.id, nombre: nombreDeFase(proyecto.tipo, fase), correos };
  });

  if (resultado === null) return NO_ALCANCE;
  if ("motivo" in resultado) return { ok: false, mensaje: resultado.motivo };

  // El correo sale despues de confirmar el cambio, nunca dentro.
  await entregarCorreos(usuario, resultado.correos);

  revalidar(resultado.proyectoId, piezaId);

  return { ok: true, mensaje: `${resultado.nombre}: completada` };
}

export async function regresarFase(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirCargo("cuentas");

  const piezaId = comoIdentificador(datos.get("piezaId"));
  if (piezaId === null) return NO_ALCANCE;

  const resultado = await conSesion(usuario, async (tx) => {
    const contexto = await piezaGestionada(piezaId, tx);
    if (!contexto) return null;

    const { pieza, proyecto } = contexto;
    const fase = faseQueSePuedeRegresar(pieza.fases);

    if (pieza.estado !== "activa" || fase === null) {
      return { motivo: "No hay ninguna fase que regresar." };
    }

    await piezas.regresarFase(piezaId, fase, tx);

    await anotar(tx, usuario, "fase.regresada", {
      entidad: "pieza",
      entidadId: piezaId,
      empresaId: proyecto.empresaId,
      antes: { faseEnCurso: fase + 1 },
      despues: { faseEnCurso: fase },
    });

    return { proyectoId: proyecto.id, nombre: nombreDeFase(proyecto.tipo, fase) };
  });

  if (resultado === null) return NO_ALCANCE;
  if ("motivo" in resultado) return { ok: false, mensaje: resultado.motivo };

  revalidar(resultado.proyectoId, piezaId);

  return { ok: true, mensaje: `La pieza vuelve a ${resultado.nombre}` };
}

export async function planificarFase(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirCargo("cuentas");

  const piezaId = comoIdentificador(datos.get("piezaId"));
  const fase = comoFase(datos.get("fase"));
  if (piezaId === null || fase === null) return NO_ALCANCE;

  const fechaEstimada = comoFecha(datos.get("fechaEstimada"));
  const responsableId = comoIdentificador(datos.get("responsableId"));

  if (datos.get("fechaEstimada") && !fechaEstimada) {
    return { ok: false, errores: { fechaEstimada: "Esa fecha no existe" } };
  }

  const resultado = await conSesion(usuario, async (tx) => {
    const contexto = await piezaGestionada(piezaId, tx);
    if (!contexto) return null;

    if (responsableId !== null) {
      const equipo = await usuarios.equipo(tx);
      if (!equipo.some((persona) => persona.id === responsableId)) return "responsable" as const;
    }

    const anterior = contexto.pieza.fases.find((f) => f.fase === fase);

    await piezas.planificarFase(piezaId, fase, { fechaEstimada, responsableId }, tx);
    await anotar(tx, usuario, "fase.planificada", {
      entidad: "pieza",
      entidadId: piezaId,
      empresaId: contexto.proyecto.empresaId,
      antes: {
        fase,
        fechaEstimada: anterior?.fechaEstimada ?? null,
        responsableId: anterior?.responsableId ?? null,
      },
      despues: { fase, fechaEstimada, responsableId },
    });

    return contexto.proyecto.id;
  });

  if (resultado === null) return NO_ALCANCE;
  if (resultado === "responsable") {
    return { ok: false, errores: { responsableId: "Elige a alguien activo del equipo" } };
  }

  revalidar(resultado, piezaId);

  return { ok: true, mensaje: "Fase planificada" };
}

/**
 * El copy lo escribe quien trabaja en la pieza, no solo el ejecutivo. Quien
 * puede lo decide la base: si no la deja escribir, no cambia ninguna fila.
 */
export async function guardarCopy(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirRol("admin", "trabajador");

  const piezaId = comoIdentificador(datos.get("piezaId"));
  if (piezaId === null) return NO_ALCANCE;

  const copy = typeof datos.get("copy") === "string"
    ? String(datos.get("copy")).slice(0, LIMITES.copy)
    : "";

  const resultado = await conSesion(usuario, async (tx) => {
    const pieza = await piezas.buscarPorId(piezaId, tx);
    if (!pieza) return null;

    if (!(await piezas.guardarCopy(piezaId, copy, usuario.id, tx))) return null;

    const proyecto = await proyectos.buscarPorId(pieza.proyectoId, tx);

    await anotar(tx, usuario, "pieza.copy_editado", {
      entidadId: piezaId,
      empresaId: proyecto?.empresaId ?? null,
      despues: { caracteres: copy.length },
    });

    return pieza.proyectoId;
  });

  if (resultado === null) return NO_ALCANCE;

  revalidar(resultado, piezaId);

  return { ok: true, mensaje: "Copy guardado" };
}

export async function comentarPieza(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirRol("admin", "trabajador");

  const piezaId = comoIdentificador(datos.get("piezaId"));
  if (piezaId === null) return NO_ALCANCE;

  const texto = limpiarTexto(datos.get("texto"), LIMITES.comentario);
  if (!texto) return { ok: false, errores: { texto: "Escribe el comentario" } };

  const resultado = await conSesion(usuario, async (tx) => {
    const pieza = await piezas.buscarPorId(piezaId, tx);
    if (!pieza) return null;

    const comentarioId = await comentarios.crear(piezaId, usuario.id, texto, tx);
    const proyecto = await proyectos.buscarPorId(pieza.proyectoId, tx);

    await anotar(tx, usuario, "pieza.comentada", {
      entidadId: piezaId,
      empresaId: proyecto?.empresaId ?? null,
      despues: { comentarioId },
    });

    return pieza.proyectoId;
  });

  if (resultado === null) return NO_ALCANCE;

  revalidar(resultado, piezaId);

  return { ok: true, mensaje: "Comentario anadido" };
}

/**
 * El ejecutivo ajusta la ruta de la ultima correccion: anade fases a las que
 * pidio el cliente. Solo mientras no se haya completado ninguna fase de la
 * ronda nueva, y solo anadiendo (docs/reglasBateria.md).
 */
export async function ajustarRuta(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirCargo("cuentas");

  const piezaId = comoIdentificador(datos.get("piezaId"));
  if (piezaId === null) return NO_ALCANCE;

  const pedidas = datos
    .getAll("anadir")
    .map(comoFase)
    .filter((fase): fase is NumeroFase => fase !== null && fase < 4);

  if (pedidas.length === 0) return { ok: false, mensaje: "Marca alguna fase que anadir" };

  const resultado = await conSesion(usuario, async (tx) => {
    const contexto = await piezaGestionada(piezaId, tx);
    if (!contexto) return null;

    const { pieza, proyecto } = contexto;
    const revision = await revisiones.deRonda(piezaId, pieza.ronda - 1, tx);

    if (!revision || revision.decision !== "correccion" || !rutaAjustable(pieza.fases, pieza.ronda)) {
      return { motivo: "La ruta ya no se puede ajustar: la ronda nueva ya avanzo." };
    }

    const anadidas = pedidas.filter((fase) => !revision.fasesReabiertas.includes(fase));
    if (anadidas.length === 0) return { motivo: "Esas fases ya estaban en la ruta." };

    const nueva = rutaConAnadidas(revision.fasesReabiertas, anadidas);

    await piezas.reabrirFases(piezaId, anadidas, tx);
    await tareas.reabrirDeFases(piezaId, anadidas, tx);
    await revisiones.ajustar(revision.id, nueva, usuario.id, tx);

    await anotar(tx, usuario, "pieza.ruta_ajustada", {
      entidad: "pieza",
      entidadId: piezaId,
      empresaId: proyecto.empresaId,
      antes: { fases: revision.fasesReabiertas.join(",") },
      despues: { fases: nueva.join(",") },
    });

    return { proyectoId: proyecto.id };
  });

  if (resultado === null) return NO_ALCANCE;
  if ("motivo" in resultado) return { ok: false, mensaje: resultado.motivo };

  revalidar(resultado.proyectoId, piezaId);

  return { ok: true, mensaje: "Ruta ajustada" };
}
