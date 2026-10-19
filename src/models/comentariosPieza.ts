import { consultar, consultarUno, type Ejecutor } from "@/lib/db";
import type { ComentarioPieza, NumeroFase } from "@/types";

/**
 * Consultas sobre portal.comentarios_pieza: la conversacion interna de una
 * pieza, por fase (y, si se quiere, sobre una tarea de esa fase). Los que no
 * tienen fase son los generales. Solo se anaden; el cliente no los ve nunca.
 */

/** Los comentarios de una pieza, del mas antiguo al mas nuevo. */
export async function dePieza(
  piezaId: number,
  ejecutor: Ejecutor,
): Promise<ComentarioPieza[]> {
  return consultar<ComentarioPieza>(
    `SELECT c.id,
            c.autor_id                     AS "autorId",
            u.nombre || ' ' || u.apellido  AS "autorNombre",
            c.texto,
            c.creado_en                    AS "creadoEn",
            c.fase,
            c.tarea_id                     AS "tareaId",
            t.titulo                       AS "tareaTitulo"
     FROM portal.comentarios_pieza c
     JOIN usuarios u ON u.id = c.autor_id
     LEFT JOIN portal.tareas t ON t.id = c.tarea_id
     WHERE c.pieza_id = $1
     ORDER BY c.creado_en, c.id`,
    [piezaId],
    ejecutor,
  );
}

/** Anade un comentario a nombre de quien declaro la sesion. */
export async function crear(
  piezaId: number,
  autorId: number,
  texto: string,
  donde: { fase: NumeroFase | null; tareaId: number | null },
  ejecutor: Ejecutor,
): Promise<number> {
  const fila = await consultarUno<{ id: number }>(
    `INSERT INTO portal.comentarios_pieza (pieza_id, autor_id, texto, fase, tarea_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [piezaId, autorId, texto, donde.fase, donde.tareaId],
    ejecutor,
  );

  if (!fila) throw new Error("No se pudo guardar el comentario");

  return fila.id;
}
