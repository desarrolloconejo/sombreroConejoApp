import {
  consultar,
  consultarUno,
  ejecutar,
  escaparLike,
  identificadorSeguro,
  type Ejecutor,
} from "@/lib/db";
import type { FiltrosProformas, Pagina, Proforma, ProyectoDeProforma } from "@/types";

/**
 * Consultas sobre finanzas.proformas.
 *
 * Las ve y las escribe el operador; el cliente con permiso de finanzas lee
 * las de su empresa que ya no son borrador. Lo decide la base.
 *
 * Una proforma nace de un presupuesto aprobado o de una recurrente a la que
 * le toca (`finanzas.proforma_desde`), con sus renglones copiados. Sus
 * proyectos se cambian con `finanzas.ligar_proyectos`.
 */

const COLUMNAS = `
  f.id,
  f.numero,
  f.empresa_id                                   AS "empresaId",
  e.nombre                                       AS "empresaNombre",
  f.presupuesto_id                               AS "presupuestoId",
  p.numero                                       AS "presupuestoNumero",
  f.origen_id                                    AS "origenId",
  o.numero                                       AS "origenNumero",
  f.titulo,
  f.estado,
  f.recurrente,
  f.proxima_emision::text                        AS "proximaEmision",
  f.notas,
  f.base_imponible::text                         AS "baseImponible",
  f.monto_exento::text                           AS "montoExento",
  f.iva_pct::text                                AS "ivaPct",
  f.iva_monto::text                              AS "ivaMonto",
  f.total::text                                  AS total,
  c.nombre || ' ' || c.apellido                  AS "creadoPorNombre",
  f.creado_en                                    AS "creadoEn",
  f.emitida_en                                   AS "emitidaEn",
  f.anulada_en                                   AS "anuladaEn",
  f.motivo_anulacion                             AS "motivoAnulacion"
`;

const DESDE = `
  FROM finanzas.proformas f
  JOIN empresas e ON e.id = f.empresa_id
  JOIN usuarios c ON c.id = f.creado_por
  LEFT JOIN finanzas.presupuestos p ON p.id = f.presupuesto_id
  LEFT JOIN finanzas.proformas o ON o.id = f.origen_id
`;

const COLUMNAS_ORDEN = {
  numero: "f.numero",
  creadoEn: "f.creado_en",
  total: "f.total",
} as const;

/** El listado, paginado y con filtros. */
export async function listar(filtros: FiltrosProformas, ejecutor: Ejecutor): Promise<Pagina<Proforma>> {
  const pagina = Math.max(1, Math.trunc(filtros.pagina ?? 1));
  const porPagina = Math.min(100, Math.max(1, Math.trunc(filtros.porPagina ?? 20)));

  const condiciones: string[] = [];
  const valores: unknown[] = [];

  if (filtros.busqueda?.trim()) {
    valores.push(`%${escaparLike(filtros.busqueda.trim())}%`);
    const marcador = `$${valores.length}`;
    condiciones.push(
      `(f.titulo ILIKE ${marcador} ESCAPE '\\' OR e.nombre ILIKE ${marcador} ESCAPE '\\'
        OR f.numero::text = ltrim(regexp_replace(${marcador}, '[^0-9]', '', 'g'), '0'))`,
    );
  }

  if (filtros.estado?.length) {
    valores.push(filtros.estado);
    condiciones.push(`f.estado = ANY($${valores.length})`);
  }

  if (filtros.empresaId?.length) {
    valores.push(filtros.empresaId);
    condiciones.push(`f.empresa_id = ANY($${valores.length})`);
  }

  if (filtros.soloRecurrentes) {
    condiciones.push("f.recurrente");
  }

  const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  const claveOrden = identificadorSeguro(
    filtros.orden ?? "numero",
    Object.keys(COLUMNAS_ORDEN) as (keyof typeof COLUMNAS_ORDEN)[],
  );
  const direccion = identificadorSeguro(filtros.direccion ?? "desc", ["asc", "desc"]);

  const totales = await consultarUno<{ total: string }>(
    `SELECT count(*)::text AS total
     FROM finanzas.proformas f
     JOIN empresas e ON e.id = f.empresa_id
     ${donde}`,
    valores,
    ejecutor,
  );

  const total = Number(totales?.total ?? 0);

  valores.push(porPagina, (pagina - 1) * porPagina);

  const filas = await consultar<Proforma>(
    `SELECT ${COLUMNAS} ${DESDE}
     ${donde}
     ORDER BY ${COLUMNAS_ORDEN[claveOrden]} ${direccion.toUpperCase()}, f.id DESC
     LIMIT $${valores.length - 1} OFFSET $${valores.length}`,
    valores,
    ejecutor,
  );

  return {
    filas,
    total,
    pagina,
    porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
  };
}

/** Una proforma, o null si no existe para quien pregunta. */
export async function buscarPorId(id: number, ejecutor: Ejecutor): Promise<Proforma | null> {
  return consultarUno<Proforma>(`SELECT ${COLUMNAS} ${DESDE} WHERE f.id = $1`, [id], ejecutor);
}

/** Las emitidas de la empresa de quien pregunta: lo que ve el cliente. */
export async function emitidas(ejecutor: Ejecutor, limite = 30): Promise<Proforma[]> {
  return consultar<Proforma>(
    `SELECT ${COLUMNAS} ${DESDE}
     WHERE f.estado IN ('emitida', 'facturada')
     ORDER BY f.emitida_en DESC, f.id DESC
     LIMIT $1`,
    [limite],
    ejecutor,
  );
}

/**
 * Las recurrentes a las que ya les toca la siguiente: emitidas, con la fecha
 * de la proxima ya llegada. Es la portada del operador: nada se emite solo.
 */
export async function recurrentesPendientes(ejecutor: Ejecutor): Promise<Proforma[]> {
  return consultar<Proforma>(
    `SELECT ${COLUMNAS} ${DESDE}
     WHERE f.recurrente AND f.estado IN ('emitida', 'facturada')
       AND f.proxima_emision <= finanzas.hoy()
     ORDER BY f.proxima_emision, f.id`,
    [],
    ejecutor,
  );
}

/** Los proyectos ligados a una proforma. */
export async function proyectosDe(id: number, ejecutor: Ejecutor): Promise<ProyectoDeProforma[]> {
  return consultar<ProyectoDeProforma>(
    `SELECT pr.id, pr.nombre, pr.estado
     FROM finanzas.proforma_proyectos pp
     JOIN portal.proyectos pr ON pr.id = pp.proyecto_id
     WHERE pp.proforma_id = $1
     ORDER BY lower(pr.nombre)`,
    [id],
    ejecutor,
  );
}

/** Los proyectos de una empresa que se le pueden ligar: no cancelados. */
export async function proyectosLigables(
  empresaId: number,
  ejecutor: Ejecutor,
): Promise<ProyectoDeProforma[]> {
  return consultar<ProyectoDeProforma>(
    `SELECT id, nombre, estado FROM portal.proyectos
     WHERE empresa_id = $1 AND estado <> 'cancelado'
     ORDER BY lower(nombre)`,
    [empresaId],
    ejecutor,
  );
}

/** Crea la proforma de un presupuesto aprobado, o la siguiente de una recurrente. */
export async function desde(
  tipo: "presupuesto" | "recurrente",
  origenId: number,
  ejecutor: Ejecutor,
): Promise<number> {
  const fila = await consultarUno<{ id: number }>(
    "SELECT finanzas.proforma_desde($1, $2) AS id",
    [tipo, origenId],
    ejecutor,
  );

  if (!fila) throw new Error("No se pudo crear la proforma");
  return fila.id;
}

/** Cambia los datos de un borrador. Devuelve si lo encontro en borrador. */
export async function editar(
  id: number,
  datos: { titulo: string; notas: string | null },
  ejecutor: Ejecutor,
): Promise<boolean> {
  const filas = await ejecutar(
    "UPDATE finanzas.proformas SET titulo = $2, notas = $3 WHERE id = $1 AND estado = 'borrador'",
    [id, datos.titulo, datos.notas],
    ejecutor,
  );

  return filas === 1;
}

/** Sustituye los proyectos de un borrador. */
export async function ligarProyectos(id: number, proyectos: number[], ejecutor: Ejecutor): Promise<void> {
  await ejecutar("SELECT finanzas.ligar_proyectos($1, $2::int[])", [id, proyectos], ejecutor);
}

/**
 * Marca o desmarca la recurrencia. Se puede en cualquier estado salvo
 * anulada: decidir que el contrato sigue no cambia ningun importe.
 */
export async function cambiarRecurrencia(
  id: number,
  recurrente: boolean,
  proximaEmision: string | null,
  ejecutor: Ejecutor,
): Promise<boolean> {
  const filas = await ejecutar(
    `UPDATE finanzas.proformas SET recurrente = $2, proxima_emision = $3
     WHERE id = $1 AND estado <> 'anulada'`,
    [id, recurrente, recurrente ? proximaEmision : null],
    ejecutor,
  );

  return filas === 1;
}

/** La emite. Solo un borrador con renglones. */
export async function emitir(id: number, usuarioId: number, ejecutor: Ejecutor): Promise<boolean> {
  const filas = await ejecutar(
    `UPDATE finanzas.proformas f
     SET estado = 'emitida', emitida_por = $2, emitida_en = now()
     WHERE f.id = $1 AND f.estado = 'borrador'
       AND EXISTS (SELECT 1 FROM finanzas.documento_items i WHERE i.proforma_id = f.id)`,
    [id, usuarioId],
    ejecutor,
  );

  return filas === 1;
}

/** La anula con motivo. Un borrador o una emitida; una facturada, no. */
export async function anular(
  id: number,
  motivo: string,
  usuarioId: number,
  ejecutor: Ejecutor,
): Promise<boolean> {
  const filas = await ejecutar(
    `UPDATE finanzas.proformas
     SET estado = 'anulada', anulada_por = $2, anulada_en = now(),
         motivo_anulacion = $3, recurrente = FALSE, proxima_emision = NULL
     WHERE id = $1 AND estado IN ('borrador', 'emitida')`,
    [id, usuarioId, motivo],
    ejecutor,
  );

  return filas === 1;
}

/** Las emitidas sin factura vigente: lo que queda por facturar. */
export async function porFacturar(ejecutor: Ejecutor, limite = 50): Promise<Proforma[]> {
  return consultar<Proforma>(
    `SELECT ${COLUMNAS} ${DESDE}
     WHERE f.estado = 'emitida'
     ORDER BY f.emitida_en, f.id
     LIMIT $1`,
    [limite],
    ejecutor,
  );
}
