import {
  consultar,
  consultarUno,
  ejecutar,
  escaparLike,
  identificadorSeguro,
  type Ejecutor,
} from "@/lib/db";
import type { CobranzaEmpresa, Factura, FiltrosFacturas, Pagina, RenglonFactura } from "@/types";

/**
 * Consultas sobre finanzas.facturas.
 *
 * Las lee el operador, y el cliente con permiso de finanzas las de su
 * empresa. Ninguna se inserta desde aqui: nacen con `finanzas.emitir_factura`
 * y solo cambian al anularse (`finanzas.anular_factura`) o al marcarse
 * impresas. Su estado de cobro sale de `finanzas.v_estado_cobro_factura`.
 */

const COLUMNAS = `
  f.id,
  f.serie,
  f.numero,
  f.numero_control                          AS "numeroControl",
  f.empresa_id                              AS "empresaId",
  e.nombre                                  AS "empresaNombre",
  f.proforma_id                             AS "proformaId",
  pf.numero                                 AS "proformaNumero",
  f.estado,
  f.fecha_emision::text                     AS "fechaEmision",
  f.vence_el::text                          AS "venceEl",
  f.tasa::text                              AS tasa,
  f.tasa_fuente                             AS "tasaFuente",
  f.tasa_fecha::text                        AS "tasaFecha",
  f.total_usd::text                         AS "totalUsd",
  f.base_imponible::text                    AS "baseImponible",
  f.monto_exento::text                      AS "montoExento",
  f.iva_pct::text                           AS "ivaPct",
  f.iva_monto::text                         AS "ivaMonto",
  f.total::text                             AS total,
  f.retencion_iva_pct::text                 AS "retencionIvaPct",
  f.retencion_esperada::text                AS "retencionEsperada",
  f.emisor,
  f.cliente,
  u.nombre || ' ' || u.apellido             AS "emitidaPorNombre",
  f.emitida_en                              AS "emitidaEn",
  f.impresa_en                              AS "impresaEn",
  f.anulada_en                              AS "anuladaEn",
  f.motivo_anulacion                        AS "motivoAnulacion",
  c.estado                                  AS cobro,
  c.pagado::text                            AS pagado,
  c.retenido::text                          AS retenido,
  c.saldo::text                             AS saldo,
  c.por_confirmar::int                      AS "porConfirmar",
  c.retencion_abierta                       AS "retencionAbierta",
  (f.estado = 'emitida' AND c.saldo > 0 AND f.vence_el < finanzas.hoy()) AS vencida
`;

const DESDE = `
  FROM finanzas.facturas f
  JOIN empresas e ON e.id = f.empresa_id
  JOIN finanzas.proformas pf ON pf.id = f.proforma_id
  JOIN usuarios u ON u.id = f.emitida_por
  JOIN finanzas.v_estado_cobro_factura c ON c.factura_id = f.id
`;

const COLUMNAS_ORDEN = {
  numero: "f.numero",
  fechaEmision: "f.fecha_emision",
  total: "f.total",
} as const;

export async function listar(filtros: FiltrosFacturas, ejecutor: Ejecutor): Promise<Pagina<Factura>> {
  const pagina = Math.max(1, Math.trunc(filtros.pagina ?? 1));
  const porPagina = Math.min(100, Math.max(1, Math.trunc(filtros.porPagina ?? 20)));

  const condiciones: string[] = [];
  const valores: unknown[] = [];

  if (filtros.busqueda?.trim()) {
    valores.push(`%${escaparLike(filtros.busqueda.trim())}%`);
    const marcador = `$${valores.length}`;
    condiciones.push(
      `(e.nombre ILIKE ${marcador} ESCAPE '\\' OR f.numero_control ILIKE ${marcador} ESCAPE '\\'
        OR f.numero::text = ltrim(regexp_replace(${marcador}, '[^0-9]', '', 'g'), '0'))`,
    );
  }

  if (filtros.cobro?.length) {
    valores.push(filtros.cobro);
    condiciones.push(`c.estado = ANY($${valores.length})`);
  }

  if (filtros.empresaId?.length) {
    valores.push(filtros.empresaId);
    condiciones.push(`f.empresa_id = ANY($${valores.length})`);
  }

  const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  const claveOrden = identificadorSeguro(
    filtros.orden ?? "numero",
    Object.keys(COLUMNAS_ORDEN) as (keyof typeof COLUMNAS_ORDEN)[],
  );
  const direccion = identificadorSeguro(filtros.direccion ?? "desc", ["asc", "desc"]);

  const totales = await consultarUno<{ total: string }>(
    `SELECT count(*)::text AS total ${DESDE} ${donde}`,
    valores,
    ejecutor,
  );
  const total = Number(totales?.total ?? 0);

  valores.push(porPagina, (pagina - 1) * porPagina);

  const filas = await consultar<Factura>(
    `SELECT ${COLUMNAS} ${DESDE}
     ${donde}
     ORDER BY ${COLUMNAS_ORDEN[claveOrden]} ${direccion.toUpperCase()}, f.id DESC
     LIMIT $${valores.length - 1} OFFSET $${valores.length}`,
    valores,
    ejecutor,
  );

  return { filas, total, pagina, porPagina, totalPaginas: Math.max(1, Math.ceil(total / porPagina)) };
}

export async function buscarPorId(id: number, ejecutor: Ejecutor): Promise<Factura | null> {
  return consultarUno<Factura>(`SELECT ${COLUMNAS} ${DESDE} WHERE f.id = $1`, [id], ejecutor);
}

/** Las de una empresa con saldo, para su estado de cuenta. */
export async function deEmpresa(empresaId: number, ejecutor: Ejecutor): Promise<Factura[]> {
  return consultar<Factura>(
    `SELECT ${COLUMNAS} ${DESDE} WHERE f.empresa_id = $1 ORDER BY f.fecha_emision DESC, f.id DESC LIMIT 200`,
    [empresaId],
    ejecutor,
  );
}

/** La factura vigente de una proforma, si tiene. */
export async function deProforma(proformaId: number, ejecutor: Ejecutor): Promise<Factura | null> {
  return consultarUno<Factura>(
    `SELECT ${COLUMNAS} ${DESDE} WHERE f.proforma_id = $1 ORDER BY f.id DESC LIMIT 1`,
    [proformaId],
    ejecutor,
  );
}

export async function renglones(id: number, ejecutor: Ejecutor): Promise<RenglonFactura[]> {
  return consultar<RenglonFactura>(
    `SELECT orden,
            descripcion,
            cantidad::text        AS cantidad,
            precio_unitario::text AS "precioUnitario",
            exento,
            subtotal::text        AS subtotal
     FROM finanzas.factura_items WHERE factura_id = $1 ORDER BY orden`,
    [id],
    ejecutor,
  );
}

/** Emite la factura de una proforma. Devuelve su id. */
export async function emitir(proformaId: number, ejecutor: Ejecutor): Promise<number> {
  const fila = await consultarUno<{ id: number }>(
    "SELECT finanzas.emitir_factura($1) AS id",
    [proformaId],
    ejecutor,
  );
  if (!fila) throw new Error("No se pudo emitir la factura");
  return fila.id;
}

export async function anular(id: number, motivo: string, ejecutor: Ejecutor): Promise<void> {
  await ejecutar("SELECT finanzas.anular_factura($1, $2)", [id, motivo], ejecutor);
}

/** La primera vez que se imprime queda anotada; reimprimir no la cambia. */
export async function marcarImpresa(id: number, usuarioId: number, ejecutor: Ejecutor): Promise<boolean> {
  const filas = await ejecutar(
    `UPDATE finanzas.facturas SET impresa_por = $2, impresa_en = now()
     WHERE id = $1 AND estado = 'emitida' AND impresa_en IS NULL`,
    [id, usuarioId],
    ejecutor,
  );
  return filas === 1;
}

/**
 * La cobranza: lo que debe cada empresa, por antiguedad desde el
 * vencimiento. «Por vencer» es lo que aun no vence.
 */
export async function cobranza(ejecutor: Ejecutor): Promise<CobranzaEmpresa[]> {
  return consultar<CobranzaEmpresa>(
    `WITH abiertas AS (
       SELECT f.empresa_id, c.saldo, c.retencion_abierta,
              finanzas.hoy() - f.vence_el AS dias
       FROM finanzas.facturas f
       JOIN finanzas.v_estado_cobro_factura c ON c.factura_id = f.id
       WHERE f.estado = 'emitida' AND (c.saldo > 0 OR c.retencion_abierta)
     )
     SELECT a.empresa_id                                                  AS "empresaId",
            e.nombre                                                      AS "empresaNombre",
            count(*)::int                                                 AS facturas,
            coalesce(sum(a.saldo) FILTER (WHERE a.dias <= 0), 0)::text            AS "porVencer",
            coalesce(sum(a.saldo) FILTER (WHERE a.dias BETWEEN 1 AND 30), 0)::text  AS "dias0a30",
            coalesce(sum(a.saldo) FILTER (WHERE a.dias BETWEEN 31 AND 60), 0)::text AS "dias31a60",
            coalesce(sum(a.saldo) FILTER (WHERE a.dias BETWEEN 61 AND 90), 0)::text AS "dias61a90",
            coalesce(sum(a.saldo) FILTER (WHERE a.dias > 90), 0)::text             AS "mas90",
            coalesce(sum(a.saldo), 0)::text                                         AS total,
            count(*) FILTER (WHERE a.retencion_abierta)::int                        AS "retencionesAbiertas"
     FROM abiertas a JOIN empresas e ON e.id = a.empresa_id
     GROUP BY a.empresa_id, e.nombre
     ORDER BY sum(a.saldo) DESC, e.nombre`,
    [],
    ejecutor,
  );
}
