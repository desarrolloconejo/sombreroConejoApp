import {
  consultar,
  consultarUno,
  ejecutar,
  escaparLike,
  identificadorSeguro,
  type Ejecutor,
} from "@/lib/db";
import type {
  FiltrosAuditoria,
  LineaAuditoria,
  NuevaLineaAuditoria,
  Pagina,
  PeriodoAuditoria,
} from "@/types";

/**
 * Consultas sobre la tabla auditoria.
 *
 * Solo hay una escritura, y es un INSERT: la tabla no admite otra cosa.
 */

const COLUMNAS = `
  a.id,
  a.accion,
  a.creado_en   AS "creadoEn",
  a.actor_id    AS "actorId",
  CASE WHEN u.id IS NULL THEN NULL ELSE u.nombre || ' ' || u.apellido END
                AS "actorNombre",
  u.email       AS "actorEmail",
  a.actor_rol   AS "actorRol",
  a.actor_cargo AS "actorCargo",
  a.entidad,
  a.entidad_id  AS "entidadId",
  a.empresa_id  AS "empresaId",
  e.nombre      AS "empresaNombre",
  a.antes,
  a.despues,
  a.ip
`;

const DESDE = `
  FROM auditoria a
  LEFT JOIN usuarios u ON u.id = a.actor_id
  LEFT JOIN empresas e ON e.id = a.empresa_id
`;

/** El intervalo de cada periodo. Constantes del modulo, no entrada de nadie. */
const INTERVALOS: Record<PeriodoAuditoria, string> = {
  hoy: "1 day",
  semana: "7 days",
  mes: "30 days",
};

/** BIGSERIAL llega como texto; aqui se maneja como numero. */
function comoLinea(
  fila: Omit<LineaAuditoria, "id" | "entidadId"> & {
    id: string;
    entidadId: string | null;
  },
): LineaAuditoria {
  return {
    ...fila,
    id: Number(fila.id),
    entidadId: fila.entidadId === null ? null : Number(fila.entidadId),
  };
}

/**
 * Anade una linea.
 *
 * El ejecutor es OBLIGATORIO, al reves que en el resto de modelos: la linea
 * tiene que ir en la misma transaccion que el cambio que cuenta. Con un
 * ejecutor por defecto bastaria un olvido para que se escribiera aparte, y
 * entonces un cambio deshecho dejaria una linea que dice que ocurrio.
 */
export async function registrar(
  linea: NuevaLineaAuditoria,
  ejecutor: Ejecutor,
): Promise<void> {
  await ejecutar(
    `INSERT INTO auditoria (
       actor_id, actor_rol, actor_cargo, accion,
       entidad, entidad_id, empresa_id, antes, despues, ip
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      linea.actorId,
      linea.actorRol,
      linea.actorCargo,
      linea.accion,
      linea.entidad ?? null,
      linea.entidadId ?? null,
      linea.empresaId ?? null,
      linea.antes ? JSON.stringify(linea.antes) : null,
      linea.despues ? JSON.stringify(linea.despues) : null,
      linea.ip,
    ],
    ejecutor,
  );
}

/** Una linea concreta, para el panel de detalle. */
export async function buscarPorId(id: number): Promise<LineaAuditoria | null> {
  const fila = await consultarUno<Parameters<typeof comoLinea>[0]>(
    `SELECT ${COLUMNAS} ${DESDE} WHERE a.id = $1`,
    [id],
  );

  return fila ? comoLinea(fila) : null;
}

/** Listado paginado, lo mas reciente primero salvo que se pida al reves. */
export async function listar(
  filtros: FiltrosAuditoria = {},
): Promise<Pagina<LineaAuditoria>> {
  const pagina = Math.max(1, Math.trunc(filtros.pagina ?? 1));
  const porPagina = Math.min(100, Math.max(1, Math.trunc(filtros.porPagina ?? 20)));

  const condiciones: string[] = [];
  const valores: unknown[] = [];

  if (filtros.busqueda?.trim()) {
    valores.push(`%${escaparLike(filtros.busqueda.trim())}%`);
    const marcador = `$${valores.length}`;
    condiciones.push(
      `(u.nombre ILIKE ${marcador} ESCAPE '\\'
        OR u.apellido ILIKE ${marcador} ESCAPE '\\'
        OR u.email ILIKE ${marcador} ESCAPE '\\'
        OR e.nombre ILIKE ${marcador} ESCAPE '\\'
        OR a.accion ILIKE ${marcador} ESCAPE '\\')`,
    );
  }

  // El modulo es lo que va antes del punto de la accion.
  if (filtros.modulo?.length) {
    valores.push(filtros.modulo);
    condiciones.push(`split_part(a.accion, '.', 1) = ANY($${valores.length})`);
  }

  if (filtros.periodo) {
    valores.push(INTERVALOS[filtros.periodo]);
    condiciones.push(`a.creado_en > now() - $${valores.length}::interval`);
  }

  const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";
  const direccion = identificadorSeguro(filtros.direccion ?? "desc", ["asc", "desc"]);

  const totales = await consultarUno<{ total: string }>(
    `SELECT count(*)::text AS total ${DESDE} ${donde}`,
    valores,
  );
  const total = Number(totales?.total ?? 0);

  valores.push(porPagina, (pagina - 1) * porPagina);

  const filas = await consultar<Parameters<typeof comoLinea>[0]>(
    `SELECT ${COLUMNAS}
     ${DESDE}
     ${donde}
     ORDER BY a.creado_en ${direccion.toUpperCase()}, a.id ${direccion.toUpperCase()}
     LIMIT $${valores.length - 1} OFFSET $${valores.length}`,
    valores,
  );

  return {
    filas: filas.map(comoLinea),
    total,
    pagina,
    porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
  };
}
