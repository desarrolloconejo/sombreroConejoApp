import { consultar, consultarUno, ejecutar, type Ejecutor } from "@/lib/db";

/**
 * Prospectos y sus enlaces privados de brief (portal.prospectos y
 * portal.enlaces_brief).
 *
 * El token no se guarda: solo su hash (SHA-256 en hexadecimal). El token
 * viaja una vez, en el enlace; quien lo tiene llena ese brief y nada mas.
 */

export type EnlaceBrief = {
  id: number;
  prospectoId: number;
  empresaNombre: string;
  contactoNombre: string;
  email: string;
  formato: string;
  formatoVersion: number;
  venceEn: Date;
  revocadoEn: Date | null;
  creadoEn: Date;
  briefId: number | null;
  briefEstado: string | null;
};

/** Da de alta un prospecto. Devuelve su id. */
export async function crearProspecto(
  datos: { empresaNombre: string; contactoNombre: string; email: string; telefono: string | null },
  creadoPor: number,
  ejecutor: Ejecutor,
): Promise<number> {
  const fila = await consultarUno<{ id: number }>(
    `INSERT INTO portal.prospectos (empresa_nombre, contacto_nombre, email, telefono, creado_por)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [datos.empresaNombre, datos.contactoNombre, datos.email, datos.telefono, creadoPor],
    ejecutor,
  );
  if (!fila) throw new Error("No se pudo crear el prospecto");
  return fila.id;
}

/** Crea el enlace de un prospecto para un formato. Devuelve su id. */
export async function crear(
  datos: { tokenHash: string; prospectoId: number; formato: string; formatoVersion: number; dias: number },
  creadoPor: number,
  ejecutor: Ejecutor,
): Promise<number> {
  const fila = await consultarUno<{ id: number }>(
    `INSERT INTO portal.enlaces_brief
       (token_hash, prospecto_id, formato, formato_version, vence_en, creado_por)
     VALUES ($1, $2, $3, $4, now() + make_interval(days => $5::int), $6)
     RETURNING id`,
    [datos.tokenHash, datos.prospectoId, datos.formato, datos.formatoVersion, datos.dias, creadoPor],
    ejecutor,
  );
  if (!fila) throw new Error("No se pudo crear el enlace");
  return fila.id;
}

/**
 * El enlace de un token, si sigue valido. Se consulta sin identidad: quien
 * llega por el enlace aun no es nadie para la base.
 */
export async function porToken(
  tokenHash: string,
  ejecutor: Ejecutor,
): Promise<{ id: number; prospectoId: number; formato: string; formatoVersion: number } | null> {
  return consultarUno(
    `SELECT id, prospecto_id AS "prospectoId", formato, formato_version AS "formatoVersion"
     FROM portal.enlace_por_token($1)`,
    [tokenHash],
    ejecutor,
  );
}

const COLUMNAS = `
  e.id,
  e.prospecto_id      AS "prospectoId",
  p.empresa_nombre    AS "empresaNombre",
  p.contacto_nombre   AS "contactoNombre",
  p.email,
  e.formato,
  e.formato_version   AS "formatoVersion",
  e.vence_en          AS "venceEn",
  e.revocado_en       AS "revocadoEn",
  e.creado_en         AS "creadoEn",
  b.id                AS "briefId",
  b.estado            AS "briefEstado"
`;

const DESDE = `
  FROM portal.enlaces_brief e
  JOIN portal.prospectos p ON p.id = e.prospecto_id
  LEFT JOIN portal.briefs b ON b.enlace_id = e.id
`;

/** Los enlaces que ve quien pregunta: los suyos, o todos si es admin. */
export async function listar(ejecutor: Ejecutor): Promise<EnlaceBrief[]> {
  return consultar<EnlaceBrief>(
    `SELECT ${COLUMNAS} ${DESDE} ORDER BY e.creado_en DESC LIMIT 100`,
    [],
    ejecutor,
  );
}

export async function buscarPorId(id: number, ejecutor: Ejecutor): Promise<EnlaceBrief | null> {
  return consultarUno<EnlaceBrief>(`SELECT ${COLUMNAS} ${DESDE} WHERE e.id = $1`, [id], ejecutor);
}

/** Lo deja sin efecto. */
export async function revocar(id: number, ejecutor: Ejecutor): Promise<boolean> {
  const filas = await ejecutar(
    "UPDATE portal.enlaces_brief SET revocado_en = now() WHERE id = $1 AND revocado_en IS NULL",
    [id],
    ejecutor,
  );
  return filas === 1;
}

/** Le da otros 7 dias desde ahora (S-06), si no esta revocado. */
export async function renovar(id: number, dias: number, ejecutor: Ejecutor): Promise<boolean> {
  const filas = await ejecutar(
    `UPDATE portal.enlaces_brief SET vence_en = now() + make_interval(days => $2::int)
     WHERE id = $1 AND revocado_en IS NULL`,
    [id, dias],
    ejecutor,
  );
  return filas === 1;
}
