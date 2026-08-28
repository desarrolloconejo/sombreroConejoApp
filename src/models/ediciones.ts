import { consultar, ejecutar, type Ejecutor } from "@/lib/db";
import type { AccionEdicion, EdicionFicha } from "@/types";

/**
 * El historial de cambios de una ficha: quien la toco y cuando.
 *
 * SOLO SE ANADE
 * -------------
 * No hay `actualizar` ni `borrar`, y no es un descuido. Un registro de cambios
 * que se puede reescribir no sirve para lo unico que sirve un registro de
 * cambios. Las filas se van solas cuando se borra la ficha, por el CASCADE del
 * esquema.
 *
 * QUIEN LO ESCRIBE
 * ----------------
 * Las actions, no los modelos. Este archivo recibe el usuario ya resuelto
 * porque un modelo no conoce la sesion, igual que pasa con `creado_por` en
 * `fichas`.
 */

export async function registrar(
  fichaId: number,
  usuarioId: number,
  accion: AccionEdicion,
  ejecutor?: Ejecutor,
): Promise<void> {
  await ejecutar(
    `INSERT INTO ediciones_ficha (ficha_id, usuario_id, accion)
     VALUES ($1, $2, $3)`,
    [fichaId, usuarioId, accion],
    ejecutor,
  );
}

/**
 * El historial de una ficha, de lo mas reciente a lo mas antiguo.
 *
 * El nombre sale del JOIN y puede venir nulo: la cuenta pudo desaparecer, pero
 * el cambio ocurrio igual y la fila se queda. Quien lo pinta decide que decir
 * en ese caso.
 */
export async function listarDeFicha(fichaId: number): Promise<EdicionFicha[]> {
  return consultar<EdicionFicha>(
    `SELECT
       e.id,
       e.ficha_id   AS "fichaId",
       e.usuario_id AS "usuarioId",
       u.nombre     AS "usuarioNombre",
       e.accion,
       e.creado_en  AS "creadoEn"
     FROM ediciones_ficha e
     LEFT JOIN usuarios u ON u.id = e.usuario_id
     WHERE e.ficha_id = $1
     ORDER BY e.creado_en DESC, e.id DESC`,
    [fichaId],
  );
}

/**
 * Cuantos cambios tiene cada ficha del lote.
 *
 * Se pregunta por la pagina entera de una vez: el historial pinta hasta veinte
 * filas y una consulta por fila serian veinte viajes para decidir un numero.
 * Las fichas sin ningun cambio registrado no salen en el mapa.
 */
export async function contarPorFicha(
  ids: number[],
): Promise<Map<number, number>> {
  if (ids.length === 0) return new Map();

  const filas = await consultar<{ fichaId: number; total: string }>(
    `SELECT ficha_id AS "fichaId", count(*)::text AS total
     FROM ediciones_ficha
     WHERE ficha_id = ANY($1)
     GROUP BY ficha_id`,
    [ids],
  );

  return new Map(filas.map((fila) => [fila.fichaId, Number(fila.total)]));
}
