import { consultar, consultarUno, ejecutar, type Ejecutor } from "@/lib/db";
import type { DatosNuevoPago, Pago } from "@/types";

/**
 * Consultas sobre finanzas.pagos: pagos y retenciones de una factura.
 *
 * El cliente con permiso de finanzas reporta (siempre por confirmar, a su
 * nombre) y lee los de sus facturas; el operador lee todo, registra a nombre
 * del cliente y confirma o rechaza. Lo reportado no cambia nunca: lo impide
 * la base.
 */

const COLUMNAS = `
  p.id,
  p.factura_id                                       AS "facturaId",
  f.serie || '-' || lpad(f.numero::text, 6, '0')     AS "facturaNumero",
  e.nombre                                           AS "empresaNombre",
  p.tipo,
  p.medio_id                                         AS "medioId",
  m.nombre                                           AS "medioNombre",
  p.referencia,
  p.fecha_pago::text                                 AS "fechaPago",
  p.monto::text                                      AS monto,
  p.moneda,
  (p.comprobante_archivo IS NOT NULL)                AS "tieneComprobante",
  p.estado,
  p.monto_aplicado::text                             AS "montoAplicado",
  p.tasa_aplicada::text                              AS "tasaAplicada",
  p.motivo_rechazo                                   AS "motivoRechazo",
  r.nombre || ' ' || r.apellido                      AS "reportadoPorNombre",
  p.reportado_en                                     AS "reportadoEn",
  p.a_nombre_del_cliente                             AS "aNombreDelCliente",
  s.nombre || ' ' || s.apellido                      AS "resueltoPorNombre",
  p.resuelto_en                                      AS "resueltoEn"
`;

const DESDE = `
  FROM finanzas.pagos p
  JOIN finanzas.facturas f ON f.id = p.factura_id
  JOIN empresas e ON e.id = f.empresa_id
  JOIN usuarios r ON r.id = p.reportado_por
  LEFT JOIN usuarios s ON s.id = p.resuelto_por
  LEFT JOIN finanzas.medios_pago m ON m.id = p.medio_id
`;

export async function deFactura(facturaId: number, ejecutor: Ejecutor): Promise<Pago[]> {
  return consultar<Pago>(
    `SELECT ${COLUMNAS} ${DESDE} WHERE p.factura_id = $1 ORDER BY p.reportado_en DESC, p.id DESC`,
    [facturaId],
    ejecutor,
  );
}

/** Los que esperan que el operador los confirme, los mas viejos primero. */
export async function porConfirmar(ejecutor: Ejecutor): Promise<Pago[]> {
  return consultar<Pago>(
    `SELECT ${COLUMNAS} ${DESDE} WHERE p.estado = 'por_confirmar' ORDER BY p.reportado_en, p.id LIMIT 100`,
    [],
    ejecutor,
  );
}

export async function buscarPorId(id: number, ejecutor: Ejecutor): Promise<Pago | null> {
  return consultarUno<Pago>(`SELECT ${COLUMNAS} ${DESDE} WHERE p.id = $1`, [id], ejecutor);
}

/** Donde esta el comprobante, para entregarlo. Nunca sale al navegador. */
export async function comprobanteDe(
  id: number,
  ejecutor: Ejecutor,
): Promise<{ archivo: string; mime: string; nombre: string } | null> {
  return consultarUno(
    `SELECT comprobante_archivo AS archivo,
            comprobante_mime    AS mime,
            CASE WHEN tipo = 'pago' THEN 'pago' ELSE 'retencion' END
              || '-' || id || '-' || fecha_pago::text AS nombre
     FROM finanzas.pagos WHERE id = $1 AND comprobante_archivo IS NOT NULL`,
    [id],
    ejecutor,
  );
}

/**
 * Reporta un pago o una retencion. Devuelve su id. El id se reserva antes:
 * con seguridad por fila, un INSERT ... RETURNING exige poder leer la fila.
 */
export async function reportar(datos: DatosNuevoPago, usuarioId: number, ejecutor: Ejecutor): Promise<number> {
  const fila = await consultarUno<{ id: string }>(
    "SELECT nextval('finanzas.pagos_id_seq')::text AS id",
    [],
    ejecutor,
  );
  if (!fila) throw new Error("No se pudo reservar el identificador del pago");

  await ejecutar(
    `INSERT INTO finanzas.pagos (
       id, factura_id, tipo, medio_id, referencia, fecha_pago, monto, moneda,
       comprobante_archivo, comprobante_mime, reportado_por, a_nombre_del_cliente
     ) VALUES ($1, $2, $3, $4, $5, $6, $7::numeric, $8, $9, $10, $11, $12)`,
    [
      fila.id,
      datos.facturaId,
      datos.tipo,
      datos.medioId,
      datos.referencia,
      datos.fechaPago,
      datos.monto,
      datos.moneda,
      datos.comprobanteArchivo,
      datos.comprobanteMime,
      usuarioId,
      datos.aNombreDelCliente,
    ],
    ejecutor,
  );

  return Number(fila.id);
}

/** Confirma un pago por confirmar con el monto que se aplica a la factura. */
export async function confirmar(
  id: number,
  datos: { montoAplicado: string; tasaAplicada: string | null },
  usuarioId: number,
  ejecutor: Ejecutor,
): Promise<boolean> {
  const filas = await ejecutar(
    `UPDATE finanzas.pagos SET
       estado = 'confirmado', monto_aplicado = $2::numeric, tasa_aplicada = $3::numeric,
       resuelto_por = $4, resuelto_en = now()
     WHERE id = $1 AND estado = 'por_confirmar'`,
    [id, datos.montoAplicado, datos.tasaAplicada, usuarioId],
    ejecutor,
  );
  return filas === 1;
}

export async function rechazar(id: number, motivo: string, usuarioId: number, ejecutor: Ejecutor): Promise<boolean> {
  const filas = await ejecutar(
    `UPDATE finanzas.pagos SET
       estado = 'rechazado', motivo_rechazo = $2, resuelto_por = $3, resuelto_en = now()
     WHERE id = $1 AND estado = 'por_confirmar'`,
    [id, motivo, usuarioId],
    ejecutor,
  );
  return filas === 1;
}

/** Quien reporto un pago, salvo que lo registrara un operador a nombre del cliente. */
export async function reportadoPor(id: number, ejecutor: Ejecutor): Promise<number | null> {
  const fila = await consultarUno<{ id: number }>(
    "SELECT reportado_por AS id FROM finanzas.pagos WHERE id = $1 AND NOT a_nombre_del_cliente",
    [id],
    ejecutor,
  );
  return fila?.id ?? null;
}
