import { redirect } from "next/navigation";

import { conSesion, type Ejecutor } from "@/lib/db";
import { requerirCargo, requerirRol } from "@/lib/sesion";
import * as piezas from "@/models/piezas";
import * as proyectos from "@/models/proyectos";
import type { Pieza, Proyecto, UsuarioCompleto } from "@/types";
import { rutaPieza } from "./rutas";
import { tareaMarcable } from "./tareas";

/**
 * Lo que las actions de piezas y tareas comparten para decidir si alguien
 * puede tocar una pieza.
 */

export type PiezaConProyecto = { pieza: Pieza; proyecto: Proyecto };

/**
 * Bloquea la pieza y la devuelve con su proyecto, solo si quien declaro la
 * sesion la gestiona. Null en cualquier otro caso: para quien no la gestiona
 * es como si no existiera.
 *
 * El bloqueo dura hasta el final de la transaccion: quien llama decide y
 * escribe sobre un estado que nadie mas puede cambiar mientras tanto.
 */
export async function piezaGestionada(
  piezaId: number,
  tx: Ejecutor,
): Promise<PiezaConProyecto | null> {
  const bloqueada = await piezas.bloquear(piezaId, tx);

  if (!bloqueada || !(await proyectos.gestiona(bloqueada.proyectoId, tx))) return null;

  const pieza = await piezas.buscarPorId(piezaId, tx);
  const proyecto = await proyectos.buscarPorId(bloqueada.proyectoId, tx);

  return pieza && proyecto ? { pieza, proyecto } : null;
}

/** Lo que el canvas de hooks necesita saber de la tarea que cumple. */
export type TareaDeHooks = {
  id: number;
  titulo: string;
  estado: "pendiente" | "lista";
  piezaTitulo: string;
  proyectoNombre: string;
  empresaId: number;
  hrefPieza: string;
};

/**
 * La guardia del canvas y del auditor de hooks.
 *
 * Sin tarea, es la de siempre: solo redes, y el admin. Con tarea, deja pasar
 * tambien a quien la tiene asignada o gestiona su pieza, aunque no sea de
 * redes: es como se llega a la herramienta desde el trabajo, sin ver el resto
 * del modulo. Una tarea que no es de hooks, o que no esta a su alcance, se
 * ignora; y si ademas no es de redes, vuelve al panel.
 */
export async function requerirHooks(
  tareaId: number | null,
): Promise<{ usuario: UsuarioCompleto; tarea: TareaDeHooks | null }> {
  if (tareaId === null) return { usuario: await requerirCargo("redes"), tarea: null };

  const usuario = await requerirRol("admin", "trabajador");

  const tarea = await conSesion(usuario, async (tx) => {
    const contexto = await tareaMarcable(tareaId, usuario, tx);
    if (!contexto || contexto.tarea.herramienta !== "hooks") return null;

    return {
      id: contexto.tarea.id,
      titulo: contexto.tarea.titulo,
      estado: contexto.tarea.estado,
      piezaTitulo: contexto.pieza.titulo,
      proyectoNombre: contexto.proyecto.nombre,
      empresaId: contexto.proyecto.empresaId,
      hrefPieza: rutaPieza(contexto.proyecto.id, contexto.pieza.id),
    };
  });

  if (tarea) return { usuario, tarea };
  if (usuario.rol === "admin" || usuario.cargoSlug === "redes") return { usuario, tarea: null };

  redirect("/dashboard");
}
