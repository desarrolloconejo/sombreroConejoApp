import { consultarUno, ejecutar, type Ejecutor } from "@/lib/db";

/**
 * Consultas de la verificacion en dos pasos.
 *
 * Aqui el secreto entra y sale CIFRADO: este modulo no sabe descifrarlo ni
 * calcular codigos. De eso se encargan `src/lib/cifrado.ts` y
 * `src/lib/totp.ts`.
 */

/** Lo que hace falta para comprobar un segundo paso. */
export type CredencialesDeDosPasos = {
  /** El secreto, cifrado. Nulo si nunca se empezo a activar. */
  secretoCifrado: string | null;
  activado: boolean;
  ultimoPaso: number | null;
  bloqueado: boolean;
};

/** Lee de la vista de acceso, la unica que trae el secreto. */
export async function credenciales(
  usuarioId: number,
  ejecutor?: Ejecutor,
): Promise<CredencialesDeDosPasos | null> {
  const fila = await consultarUno<{
    secretoCifrado: string | null;
    activado: boolean;
    ultimoPaso: string | null;
    bloqueado: boolean;
  }>(
    `SELECT totp_secreto     AS "secretoCifrado",
            dos_pasos        AS activado,
            totp_ultimo_paso AS "ultimoPaso",
            bloqueado
     FROM vw_usuarios_acceso
     WHERE id = $1`,
    [usuarioId],
    ejecutor,
  );

  if (!fila) return null;

  return {
    ...fila,
    // BIGINT llega como texto. Un paso de 30 segundos cabe de sobra.
    ultimoPaso: fila.ultimoPaso === null ? null : Number(fila.ultimoPaso),
  };
}

/** Lo que se pinta en Mi perfil: si estan activados y cuantos respaldos quedan. */
export async function estado(
  usuarioId: number,
  ejecutor?: Ejecutor,
): Promise<{ activado: boolean; activadoEn: Date | null; respaldos: number }> {
  const fila = await consultarUno<{
    activadoEn: Date | null;
    respaldos: string;
  }>(
    `SELECT u.totp_activado_en AS "activadoEn",
            (SELECT count(*)::text FROM codigos_respaldo c
              WHERE c.usuario_id = u.id AND c.usado_en IS NULL) AS respaldos
     FROM usuarios u
     WHERE u.id = $1`,
    [usuarioId],
    ejecutor,
  );

  return {
    activado: Boolean(fila?.activadoEn),
    activadoEn: fila?.activadoEn ?? null,
    respaldos: Number(fila?.respaldos ?? 0),
  };
}

/**
 * Guarda el secreto de una activacion que empieza. Devuelve false si ya
 * estaban activados: un secreto en uso no se pisa.
 *
 * Mientras no se confirme con un codigo, el secreto esta pero los dos pasos
 * no: el login sigue sin pedirlos.
 */
export async function guardarSecretoPendiente(
  usuarioId: number,
  secretoCifrado: string,
  ejecutor?: Ejecutor,
): Promise<boolean> {
  const afectadas = await ejecutar(
    `UPDATE usuarios
     SET totp_secreto = $2, totp_ultimo_paso = NULL
     WHERE id = $1 AND totp_activado_en IS NULL`,
    [usuarioId, secretoCifrado],
    ejecutor,
  );

  return afectadas === 1;
}

/**
 * Activa los dos pasos y deja los codigos de respaldo.
 *
 * `paso` es el del codigo con el que se confirmo: se guarda para que ese
 * mismo codigo no sirva despues para entrar.
 */
export async function activar(
  usuarioId: number,
  paso: number,
  hashesDeRespaldo: readonly string[],
  ejecutor: Ejecutor,
): Promise<boolean> {
  const afectadas = await ejecutar(
    `UPDATE usuarios
     SET totp_activado_en = now(), totp_ultimo_paso = $2, dos_pasos_omitido = FALSE
     WHERE id = $1 AND totp_secreto IS NOT NULL AND totp_activado_en IS NULL`,
    [usuarioId, paso],
    ejecutor,
  );

  if (afectadas !== 1) return false;

  await ejecutar("DELETE FROM codigos_respaldo WHERE usuario_id = $1", [usuarioId], ejecutor);
  await ejecutar(
    `INSERT INTO codigos_respaldo (usuario_id, codigo_hash)
     SELECT $1, hash FROM unnest($2::text[]) AS hash`,
    [usuarioId, hashesDeRespaldo],
    ejecutor,
  );

  return true;
}

/**
 * Apunta el paso de un codigo aceptado. Devuelve false si ya se habia usado
 * ese o uno posterior.
 *
 * La comprobacion va DENTRO de la sentencia, no antes: dos peticiones
 * simultaneas con el mismo codigo no pueden pasar las dos.
 */
export async function registrarPaso(
  usuarioId: number,
  paso: number,
  ejecutor?: Ejecutor,
): Promise<boolean> {
  const afectadas = await ejecutar(
    `UPDATE usuarios
     SET totp_ultimo_paso = $2
     WHERE id = $1 AND (totp_ultimo_paso IS NULL OR totp_ultimo_paso < $2)`,
    [usuarioId, paso],
    ejecutor,
  );

  return afectadas === 1;
}

/**
 * Apunta que la persona prefiere no usar los dos pasos. Devuelve false si los
 * tiene activados: para dejarlos hay que desactivarlos, que pide la contrasena.
 */
export async function omitir(usuarioId: number, ejecutor: Ejecutor): Promise<boolean> {
  const afectadas = await ejecutar(
    `UPDATE usuarios
     SET dos_pasos_omitido = TRUE, totp_secreto = NULL, totp_ultimo_paso = NULL
     WHERE id = $1 AND totp_activado_en IS NULL`,
    [usuarioId],
    ejecutor,
  );

  return afectadas === 1;
}

/** Gasta un codigo de respaldo. Devuelve false si no existe o ya se uso. */
export async function usarRespaldo(
  usuarioId: number,
  codigoHash: string,
  ejecutor?: Ejecutor,
): Promise<boolean> {
  const afectadas = await ejecutar(
    `UPDATE codigos_respaldo
     SET usado_en = now()
     WHERE usuario_id = $1 AND codigo_hash = $2 AND usado_en IS NULL`,
    [usuarioId, codigoHash],
    ejecutor,
  );

  return afectadas === 1;
}

/**
 * Quita los dos pasos: el secreto y los codigos de respaldo.
 *
 * `omitir` dice que pasa despues. Si los quita la propia persona, es que no
 * los quiere y no se le vuelve a preguntar. Si se los retira un administrador
 * porque perdio el telefono, se le vuelve a pedir que los configure.
 */
export async function desactivar(
  usuarioId: number,
  omitir: boolean,
  ejecutor: Ejecutor,
): Promise<boolean> {
  const afectadas = await ejecutar(
    `UPDATE usuarios
     SET totp_secreto = NULL, totp_activado_en = NULL, totp_ultimo_paso = NULL,
         dos_pasos_omitido = $2
     WHERE id = $1 AND totp_secreto IS NOT NULL`,
    [usuarioId, omitir],
    ejecutor,
  );

  await ejecutar("DELETE FROM codigos_respaldo WHERE usuario_id = $1", [usuarioId], ejecutor);

  return afectadas === 1;
}
