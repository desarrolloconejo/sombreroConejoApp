import { consultar, consultarUno, ejecutar, type Ejecutor } from "@/lib/db";
import type { NuevaNotificacion, Notificacion } from "@/types";

/**
 * Consultas sobre portal.notificaciones.
 *
 * El ejecutor es obligatorio: la tabla tiene seguridad por fila y cada quien
 * solo alcanza las suyas. Sin la conexion de `conSesion`, no devuelve nada.
 *
 * Ninguna funcion de lectura recibe un `usuarioId`: de quien son lo decide la
 * base, con la sesion declarada. Asi no hay forma de pedir por error las de
 * otra persona.
 */

/**
 * Notifica lo mismo a varias personas, una fila por cada una.
 *
 * Va en una sola sentencia con `unnest`, para que notificar a diez
 * administradores no sean diez viajes a la base. Devuelve cuantas filas
 * escribio.
 */
export async function crear(
  destinatarios: readonly number[],
  notificacion: NuevaNotificacion,
  ejecutor: Ejecutor,
): Promise<number> {
  // Sin repetidos: decirle dos veces lo mismo a la misma persona es ruido.
  const unicos = [...new Set(destinatarios)];

  if (unicos.length === 0) return 0;

  return ejecutar(
    `INSERT INTO portal.notificaciones
       (usuario_id, empresa_id, tipo, titulo, cuerpo, href)
     SELECT destinatario, $2, $3, $4, $5, $6
     FROM unnest($1::int[]) AS destinatario`,
    [
      unicos,
      notificacion.empresaId ?? null,
      notificacion.tipo,
      notificacion.titulo,
      notificacion.cuerpo ?? null,
      notificacion.href ?? null,
    ],
    ejecutor,
  );
}

/** Las ultimas de quien declaro la sesion, la mas reciente primero. */
export async function recientes(
  limite: number,
  ejecutor: Ejecutor,
): Promise<Notificacion[]> {
  const filas = await consultar<Omit<Notificacion, "id"> & { id: string }>(
    `SELECT id,
            tipo,
            titulo,
            cuerpo,
            href,
            creado_en AS "creadoEn",
            leida_en IS NOT NULL AS leida
     FROM portal.notificaciones
     ORDER BY creado_en DESC, id DESC
     LIMIT $1`,
    [Math.min(50, Math.max(1, Math.trunc(limite)))],
    ejecutor,
  );

  return filas.map((fila) => ({ ...fila, id: Number(fila.id) }));
}

/** Cuantas tiene sin leer quien declaro la sesion. */
export async function contarSinLeer(ejecutor: Ejecutor): Promise<number> {
  const fila = await consultarUno<{ total: string }>(
    `SELECT count(*)::text AS total
     FROM portal.notificaciones
     WHERE leida_en IS NULL`,
    [],
    ejecutor,
  );

  return Number(fila?.total ?? 0);
}

/** Marca como leidas todas las pendientes de quien declaro la sesion. */
export async function marcarTodasLeidas(ejecutor: Ejecutor): Promise<number> {
  return ejecutar(
    `UPDATE portal.notificaciones
     SET leida_en = now()
     WHERE leida_en IS NULL`,
    [],
    ejecutor,
  );
}
