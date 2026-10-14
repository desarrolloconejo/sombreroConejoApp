import { consultar, ejecutar, type Ejecutor } from "@/lib/db";
import type { Renglon, RenglonNuevo, TipoDocumento } from "@/types";

/**
 * Los renglones de presupuestos y proformas (finanzas.documento_items).
 *
 * Se leen como cualquier tabla, con las politicas de su documento. Se
 * escriben SOLO con `finanzas.guardar_renglones`, que sustituye todos los de
 * un borrador y recalcula sus importes en la base.
 */

const COLUMNA_DEL_DOCUMENTO: Record<TipoDocumento, string> = {
  presupuesto: "presupuesto_id",
  proforma: "proforma_id",
};

/** Los renglones de un documento, en orden. */
export async function deDocumento(
  tipo: TipoDocumento,
  id: number,
  ejecutor: Ejecutor,
): Promise<Renglon[]> {
  return consultar<Renglon>(
    `SELECT id, orden, descripcion,
            cantidad::text           AS cantidad,
            precio_unitario::text    AS "precioUnitario",
            exento,
            subtotal::text           AS subtotal
     FROM finanzas.documento_items
     WHERE ${COLUMNA_DEL_DOCUMENTO[tipo]} = $1
     ORDER BY orden, id`,
    [id],
    ejecutor,
  );
}

/**
 * Sustituye los renglones de un borrador y recalcula sus importes.
 *
 * Los valores ya vienen validados y normalizados por la action; la base los
 * vuelve a comprobar con sus CHECK.
 */
export async function guardar(
  tipo: TipoDocumento,
  id: number,
  renglones: readonly RenglonNuevo[],
  ejecutor: Ejecutor,
): Promise<void> {
  await ejecutar(
    "SELECT finanzas.guardar_renglones($1, $2, $3::jsonb)",
    [tipo, id, JSON.stringify(renglones)],
    ejecutor,
  );
}
