import { consultar, consultarUno, ejecutar, type Ejecutor } from "@/lib/db";
import type {
  AlertaPieza,
  DatosNuevaPieza,
  EstadoPieza,
  FasePieza,
  NumeroFase,
  Pieza,
} from "@/types";

/**
 * Consultas sobre portal.piezas, sus fases y su copy.
 *
 * El ejecutor es obligatorio y sale de `conSesion`. Las reglas de cuando se
 * puede mover una fase NO viven aqui: las decide `src/lib/portal/fases.ts`
 * desde la action, con la pieza bloqueada. Este modelo solo escribe lo que se
 * le pide.
 */

type FilaPieza = Omit<Pieza, "fases" | "avance"> & {
  fasesCompletadas: number;
  porcentaje: number;
  faseActual: NumeroFase | null;
  aprobada: boolean;
  fechaEstimadaActual: string | null;
  porVencer: boolean;
  atrasada: boolean;
  esperandoCliente: boolean;
  enCorreccion: boolean;
};

const COLUMNAS_PIEZA = `
  p.id,
  p.proyecto_id                          AS "proyectoId",
  p.orden,
  p.tipo,
  p.titulo,
  p.responsable_id                       AS "responsableId",
  r.nombre || ' ' || r.apellido          AS "responsableNombre",
  p.ronda,
  p.estado,
  p.motivo_cancelacion                   AS "motivoCancelacion",
  v.fases_completadas                    AS "fasesCompletadas",
  v.porcentaje,
  v.fase_actual                          AS "faseActual",
  v.aprobada,
  v.fecha_estimada_actual::text          AS "fechaEstimadaActual",
  v.por_vencer                           AS "porVencer",
  v.atrasada,
  v.esperando_cliente                    AS "esperandoCliente",
  v.en_correccion                        AS "enCorreccion"
`;

const DESDE_PIEZA = `
  FROM portal.piezas p
  JOIN portal.v_progreso_pieza v ON v.pieza_id = p.id
  LEFT JOIN usuarios r ON r.id = p.responsable_id
`;

const COLUMNAS_FASE = `
  f.id,
  f.pieza_id                             AS "piezaId",
  f.fase,
  f.estado,
  f.fecha_estimada::text                 AS "fechaEstimada",
  f.responsable_id                       AS "responsableId",
  r.nombre || ' ' || r.apellido          AS "responsableNombre",
  f.completada_en                        AS "completadaEn",
  f.ronda_completada                     AS "rondaCompletada"
`;

function comoPieza(fila: FilaPieza, fases: FasePieza[]): Pieza {
  const {
    fasesCompletadas,
    porcentaje,
    faseActual,
    aprobada,
    fechaEstimadaActual,
    porVencer,
    atrasada,
    esperandoCliente,
    enCorreccion,
    ...resto
  } = fila;

  const alertas: AlertaPieza[] = [];
  if (porVencer) alertas.push("por_vencer");
  if (atrasada) alertas.push("atrasada");
  if (esperandoCliente) alertas.push("esperando_cliente");
  if (enCorreccion) alertas.push("en_correccion");

  return {
    ...resto,
    fases,
    avance: { fasesCompletadas, porcentaje, faseActual, aprobada, fechaEstimadaActual, alertas },
  };
}

/** Las fases de varias piezas, agrupadas por pieza. */
async function fasesDe(
  piezaIds: number[],
  ejecutor: Ejecutor,
): Promise<Map<number, FasePieza[]>> {
  const grupos = new Map<number, FasePieza[]>();

  if (piezaIds.length === 0) return grupos;

  const filas = await consultar<FasePieza & { piezaId: number }>(
    `SELECT ${COLUMNAS_FASE}
     FROM portal.pieza_fases f
     LEFT JOIN usuarios r ON r.id = f.responsable_id
     WHERE f.pieza_id = ANY($1::int[])
     ORDER BY f.pieza_id, f.fase`,
    [piezaIds],
    ejecutor,
  );

  for (const { piezaId, ...fase } of filas) {
    const lista = grupos.get(piezaId) ?? [];
    lista.push(fase);
    grupos.set(piezaId, lista);
  }

  return grupos;
}

/** Las piezas de un proyecto, en su orden, con sus cinco fases. */
export async function deProyecto(
  proyectoId: number,
  ejecutor: Ejecutor,
): Promise<Pieza[]> {
  const filas = await consultar<FilaPieza>(
    `SELECT ${COLUMNAS_PIEZA} ${DESDE_PIEZA}
     WHERE p.proyecto_id = $1
     ORDER BY p.orden`,
    [proyectoId],
    ejecutor,
  );

  const fases = await fasesDe(filas.map((fila) => fila.id), ejecutor);

  return filas.map((fila) => comoPieza(fila, fases.get(fila.id) ?? []));
}

/** Una pieza con sus fases, si quien pregunta la puede ver. */
export async function buscarPorId(
  id: number,
  ejecutor: Ejecutor,
): Promise<Pieza | null> {
  const fila = await consultarUno<FilaPieza>(
    `SELECT ${COLUMNAS_PIEZA} ${DESDE_PIEZA} WHERE p.id = $1`,
    [id],
    ejecutor,
  );

  if (!fila) return null;

  const fases = await fasesDe([fila.id], ejecutor);

  return comoPieza(fila, fases.get(fila.id) ?? []);
}

/**
 * Bloquea la pieza para moverla. Dos personas no mueven la misma pieza a la
 * vez: la segunda espera a que la primera confirme, y entonces lee el estado
 * ya cambiado. Devuelve null si no existe o no la puede tocar.
 */
export async function bloquear(
  id: number,
  ejecutor: Ejecutor,
): Promise<{
  id: number;
  proyectoId: number;
  ronda: number;
  estado: EstadoPieza;
  empresaId: number;
} | null> {
  return consultarUno(
    `SELECT p.id,
            p.proyecto_id AS "proyectoId",
            p.ronda,
            p.estado,
            pr.empresa_id AS "empresaId"
     FROM portal.piezas p
     JOIN portal.proyectos pr ON pr.id = p.proyecto_id
     WHERE p.id = $1
     FOR UPDATE OF p`,
    [id],
    ejecutor,
  );
}

/**
 * Crea una pieza al final del proyecto, con sus cinco fases y su copy vacio.
 * La fase 1 nace en curso. Devuelve el id.
 */
export async function crear(
  proyectoId: number,
  datos: DatosNuevaPieza,
  creadoPor: number,
  ejecutor: Ejecutor,
): Promise<number> {
  // El id se reserva antes. Con RETURNING, la base comprobaria que quien
  // inserta puede LEER la fila nueva, y la politica de lectura la busca en una
  // consulta que, dentro de la misma sentencia, todavia no la ve.
  const fila = await consultarUno<{ id: number }>(
    "SELECT nextval('portal.piezas_id_seq')::int AS id",
    [],
    ejecutor,
  );

  if (!fila) throw new Error("No se pudo reservar el id de la pieza");

  await ejecutar(
    `INSERT INTO portal.piezas (id, proyecto_id, orden, tipo, titulo, creado_por)
     VALUES (
       $1, $2,
       (SELECT COALESCE(max(orden), 0) + 1 FROM portal.piezas WHERE proyecto_id = $2),
       $3, $4, $5
     )`,
    [fila.id, proyectoId, datos.tipo, datos.titulo, creadoPor],
    ejecutor,
  );

  await ejecutar(
    `INSERT INTO portal.pieza_fases (pieza_id, fase, estado)
     SELECT $1, fase, CASE WHEN fase = 1 THEN 'en_curso' ELSE 'pendiente' END
     FROM generate_series(1, 5) AS fase`,
    [fila.id],
    ejecutor,
  );

  await ejecutar(
    `INSERT INTO portal.pieza_contenido (pieza_id, actualizado_por) VALUES ($1, $2)`,
    [fila.id, creadoPor],
    ejecutor,
  );

  return fila.id;
}

/** Edita titulo, tipo y responsable de la pieza. */
export async function actualizar(
  id: number,
  cambios: { titulo: string; tipo: string; responsableId: number | null },
  ejecutor: Ejecutor,
): Promise<boolean> {
  const filas = await ejecutar(
    `UPDATE portal.piezas
     SET titulo = $2, tipo = $3, responsable_id = $4
     WHERE id = $1`,
    [id, cambios.titulo, cambios.tipo, cambios.responsableId],
    ejecutor,
  );

  return filas > 0;
}

/** Cancela la pieza con su motivo. No se borra: deja de contar. */
export async function cancelar(
  id: number,
  motivo: string,
  usuarioId: number,
  ejecutor: Ejecutor,
): Promise<boolean> {
  const filas = await ejecutar(
    `UPDATE portal.piezas
     SET estado = 'cancelada',
         motivo_cancelacion = $2,
         cancelada_en = now(),
         cancelada_por = $3
     WHERE id = $1 AND estado = 'activa'`,
    [id, motivo, usuarioId],
    ejecutor,
  );

  return filas > 0;
}

/**
 * Completa la fase en curso y abre la siguiente.
 *
 * El orden importa: la base solo admite una fase en curso por pieza, asi que
 * primero se cierra esta y despues se abre la otra. Quien llama ya comprobo
 * que `fase` es la que esta en curso.
 */
export async function completarFase(
  piezaId: number,
  fase: NumeroFase,
  ronda: number,
  usuarioId: number,
  ejecutor: Ejecutor,
): Promise<void> {
  await ejecutar(
    `UPDATE portal.pieza_fases
     SET estado = 'completada',
         completada_en = now(),
         completada_por = $3,
         ronda_completada = $4
     WHERE pieza_id = $1 AND fase = $2 AND estado = 'en_curso'`,
    [piezaId, fase, usuarioId, ronda],
    ejecutor,
  );

  await ejecutar(
    `UPDATE portal.pieza_fases
     SET estado = 'en_curso'
     WHERE pieza_id = $1
       AND fase = (SELECT min(fase) FROM portal.pieza_fases
                   WHERE pieza_id = $1 AND estado = 'pendiente')`,
    [piezaId],
    ejecutor,
  );
}

/**
 * Regresa la pieza a una fase ya completada: la que estaba en curso vuelve a
 * pendiente y `fase` vuelve a estar en curso.
 */
export async function regresarFase(
  piezaId: number,
  fase: NumeroFase,
  ejecutor: Ejecutor,
): Promise<void> {
  await ejecutar(
    `UPDATE portal.pieza_fases
     SET estado = 'pendiente'
     WHERE pieza_id = $1 AND estado = 'en_curso'`,
    [piezaId],
    ejecutor,
  );

  await ejecutar(
    `UPDATE portal.pieza_fases
     SET estado = 'en_curso',
         completada_en = NULL,
         completada_por = NULL,
         ronda_completada = NULL
     WHERE pieza_id = $1 AND fase = $2`,
    [piezaId, fase],
    ejecutor,
  );
}

/** Pone o quita la fecha estimada y el responsable de una fase. */
export async function planificarFase(
  piezaId: number,
  fase: NumeroFase,
  plan: { fechaEstimada: string | null; responsableId: number | null },
  ejecutor: Ejecutor,
): Promise<boolean> {
  const filas = await ejecutar(
    `UPDATE portal.pieza_fases
     SET fecha_estimada = $3::date, responsable_id = $4
     WHERE pieza_id = $1 AND fase = $2`,
    [piezaId, fase, plan.fechaEstimada, plan.responsableId],
    ejecutor,
  );

  return filas > 0;
}

/**
 * El copy de la pieza. Null si quien pregunta no lo puede ver todavia: al
 * cliente la base no se lo da hasta la fase 5.
 */
export async function leerCopy(
  piezaId: number,
  ejecutor: Ejecutor,
): Promise<string | null> {
  const fila = await consultarUno<{ copy: string }>(
    "SELECT copy FROM portal.pieza_contenido WHERE pieza_id = $1",
    [piezaId],
    ejecutor,
  );

  return fila?.copy ?? null;
}

export async function guardarCopy(
  piezaId: number,
  copy: string,
  usuarioId: number,
  ejecutor: Ejecutor,
): Promise<boolean> {
  const filas = await ejecutar(
    `UPDATE portal.pieza_contenido
     SET copy = $2, actualizado_por = $3
     WHERE pieza_id = $1`,
    [piezaId, copy, usuarioId],
    ejecutor,
  );

  return filas > 0;
}

/**
 * Reabre fases ya completadas de una pieza y deja en curso la primera de las
 * que quedan por hacer. Lo usa el ajuste de la ruta de una correccion: las
 * fases anadidas vuelven a pendiente aunque se hubieran conservado.
 */
export async function reabrirFases(
  piezaId: number,
  fases: readonly NumeroFase[],
  ejecutor: Ejecutor,
): Promise<void> {
  await ejecutar(
    `UPDATE portal.pieza_fases
     SET estado = 'pendiente', completada_en = NULL, completada_por = NULL,
         ronda_completada = NULL
     WHERE pieza_id = $1 AND (fase = ANY($2::smallint[]) OR estado = 'en_curso')`,
    [piezaId, fases],
    ejecutor,
  );

  await ejecutar(
    `UPDATE portal.pieza_fases
     SET estado = 'en_curso'
     WHERE pieza_id = $1
       AND fase = (SELECT min(fase) FROM portal.pieza_fases
                   WHERE pieza_id = $1 AND estado = 'pendiente')`,
    [piezaId],
    ejecutor,
  );
}

/**
 * Si quien pregunta trabaja en la pieza o la gestiona: puede subir versiones
 * y escribir su copy. La respuesta es la de las funciones de la base.
 */
export async function puedeTrabajar(id: number, ejecutor: Ejecutor): Promise<boolean> {
  const fila = await consultarUno<{ puede: boolean }>(
    "SELECT portal.gestiona_pieza($1) OR portal.trabaja_en_pieza($1) AS puede",
    [id],
    ejecutor,
  );

  return fila?.puede ?? false;
}
