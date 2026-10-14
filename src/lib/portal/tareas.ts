import { anotar } from "@/lib/auditoria";
import type { Ejecutor } from "@/lib/db";
import { notificarA } from "@/lib/notificaciones";
import * as piezas from "@/models/piezas";
import * as proyectos from "@/models/proyectos";
import * as tareas from "@/models/tareas";
import type { Pieza, Proyecto, Tarea, UsuarioCompleto } from "@/types";
import { nombreDeFase } from "./catalogo";
import { rutaPieza } from "./rutas";

/**
 * Lo que comparten las dos formas de dar una tarea por hecha: marcarla a mano
 * (Mi trabajo, la ficha de la pieza) y que la cumpla su herramienta (una
 * ficha de hook que aprueba la auditoria).
 */

export type TareaConContexto = { tarea: Tarea; pieza: Pieza; proyecto: Proyecto };

/**
 * La tarea con su pieza y su proyecto, si quien llama la puede marcar: es su
 * responsable, o gestiona la pieza. Null en cualquier otro caso.
 */
export async function tareaMarcable(
  tareaId: number,
  usuario: UsuarioCompleto,
  tx: Ejecutor,
): Promise<TareaConContexto | null> {
  const tarea = await tareas.buscarPorId(tareaId, tx);
  if (!tarea) return null;

  const gestiona = await proyectos.gestiona(tarea.proyectoId, tx);
  if (tarea.responsableId !== usuario.id && !gestiona) return null;

  const pieza = await piezas.buscarPorId(tarea.piezaId, tx);
  const proyecto = await proyectos.buscarPorId(tarea.proyectoId, tx);
  if (!pieza || !proyecto) return null;

  return { tarea, pieza, proyecto };
}

/**
 * Da la tarea por lista, lo anota y, si con ella su fase queda lista, se lo
 * dice al ejecutivo. Devuelve false si ya estaba lista.
 *
 * Quien llama ya comprobo con `tareaMarcable` que puede hacerlo.
 */
export async function cumplirTarea(
  contexto: TareaConContexto,
  usuario: UsuarioCompleto,
  tx: Ejecutor,
  como: "a_mano" | "herramienta" = "a_mano",
): Promise<boolean> {
  const { tarea, pieza, proyecto } = contexto;

  if (!(await tareas.marcarLista(tarea.id, usuario.id, tx))) return false;

  await anotar(tx, usuario, "tarea.lista", {
    entidadId: tarea.id,
    empresaId: proyecto.empresaId,
    despues: {
      titulo: tarea.titulo,
      pieza: pieza.titulo,
      ...(como === "herramienta" ? { cumplidaCon: tarea.herramienta } : {}),
    },
  });

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

  return true;
}
