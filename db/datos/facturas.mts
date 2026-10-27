/**
 * Las facturas de ejemplo de la semilla de desarrollo.
 *
 * Llena el emisor con datos FICTICIOS (en produccion nace vacio y lo llena el
 * responsable, docs/pendientes.md V1), deja una tasa del dia si no
 * la hay, factura la proforma emitida del empaque y deja un pago reportado
 * por el cliente, por confirmar.
 *
 * Se escribe como lo haria un operador: con la sesion declarada y pasando
 * por `finanzas.emitir_factura`, que numera y calcula.
 *
 * Solo para desarrollo: `sql:produccion` no lo incluye.
 */
import type { Client } from "pg";

export const EMISOR_DE_EJEMPLO = {
  razonSocial: "Agencia de Ejemplo, C.A.",
  rif: "J-00000000-0",
  domicilio: "Av. de Ejemplo, Edif. Prueba, piso 1, Caracas",
};

/** Una tasa ficticia para poder emitir cuando aun no se leyo la del BCV. */
const TASA_DE_EJEMPLO = "40.50000000";

export async function sembrarFacturas(
  cliente: Client,
  empresaId: number,
  firmas: { admin: number; cliente: number },
): Promise<number> {
  const { rows: existentes } = await cliente.query("SELECT 1 FROM finanzas.facturas LIMIT 1");
  if (existentes.length > 0) return 0;

  await cliente.query("BEGIN");

  try {
    await cliente.query("SELECT set_config('app.usuario_id', $1, true)", [String(firmas.admin)]);
    await cliente.query("SELECT set_config('app.rol', 'admin', true)");

    await cliente.query(
      `UPDATE finanzas.ajustes SET
         emisor_razon_social = coalesce(emisor_razon_social, $1),
         emisor_rif          = coalesce(emisor_rif, $2),
         emisor_domicilio    = coalesce(emisor_domicilio, $3)
       WHERE id = 1`,
      [EMISOR_DE_EJEMPLO.razonSocial, EMISOR_DE_EJEMPLO.rif, EMISOR_DE_EJEMPLO.domicilio],
    );

    await cliente.query(
      `INSERT INTO finanzas.tasas_cambio (fuente, moneda, fecha_valor, valor, origen, registrada_por)
       SELECT 'bcv', 'USD', finanzas.hoy(), $1::numeric, 'manual', $2
       WHERE NOT EXISTS (
         SELECT 1 FROM finanzas.tasas_cambio WHERE fuente = 'bcv' AND moneda = 'USD' AND fecha_valor <= finanzas.hoy()
       )`,
      [TASA_DE_EJEMPLO, firmas.admin],
    );

    const { rows: proforma } = await cliente.query<{ id: number }>(
      `SELECT id FROM finanzas.proformas
       WHERE empresa_id = $1 AND estado = 'emitida' AND NOT recurrente
       ORDER BY id LIMIT 1`,
      [empresaId],
    );
    if (proforma.length === 0) {
      await cliente.query("ROLLBACK");
      return 0;
    }

    const { rows: emitida } = await cliente.query<{ id: number }>("SELECT finanzas.emitir_factura($1) AS id", [
      proforma[0].id,
    ]);
    const { rows: factura } = await cliente.query<{ id: number; total: string }>(
      "SELECT id, total::text AS total FROM finanzas.facturas WHERE id = $1",
      [emitida[0].id],
    );

    const { rows: medio } = await cliente.query<{ id: number }>(
      "SELECT id FROM finanzas.medios_pago WHERE nombre = 'Transferencia bancaria'",
    );

    // El pago lo reporta la persona de la empresa: va a su nombre.
    await cliente.query(
      `INSERT INTO finanzas.pagos
         (factura_id, tipo, medio_id, referencia, fecha_pago, monto, moneda, reportado_por)
       VALUES ($1, 'pago', $2, '000123456', finanzas.hoy(), round($3::numeric / 2, 2), 'VES', $4)`,
      [factura[0].id, medio[0]?.id ?? null, factura[0].total, firmas.cliente],
    );

    await cliente.query("COMMIT");
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  }

  return 1;
}
