import {
  consultar,
  consultarUno,
  ejecutar,
  escaparLike,
  identificadorSeguro,
  type Ejecutor,
} from "@/lib/db";
import type {
  DatosNuevoPresupuesto,
  FiltrosPresupuestos,
  Pagina,
  Presupuesto,
} from "@/types";

/**
 * Consultas sobre finanzas.presupuestos.
 *
 * El ejecutor es obligatorio y sale de `conSesion`: el operador los ve todos;
 * el cliente con permiso de finanzas, los de su empresa que ya no son
 * borrador. Lo decide la base.
 *
 * Los importes no se escriben aqui: los calcula `finanzas.guardar_renglones`
 * al guardar los renglones (src/models/renglones.ts).
 */

const COLUMNAS = `
  p.id,
  p.numero,
  p.empresa_id                                   AS "empresaId",
  e.nombre                                       AS "empresaNombre",
  p.proyecto_id                                  AS "proyectoId",
  pr.nombre                                      AS "proyectoNombre",
  p.titulo,
  p.estado,
  (p.estado = 'enviado' AND p.valido_hasta < finanzas.hoy()) AS vencido,
  p.valido_hasta::text                           AS "validoHasta",
  p.notas,
  p.base_imponible::text                         AS "baseImponible",
  p.monto_exento::text                           AS "montoExento",
  p.iva_pct::text                                AS "ivaPct",
  p.iva_monto::text                              AS "ivaMonto",
  p.total::text                                  AS total,
  c.nombre || ' ' || c.apellido                  AS "creadoPorNombre",
  p.creado_en                                    AS "creadoEn",
  p.enviado_en                                   AS "enviadoEn",
  p.resuelto_en                                  AS "resueltoEn",
  r.nombre || ' ' || r.apellido                  AS "resueltoPorNombre",
  p.a_nombre_del_cliente                         AS "aNombreDelCliente",
  p.motivo_rechazo                               AS "motivoRechazo",
  pf.id                                          AS "proformaId",
  pf.numero                                      AS "proformaNumero"
`;

const DESDE = `
  FROM finanzas.presupuestos p
  JOIN empresas e ON e.id = p.empresa_id
  JOIN usuarios c ON c.id = p.creado_por
  LEFT JOIN usuarios r ON r.id = p.resuelto_por
  LEFT JOIN portal.proyectos pr ON pr.id = p.proyecto_id
  LEFT JOIN LATERAL (
    SELECT f.id, f.numero FROM finanzas.proformas f
    WHERE f.presupuesto_id = p.id AND f.origen_id IS NULL AND f.estado <> 'anulada'
    ORDER BY f.id LIMIT 1
  ) pf ON true
`;

const COLUMNAS_ORDEN = {
  numero: "p.numero",
  creadoEn: "p.creado_en",
  total: "p.total",
} as const;

/** El listado, paginado y con filtros. */
export async function listar(
  filtros: FiltrosPresupuestos,
  ejecutor: Ejecutor,
): Promise<Pagina<Presupuesto>> {
  const pagina = Math.max(1, Math.trunc(filtros.pagina ?? 1));
  const porPagina = Math.min(100, Math.max(1, Math.trunc(filtros.porPagina ?? 20)));

  const condiciones: string[] = [];
  const valores: unknown[] = [];

  if (filtros.busqueda?.trim()) {
    valores.push(`%${escaparLike(filtros.busqueda.trim())}%`);
    const marcador = `$${valores.length}`;
    condiciones.push(
      `(p.titulo ILIKE ${marcador} ESCAPE '\\' OR e.nombre ILIKE ${marcador} ESCAPE '\\'
        OR p.numero::text = ltrim(regexp_replace(${marcador}, '[^0-9]', '', 'g'), '0'))`,
    );
  }

  if (filtros.situacion?.length) {
    // «Vencido» es un enviado con la validez pasada; «enviado», uno vigente.
    const partes: string[] = [];
    const guardados = filtros.situacion.filter((s) => s !== "vencido" && s !== "enviado");

    if (guardados.length > 0) {
      valores.push(guardados);
      partes.push(`p.estado = ANY($${valores.length})`);
    }
    if (filtros.situacion.includes("enviado")) {
      partes.push(`(p.estado = 'enviado' AND p.valido_hasta >= finanzas.hoy())`);
    }
    if (filtros.situacion.includes("vencido")) {
      partes.push(`(p.estado = 'enviado' AND p.valido_hasta < finanzas.hoy())`);
    }

    condiciones.push(`(${partes.join(" OR ")})`);
  }

  if (filtros.empresaId?.length) {
    valores.push(filtros.empresaId);
    condiciones.push(`p.empresa_id = ANY($${valores.length})`);
  }

  const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  const claveOrden = identificadorSeguro(
    filtros.orden ?? "numero",
    Object.keys(COLUMNAS_ORDEN) as (keyof typeof COLUMNAS_ORDEN)[],
  );
  const direccion = identificadorSeguro(filtros.direccion ?? "desc", ["asc", "desc"]);

  const totales = await consultarUno<{ total: string }>(
    `SELECT count(*)::text AS total
     FROM finanzas.presupuestos p
     JOIN empresas e ON e.id = p.empresa_id
     ${donde}`,
    valores,
    ejecutor,
  );

  const total = Number(totales?.total ?? 0);

  valores.push(porPagina, (pagina - 1) * porPagina);

  const filas = await consultar<Presupuesto>(
    `SELECT ${COLUMNAS} ${DESDE}
     ${donde}
     ORDER BY ${COLUMNAS_ORDEN[claveOrden]} ${direccion.toUpperCase()}, p.id DESC
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

/** Un presupuesto, o null si no existe para quien pregunta. */
export async function buscarPorId(id: number, ejecutor: Ejecutor): Promise<Presupuesto | null> {
  return consultarUno<Presupuesto>(
    `SELECT ${COLUMNAS} ${DESDE} WHERE p.id = $1`,
    [id],
    ejecutor,
  );
}

/** Los que esperan la decision del cliente: enviados y vigentes. */
export async function porAprobar(ejecutor: Ejecutor): Promise<Presupuesto[]> {
  return consultar<Presupuesto>(
    `SELECT ${COLUMNAS} ${DESDE}
     WHERE p.estado = 'enviado' AND p.valido_hasta >= finanzas.hoy()
     ORDER BY p.valido_hasta, p.id`,
    [],
    ejecutor,
  );
}

/** Los ya resueltos o vencidos, los mas recientes primero. Para el cliente. */
export async function historial(ejecutor: Ejecutor, limite = 30): Promise<Presupuesto[]> {
  return consultar<Presupuesto>(
    `SELECT ${COLUMNAS} ${DESDE}
     WHERE p.estado IN ('aprobado', 'rechazado')
        OR (p.estado = 'enviado' AND p.valido_hasta < finanzas.hoy())
     ORDER BY coalesce(p.resuelto_en, p.enviado_en) DESC, p.id DESC
     LIMIT $1`,
    [limite],
    ejecutor,
  );
}

/** Crea un borrador vacio y devuelve su id. El numero lo da la base. */
export async function crear(
  datos: DatosNuevoPresupuesto,
  creadoPor: number,
  ejecutor: Ejecutor,
): Promise<number> {
  const fila = await consultarUno<{ id: number }>(
    `INSERT INTO finanzas.presupuestos
       (numero, empresa_id, proyecto_id, titulo, valido_hasta, notas, creado_por)
     VALUES (finanzas.siguiente_numero('PRESUPUESTO'), $1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [datos.empresaId, datos.proyectoId, datos.titulo, datos.validoHasta, datos.notas, creadoPor],
    ejecutor,
  );

  if (!fila) throw new Error("No se pudo crear el presupuesto");
  return fila.id;
}

/** Cambia la cabecera de un borrador. Devuelve si lo encontro en borrador. */
export async function editar(
  id: number,
  datos: Omit<DatosNuevoPresupuesto, "empresaId">,
  ejecutor: Ejecutor,
): Promise<boolean> {
  const filas = await ejecutar(
    `UPDATE finanzas.presupuestos
     SET proyecto_id = $2, titulo = $3, valido_hasta = $4, notas = $5
     WHERE id = $1 AND estado = 'borrador'`,
    [id, datos.proyectoId, datos.titulo, datos.validoHasta, datos.notas],
    ejecutor,
  );

  return filas === 1;
}

/** Lo envia al cliente. Solo un borrador con renglones y validez futura. */
export async function enviar(id: number, usuarioId: number, ejecutor: Ejecutor): Promise<boolean> {
  const filas = await ejecutar(
    `UPDATE finanzas.presupuestos p
     SET estado = 'enviado', enviado_por = $2, enviado_en = now()
     WHERE p.id = $1 AND p.estado = 'borrador'
       AND p.valido_hasta >= finanzas.hoy()
       AND EXISTS (SELECT 1 FROM finanzas.documento_items i WHERE i.presupuesto_id = p.id)`,
    [id, usuarioId],
    ejecutor,
  );

  return filas === 1;
}

/**
 * Lo resuelve un operador a nombre del cliente (F14): para la empresa que no
 * tiene a nadie con cuenta. Queda dicho que no fue el cliente.
 */
export async function resolverANombre(
  id: number,
  aprobar: boolean,
  motivo: string | null,
  usuarioId: number,
  ejecutor: Ejecutor,
): Promise<boolean> {
  const filas = await ejecutar(
    `UPDATE finanzas.presupuestos
     SET estado = CASE WHEN $2 THEN 'aprobado' ELSE 'rechazado' END,
         resuelto_por = $3, resuelto_en = now(), a_nombre_del_cliente = TRUE,
         motivo_rechazo = CASE WHEN $2 THEN NULL ELSE $4 END
     WHERE id = $1 AND estado = 'enviado' AND valido_hasta >= finanzas.hoy()`,
    [id, aprobar, usuarioId, motivo],
    ejecutor,
  );

  return filas === 1;
}

/** El cliente aprueba o rechaza. Solo por la funcion de la base. */
export async function resolverComoCliente(
  id: number,
  aprobar: boolean,
  motivo: string | null,
  ejecutor: Ejecutor,
): Promise<void> {
  await ejecutar(
    "SELECT finanzas.cliente_resuelve_presupuesto($1, $2, $3)",
    [id, aprobar, motivo],
    ejecutor,
  );
}
