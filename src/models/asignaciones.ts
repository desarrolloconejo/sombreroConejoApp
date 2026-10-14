import { consultar, consultarUno, type Ejecutor } from "@/lib/db";
import type { Asignacion, PersonaBreve } from "@/types";

/**
 * Consultas sobre portal.asignaciones: que ejecutivo atiende a que empresa.
 *
 * El ejecutor es obligatorio: la tabla tiene seguridad por fila. El admin las
 * ve todas y es el unico que las cambia; un ejecutivo solo ve las suyas.
 */

const COLUMNAS = `
  a.id,
  a.usuario_id                       AS "usuarioId",
  u.nombre || ' ' || u.apellido      AS "usuarioNombre",
  a.empresa_id                       AS "empresaId",
  e.nombre                           AS "empresaNombre",
  a.creado_en                        AS "creadoEn"
`;

const DESDE = `
  FROM portal.asignaciones a
  JOIN usuarios u ON u.id = a.usuario_id
  JOIN empresas e ON e.id = a.empresa_id
`;

/** Los ejecutivos que atienden a una empresa. */
export async function deEmpresa(
  empresaId: number,
  ejecutor: Ejecutor,
): Promise<Asignacion[]> {
  return consultar<Asignacion>(
    `SELECT ${COLUMNAS} ${DESDE}
     WHERE a.empresa_id = $1
     ORDER BY lower(u.nombre), lower(u.apellido)`,
    [empresaId],
    ejecutor,
  );
}

/** Las empresas que atiende una persona. */
export async function deUsuario(
  usuarioId: number,
  ejecutor: Ejecutor,
): Promise<Asignacion[]> {
  return consultar<Asignacion>(
    `SELECT ${COLUMNAS} ${DESDE}
     WHERE a.usuario_id = $1
     ORDER BY lower(e.nombre)`,
    [usuarioId],
    ejecutor,
  );
}

/** Asigna una empresa a un ejecutivo. Devuelve null si ya lo estaba. */
export async function crear(
  usuarioId: number,
  empresaId: number,
  creadoPor: number,
  ejecutor: Ejecutor,
): Promise<number | null> {
  const fila = await consultarUno<{ id: number }>(
    `INSERT INTO portal.asignaciones (usuario_id, empresa_id, creado_por)
     VALUES ($1, $2, $3)
     ON CONFLICT (usuario_id, empresa_id) DO NOTHING
     RETURNING id`,
    [usuarioId, empresaId, creadoPor],
    ejecutor,
  );

  return fila?.id ?? null;
}

/** Quita una asignacion. Devuelve la que quito, o null si no existia. */
export async function quitar(id: number, ejecutor: Ejecutor): Promise<Asignacion | null> {
  return consultarUno<Asignacion>(
    `WITH a AS (
       DELETE FROM portal.asignaciones WHERE id = $1
       RETURNING id, usuario_id, empresa_id, creado_en
     )
     SELECT ${COLUMNAS}
     FROM a
     JOIN usuarios u ON u.id = a.usuario_id
     JOIN empresas e ON e.id = a.empresa_id`,
    [id],
    ejecutor,
  );
}

/** Cuantas empresas tiene asignadas una persona. */
export async function contarDe(usuarioId: number, ejecutor: Ejecutor): Promise<number> {
  const fila = await consultarUno<{ total: number }>(
    "SELECT count(*)::int AS total FROM portal.asignaciones WHERE usuario_id = $1",
    [usuarioId],
    ejecutor,
  );

  return fila?.total ?? 0;
}

/**
 * Quien puede ser ejecutivo: los trabajadores activos del cargo `cuentas`.
 * El admin no hace falta asignarlo: ya ve todas las empresas.
 */
export async function candidatos(ejecutor: Ejecutor): Promise<PersonaBreve[]> {
  return consultar<PersonaBreve>(
    `SELECT id, nombre || ' ' || apellido AS nombre
     FROM vw_usuarios_completos
     WHERE activo AND tipo = 'trabajador' AND cargo_slug = 'cuentas'
     ORDER BY lower(nombre), lower(apellido)`,
    [],
    ejecutor,
  );
}
