import {
  consultar,
  consultarUno,
  ejecutar,
  transaccion,
  type Ejecutor,
} from "@/lib/db";
import type { MotivoRevocacion, SesionAbierta } from "@/types";

/**
 * Consultas sobre la tabla sesiones.
 *
 * Aqui nunca entra ni sale un token: solo su hash. Calcularlo es cosa de
 * `src/lib/tokens.ts`; este modulo no sabe de criptografia.
 */

/**
 * Margen durante el que el token anterior a una rotacion sigue sin ser senal
 * de robo.
 *
 * Dos pestanas pueden pedir la renovacion a la vez con el mismo token: la
 * primera lo rota y la segunda llega con uno que acaba de dejar de valer. No
 * es un ataque, es una carrera, y el navegador ya tiene la cookie nueva que
 * dejo la primera. Pasado este margen, presentar el token viejo solo puede
 * significar que alguien lo copio.
 */
const MARGEN_DE_CARRERA = "20 seconds";

/** Abre una sesion y devuelve su identificador. */
export async function crear(datos: {
  usuarioId: number;
  tokenHash: string;
  navegador: string | null;
  duracionSegundos: number;
}): Promise<{ id: number; caducaEn: Date }> {
  const fila = await consultarUno<{ id: string; caducaEn: Date }>(
    `INSERT INTO sesiones (usuario_id, token_hash, navegador, caduca_en)
     VALUES ($1, $2, $3, now() + make_interval(secs => $4))
     RETURNING id, caduca_en AS "caducaEn"`,
    [datos.usuarioId, datos.tokenHash, datos.navegador, datos.duracionSegundos],
  );

  if (!fila) throw new Error("La insercion de la sesion no devolvio ninguna fila");

  // BIGSERIAL llega como texto. Los identificadores de sesion no se acercan
  // al limite de un entero seguro, asi que se manejan como numero.
  return { id: Number(fila.id), caducaEn: fila.caducaEn };
}

/** Lo que devuelve una renovacion que salio bien. */
export type Renovacion = {
  sesionId: number;
  usuarioId: number;
  caducaEn: Date;

  /**
   * Si el token se cambio por el nuevo. Es falso cuando llego el token
   * anterior dentro del margen de carrera: la sesion sigue, pero la cookie
   * buena es la que ya dejo la otra peticion y no hay que pisarla.
   */
  rotada: boolean;
};

/**
 * Cambia el token de renovacion por uno nuevo.
 *
 * Devuelve null si el token no corresponde a ninguna sesion viva. Si lo que
 * llega es un token ya rotado y fuera del margen, ademas REVOCA la sesion:
 * alguien tiene una copia, y no se sabe si quien pregunta es el dueno o el
 * ladron.
 *
 * Va en una transaccion con la fila bloqueada, para que dos renovaciones
 * simultaneas no roten las dos.
 */
export async function rotar(
  tokenHash: string,
  nuevoTokenHash: string,
): Promise<Renovacion | null> {
  return transaccion(async (cliente) => {
    const fila = await consultarUno<{
      id: string;
      usuarioId: number;
      caducaEn: Date;
      esActual: boolean;
      viva: boolean;
      enMargen: boolean;
    }>(
      `SELECT id,
              usuario_id AS "usuarioId",
              caduca_en  AS "caducaEn",
              token_hash = $1 AS "esActual",
              (revocada_en IS NULL AND caduca_en > now()) AS viva,
              (rotada_en IS NOT NULL
                 AND rotada_en > now() - $2::interval) AS "enMargen"
       FROM sesiones
       WHERE token_hash = $1 OR token_anterior_hash = $1
       ORDER BY (token_hash = $1) DESC
       LIMIT 1
       FOR UPDATE`,
      [tokenHash, MARGEN_DE_CARRERA],
      cliente,
    );

    if (!fila || !fila.viva) return null;

    const base = {
      sesionId: Number(fila.id),
      usuarioId: fila.usuarioId,
      caducaEn: fila.caducaEn,
    };

    if (fila.esActual) {
      await ejecutar(
        `UPDATE sesiones
         SET token_anterior_hash = token_hash,
             token_hash = $2,
             rotada_en  = now(),
             ultimo_uso = now()
         WHERE id = $1`,
        [fila.id, nuevoTokenHash],
        cliente,
      );

      return { ...base, rotada: true };
    }

    if (fila.enMargen) return { ...base, rotada: false };

    await ejecutar(
      `UPDATE sesiones
       SET revocada_en = now(), motivo_revocacion = 'token_reutilizado'
       WHERE id = $1`,
      [fila.id],
      cliente,
    );

    return null;
  });
}

/** Revoca una sesion concreta. No hace nada si ya lo estaba. */
export async function revocar(
  id: number,
  motivo: MotivoRevocacion,
  ejecutor?: Ejecutor,
): Promise<void> {
  await ejecutar(
    `UPDATE sesiones
     SET revocada_en = now(), motivo_revocacion = $2
     WHERE id = $1 AND revocada_en IS NULL`,
    [id, motivo],
    ejecutor,
  );
}

/**
 * Revoca la sesion a la que pertenece un token de renovacion.
 *
 * Devuelve de quien era, o null si el token no correspondia a ninguna sesion
 * viva: es lo que permite anotar el cierre a nombre de alguien aunque su
 * token de acceso ya hubiera caducado.
 */
export async function revocarPorToken(
  tokenHash: string,
  motivo: MotivoRevocacion,
  ejecutor?: Ejecutor,
): Promise<number | null> {
  const fila = await consultarUno<{ usuarioId: number }>(
    `UPDATE sesiones
     SET revocada_en = now(), motivo_revocacion = $2
     WHERE token_hash = $1 AND revocada_en IS NULL
     RETURNING usuario_id AS "usuarioId"`,
    [tokenHash, motivo],
    ejecutor,
  );

  return fila?.usuarioId ?? null;
}

/**
 * Revoca las sesiones vivas de una persona y devuelve cuantas eran.
 *
 * `salvo` deja una fuera: al cambiar la propia contrasena se cierran las demas
 * sesiones, no la que se esta usando para cambiarla.
 */
export async function revocarDeUsuario(
  usuarioId: number,
  motivo: MotivoRevocacion,
  salvo: number | null = null,
  ejecutor?: Ejecutor,
): Promise<number> {
  return ejecutar(
    `UPDATE sesiones
     SET revocada_en = now(), motivo_revocacion = $2
     WHERE usuario_id = $1
       AND revocada_en IS NULL
       AND ($3::bigint IS NULL OR id <> $3)`,
    [usuarioId, motivo, salvo],
    ejecutor,
  );
}

/** Revoca las sesiones vivas de todas las personas de una empresa. */
export async function revocarDeEmpresa(
  empresaId: number,
  motivo: MotivoRevocacion,
  ejecutor?: Ejecutor,
): Promise<number> {
  return ejecutar(
    `UPDATE sesiones s
     SET revocada_en = now(), motivo_revocacion = $2
     FROM clientes c
     WHERE c.usuario_id = s.usuario_id
       AND c.empresa_id = $1
       AND s.revocada_en IS NULL`,
    [empresaId, motivo],
    ejecutor,
  );
}

/** Las sesiones abiertas de una persona, la mas reciente primero. */
export async function listarAbiertas(usuarioId: number): Promise<SesionAbierta[]> {
  const filas = await consultar<Omit<SesionAbierta, "id"> & { id: string }>(
    `SELECT id,
            navegador,
            creada_en  AS "creadaEn",
            ultimo_uso AS "ultimoUso",
            caduca_en  AS "caducaEn"
     FROM sesiones
     WHERE usuario_id = $1 AND revocada_en IS NULL AND caduca_en > now()
     ORDER BY ultimo_uso DESC, id DESC`,
    [usuarioId],
  );

  return filas.map((fila) => ({ ...fila, id: Number(fila.id) }));
}
