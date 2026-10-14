import type { Ejecutor } from "@/lib/db";
import * as piezas from "@/models/piezas";
import * as proyectos from "@/models/proyectos";
import type { Pieza, Proyecto } from "@/types";

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
