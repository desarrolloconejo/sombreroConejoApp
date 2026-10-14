import { consultar, consultarUno, ejecutar, type Ejecutor } from "@/lib/db";
import type { DatosNuevaTarea, Tarea, TareaAsignada } from "@/types";

/**
 * Consultas sobre portal.tareas: el trabajo interno de las fases 1 y 3.
 *
 * El ejecutor es obligatorio y sale de `conSesion`. El cliente nunca alcanza
 * esta tabla. Quien gestiona la pieza crea, asigna y quita tareas; quien tiene
 * una asignada solo puede marcarla.
 */

const COLUMNAS = `
  t.id,
  t.pieza_id                             AS "piezaId",
  t.fase,
  t.orden,
  t.titulo,
  t.responsable_id                       AS "responsableId",
  r.nombre || ' ' || r.apellido          AS "responsableNombre",
  t.herramienta,
  t.fecha_estimada::text                 AS "fechaEstimada",
  t.estado,
  t.lista_en                             AS "listaEn"
`;

/** Las tareas de una pieza, por fase y orden. */
export async function dePieza(piezaId: number, ejecutor: Ejecutor): Promise<Tarea[]> {
  return consultar<Tarea>(
    `SELECT ${COLUMNAS}
     FROM portal.tareas t
     LEFT JOIN usuarios r ON r.id = t.responsable_id
     WHERE t.pieza_id = $1
     ORDER BY t.fase, t.orden, t.id`,
    [piezaId],
    ejecutor,
  );
}

/**
 * Las tareas de una persona, con donde estan. Solo las de piezas activas y
 * proyectos en curso: lo cancelado o cerrado no es trabajo pendiente. Las
 * listas, si se piden, solo las de las dos ultimas semanas.
 *
 * Primero las de fecha mas cercana; las que no tienen fecha, al final.
 */
export async function asignadasA(
  usuarioId: number,
  opciones: { incluirListas: boolean },
  ejecutor: Ejecutor,
): Promise<TareaAsignada[]> {
  return consultar<TareaAsignada>(
    `SELECT ${COLUMNAS},
            pr.id                         AS "proyectoId",
            pr.nombre                     AS "proyectoNombre",
            pr.tipo                       AS "proyectoTipo",
            e.nombre                      AS "empresaNombre",
            p.titulo                      AS "piezaTitulo",
            p.tipo                        AS "piezaTipo",
            (f.estado = 'en_curso')       AS "faseEnCurso"
     FROM portal.tareas t
     JOIN portal.piezas p       ON p.id = t.pieza_id
     JOIN portal.proyectos pr   ON pr.id = p.proyecto_id
     JOIN empresas e            ON e.id = pr.empresa_id
     JOIN portal.pieza_fases f  ON f.pieza_id = t.pieza_id AND f.fase = t.fase
     LEFT JOIN usuarios r       ON r.id = t.responsable_id
     WHERE t.responsable_id = $1
       AND p.estado = 'activa'
       AND pr.estado IN ('activo', 'pausado')
       AND (t.estado = 'pendiente'
            OR ($2 AND t.lista_en > now() - interval '14 days'))
     ORDER BY t.estado DESC, t.fecha_estimada NULLS LAST, pr.nombre, p.orden, t.orden`,
    [usuarioId, opciones.incluirListas],
    ejecutor,
  );
}

/**
 * Cuantas tareas pendientes tiene una persona en trabajo vivo: piezas activas
 * de proyectos activos o pausados.
 */
export async function contarAbiertasDe(
  usuarioId: number,
  ejecutor: Ejecutor,
): Promise<number> {
  const fila = await consultarUno<{ total: number }>(
    `SELECT count(*)::int AS total
     FROM portal.tareas t
     JOIN portal.piezas p     ON p.id = t.pieza_id
     JOIN portal.proyectos pr ON pr.id = p.proyecto_id
     WHERE t.responsable_id = $1
       AND t.estado = 'pendiente'
       AND p.estado = 'activa'
       AND pr.estado IN ('activo', 'pausado')`,
    [usuarioId],
    ejecutor,
  );

  return fila?.total ?? 0;
}

/** Una tarea, con la pieza y la empresa a la que pertenece. */
export async function buscarPorId(
  id: number,
  ejecutor: Ejecutor,
): Promise<(Tarea & { proyectoId: number; empresaId: number }) | null> {
  return consultarUno(
    `SELECT ${COLUMNAS},
            p.proyecto_id AS "proyectoId",
            pr.empresa_id AS "empresaId"
     FROM portal.tareas t
     JOIN portal.piezas p     ON p.id = t.pieza_id
     JOIN portal.proyectos pr ON pr.id = p.proyecto_id
     LEFT JOIN usuarios r     ON r.id = t.responsable_id
     WHERE t.id = $1`,
    [id],
    ejecutor,
  );
}

/** Crea una tarea al final de su fase. Devuelve el id. */
export async function crear(
  piezaId: number,
  datos: DatosNuevaTarea,
  creadoPor: number,
  ejecutor: Ejecutor,
): Promise<number> {
  const fila = await consultarUno<{ id: number }>(
    `INSERT INTO portal.tareas
       (pieza_id, fase, orden, titulo, responsable_id, herramienta,
        fecha_estimada, creado_por)
     VALUES (
       $1, $2,
       (SELECT COALESCE(max(orden), 0) + 1 FROM portal.tareas
        WHERE pieza_id = $1 AND fase = $2),
       $3, $4, $5, $6::date, $7
     )
     RETURNING id`,
    [
      piezaId,
      datos.fase,
      datos.titulo,
      datos.responsableId ?? null,
      datos.herramienta ?? null,
      datos.fechaEstimada ?? null,
      creadoPor,
    ],
    ejecutor,
  );

  if (!fila) throw new Error("No se pudo crear la tarea");

  return fila.id;
}

/** Cambia titulo, responsable y fecha de una tarea. */
export async function actualizar(
  id: number,
  cambios: { titulo: string; responsableId: number | null; fechaEstimada: string | null },
  ejecutor: Ejecutor,
): Promise<boolean> {
  const filas = await ejecutar(
    `UPDATE portal.tareas
     SET titulo = $2, responsable_id = $3, fecha_estimada = $4::date
     WHERE id = $1`,
    [id, cambios.titulo, cambios.responsableId, cambios.fechaEstimada],
    ejecutor,
  );

  return filas > 0;
}

/** Marca la tarea como lista. Devuelve false si ya lo estaba. */
export async function marcarLista(
  id: number,
  usuarioId: number,
  ejecutor: Ejecutor,
): Promise<boolean> {
  const filas = await ejecutar(
    `UPDATE portal.tareas
     SET estado = 'lista', lista_en = now(), lista_por = $2
     WHERE id = $1 AND estado = 'pendiente'`,
    [id, usuarioId],
    ejecutor,
  );

  return filas > 0;
}

/** Devuelve la tarea a pendiente. Devuelve false si ya lo estaba. */
export async function reabrir(id: number, ejecutor: Ejecutor): Promise<boolean> {
  const filas = await ejecutar(
    `UPDATE portal.tareas
     SET estado = 'pendiente', lista_en = NULL, lista_por = NULL
     WHERE id = $1 AND estado = 'lista'`,
    [id],
    ejecutor,
  );

  return filas > 0;
}

/** Quita una tarea pendiente. La base no deja quitar una lista. */
export async function quitar(id: number, ejecutor: Ejecutor): Promise<boolean> {
  const filas = await ejecutar(
    "DELETE FROM portal.tareas WHERE id = $1 AND estado = 'pendiente'",
    [id],
    ejecutor,
  );

  return filas > 0;
}
