import { consultarUno, ejecutar, type Ejecutor } from "@/lib/db";

/**
 * Consultas sobre restablecimientos_clave: los enlaces de «Olvide mi
 * contrasena». Solo se guarda el hash del token.
 */

/** Cuantos enlaces pidio una persona en la ultima hora. */
export async function pedidosRecientes(usuarioId: number, ejecutor: Ejecutor): Promise<number> {
  const fila = await consultarUno<{ total: number }>(
    `SELECT count(*)::int AS total FROM restablecimientos_clave
     WHERE usuario_id = $1 AND creado_en > now() - interval '1 hour'`,
    [usuarioId],
    ejecutor,
  );

  return fila?.total ?? 0;
}

/** Guarda un enlace nuevo, que vence a los `minutos`. */
export async function crear(
  usuarioId: number,
  tokenHash: string,
  minutos: number,
  ejecutor: Ejecutor,
): Promise<void> {
  await ejecutar(
    `INSERT INTO restablecimientos_clave (usuario_id, token_hash, vence_en)
     VALUES ($1, $2, now() + make_interval(mins => $3))`,
    [usuarioId, tokenHash, minutos],
    ejecutor,
  );
}

/** De quien es un enlace que aun sirve (sin usar y sin vencer), o null. */
export async function vigente(tokenHash: string, ejecutor?: Ejecutor): Promise<number | null> {
  const fila = await consultarUno<{ usuarioId: number }>(
    `SELECT usuario_id AS "usuarioId" FROM restablecimientos_clave
     WHERE token_hash = $1 AND usado_en IS NULL AND vence_en > now()`,
    [tokenHash],
    ejecutor,
  );

  return fila?.usuarioId ?? null;
}

/**
 * Gasta un enlace: si aun servia, lo marca usado junto con los demas de la
 * misma persona y devuelve de quien es. Null si ya no servia. Es una sola
 * sentencia, asi que dos usos a la vez no pasan los dos.
 */
export async function usar(tokenHash: string, ejecutor: Ejecutor): Promise<number | null> {
  const fila = await consultarUno<{ usuarioId: number }>(
    `UPDATE restablecimientos_clave
     SET usado_en = now()
     WHERE token_hash = $1 AND usado_en IS NULL AND vence_en > now()
     RETURNING usuario_id AS "usuarioId"`,
    [tokenHash],
    ejecutor,
  );

  if (!fila) return null;

  await ejecutar(
    "UPDATE restablecimientos_clave SET usado_en = now() WHERE usuario_id = $1 AND usado_en IS NULL",
    [fila.usuarioId],
    ejecutor,
  );

  return fila.usuarioId;
}
