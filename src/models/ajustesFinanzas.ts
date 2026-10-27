import { consultar, consultarUno, ejecutar, type Ejecutor } from "@/lib/db";
import type {
  AjustesFinanzas,
  DatosFormatoImpresion,
  DatosMedioPago,
  FormatoImpresion,
  MedioPago,
  Numeracion,
} from "@/types";

/**
 * Lo que se configura de finanzas: emisor, impuestos, numeracion, formatos de
 * impresion y medios de pago. Solo lo ve y lo cambia quien opera finanzas;
 * el cliente lee los medios de pago activos. Lo decide la base.
 *
 * Muchos de estos valores nacen de ejemplo y se sustituyen al final
 * (docs/pendientes.md).
 */

// ---------------------------------------------------------------------------
// Ajustes generales.
// ---------------------------------------------------------------------------

export async function leer(ejecutor: Ejecutor): Promise<AjustesFinanzas | null> {
  return consultarUno<AjustesFinanzas>(
    `SELECT emisor_razon_social AS "emisorRazonSocial",
            emisor_rif          AS "emisorRif",
            emisor_domicilio    AS "emisorDomicilio",
            iva_pct::text       AS "ivaPct",
            islr_activo         AS "islrActivo",
            islr_pct::text      AS "islrPct",
            igtf_activo         AS "igtfActivo",
            igtf_pct::text      AS "igtfPct",
            dias_credito        AS "diasCredito"
     FROM finanzas.ajustes WHERE id = 1`,
    [],
    ejecutor,
  );
}

export async function guardar(datos: AjustesFinanzas, usuarioId: number, ejecutor: Ejecutor): Promise<boolean> {
  const filas = await ejecutar(
    `UPDATE finanzas.ajustes SET
       emisor_razon_social = $1, emisor_rif = $2, emisor_domicilio = $3,
       iva_pct = $4::numeric, islr_activo = $5, islr_pct = $6::numeric,
       igtf_activo = $7, igtf_pct = $8::numeric, dias_credito = $9,
       actualizado_por = $10, actualizado_en = now()
     WHERE id = 1`,
    [
      datos.emisorRazonSocial,
      datos.emisorRif,
      datos.emisorDomicilio,
      datos.ivaPct,
      datos.islrActivo,
      datos.islrPct,
      datos.igtfActivo,
      datos.igtfPct,
      datos.diasCredito,
      usuarioId,
    ],
    ejecutor,
  );
  return filas === 1;
}

// ---------------------------------------------------------------------------
// Numeracion. Solo sube: lo impone finanzas.fijar_numeracion.
// ---------------------------------------------------------------------------

export async function numeracion(ejecutor: Ejecutor): Promise<Numeracion | null> {
  return consultarUno<Numeracion>(
    `SELECT serie,
            proxima_factura AS "proximaFactura",
            proximo_control AS "proximoControl",
            control_prefijo AS "controlPrefijo",
            control_hasta   AS "controlHasta"
     FROM finanzas.numeracion()`,
    [],
    ejecutor,
  );
}

export async function fijarNumeracion(datos: Numeracion, ejecutor: Ejecutor): Promise<void> {
  await ejecutar(
    "SELECT finanzas.fijar_numeracion($1, $2, $3, $4, $5)",
    [datos.serie, datos.proximaFactura, datos.proximoControl, datos.controlPrefijo, datos.controlHasta],
    ejecutor,
  );
}

// ---------------------------------------------------------------------------
// Formatos de impresion.
// ---------------------------------------------------------------------------

const COLUMNAS_FORMATO = `
  id, nombre,
  ancho_mm::text  AS "anchoMm",
  alto_mm::text   AS "altoMm",
  fuente_pt::text AS "fuentePt",
  campos, renglones, habitual, activo
`;

export async function formatos(ejecutor: Ejecutor): Promise<FormatoImpresion[]> {
  return consultar<FormatoImpresion>(
    `SELECT ${COLUMNAS_FORMATO} FROM finanzas.formatos_impresion
     ORDER BY habitual DESC, activo DESC, nombre`,
    [],
    ejecutor,
  );
}

export async function formato(id: number, ejecutor: Ejecutor): Promise<FormatoImpresion | null> {
  return consultarUno<FormatoImpresion>(
    `SELECT ${COLUMNAS_FORMATO} FROM finanzas.formatos_impresion WHERE id = $1`,
    [id],
    ejecutor,
  );
}

export async function formatoHabitual(ejecutor: Ejecutor): Promise<FormatoImpresion | null> {
  return consultarUno<FormatoImpresion>(
    `SELECT ${COLUMNAS_FORMATO} FROM finanzas.formatos_impresion WHERE habitual`,
    [],
    ejecutor,
  );
}

export async function crearFormato(
  datos: DatosFormatoImpresion,
  usuarioId: number,
  ejecutor: Ejecutor,
): Promise<number> {
  const fila = await consultarUno<{ id: number }>(
    `INSERT INTO finanzas.formatos_impresion
       (nombre, ancho_mm, alto_mm, fuente_pt, campos, renglones, activo, creado_por)
     VALUES ($1, $2::numeric, $3::numeric, $4::numeric, $5::jsonb, $6::jsonb, $7, $8)
     RETURNING id`,
    [
      datos.nombre,
      datos.anchoMm,
      datos.altoMm,
      datos.fuentePt,
      JSON.stringify(datos.campos),
      JSON.stringify(datos.renglones),
      datos.activo,
      usuarioId,
    ],
    ejecutor,
  );
  if (!fila) throw new Error("No se pudo crear el formato");
  return fila.id;
}

export async function editarFormato(id: number, datos: DatosFormatoImpresion, ejecutor: Ejecutor): Promise<boolean> {
  const filas = await ejecutar(
    `UPDATE finanzas.formatos_impresion SET
       nombre = $2, ancho_mm = $3::numeric, alto_mm = $4::numeric, fuente_pt = $5::numeric,
       campos = $6::jsonb, renglones = $7::jsonb, activo = $8, actualizado_en = now()
     WHERE id = $1`,
    [
      id,
      datos.nombre,
      datos.anchoMm,
      datos.altoMm,
      datos.fuentePt,
      JSON.stringify(datos.campos),
      JSON.stringify(datos.renglones),
      datos.activo,
    ],
    ejecutor,
  );
  return filas === 1;
}

/** Lo deja como el habitual. Tiene que estar activo. */
export async function marcarHabitual(id: number, ejecutor: Ejecutor): Promise<boolean> {
  const activo = await consultarUno<{ id: number }>(
    "SELECT id FROM finanzas.formatos_impresion WHERE id = $1 AND activo FOR UPDATE",
    [id],
    ejecutor,
  );
  if (!activo) return false;

  // Primero se quita el anterior: el indice no admite dos habituales.
  await ejecutar("UPDATE finanzas.formatos_impresion SET habitual = FALSE WHERE habitual AND id <> $1", [id], ejecutor);
  const filas = await ejecutar(
    "UPDATE finanzas.formatos_impresion SET habitual = TRUE, actualizado_en = now() WHERE id = $1 AND activo",
    [id],
    ejecutor,
  );
  return filas === 1;
}

// ---------------------------------------------------------------------------
// Medios de pago.
// ---------------------------------------------------------------------------

const COLUMNAS_MEDIO = `
  id, nombre, monedas,
  pide_referencia  AS "pideReferencia",
  datos_para_pagar AS "datosParaPagar",
  orden, activo
`;

/** Todos para el operador; los activos para el cliente. Lo decide la base. */
export async function medios(ejecutor: Ejecutor): Promise<MedioPago[]> {
  return consultar<MedioPago>(
    `SELECT ${COLUMNAS_MEDIO} FROM finanzas.medios_pago ORDER BY activo DESC, orden, nombre`,
    [],
    ejecutor,
  );
}

export async function medio(id: number, ejecutor: Ejecutor): Promise<MedioPago | null> {
  return consultarUno<MedioPago>(`SELECT ${COLUMNAS_MEDIO} FROM finanzas.medios_pago WHERE id = $1`, [id], ejecutor);
}

export async function crearMedio(datos: DatosMedioPago, ejecutor: Ejecutor): Promise<number> {
  const fila = await consultarUno<{ id: number }>(
    `INSERT INTO finanzas.medios_pago (nombre, monedas, pide_referencia, datos_para_pagar, orden, activo)
     VALUES ($1, $2::text[], $3, $4, $5, $6)
     RETURNING id`,
    [datos.nombre, datos.monedas, datos.pideReferencia, datos.datosParaPagar, datos.orden, datos.activo],
    ejecutor,
  );
  if (!fila) throw new Error("No se pudo crear el medio de pago");
  return fila.id;
}

export async function editarMedio(id: number, datos: DatosMedioPago, ejecutor: Ejecutor): Promise<boolean> {
  const filas = await ejecutar(
    `UPDATE finanzas.medios_pago SET
       nombre = $2, monedas = $3::text[], pide_referencia = $4, datos_para_pagar = $5,
       orden = $6, activo = $7, actualizado_en = now()
     WHERE id = $1`,
    [id, datos.nombre, datos.monedas, datos.pideReferencia, datos.datosParaPagar, datos.orden, datos.activo],
    ejecutor,
  );
  return filas === 1;
}

/** Los nombres de formato que ya existen y empiezan igual, para no repetir uno. */
export async function nombresDeFormato(ejecutor: Ejecutor): Promise<string[]> {
  const filas = await consultar<{ nombre: string }>("SELECT nombre FROM finanzas.formatos_impresion", [], ejecutor);
  return filas.map((fila) => fila.nombre);
}
