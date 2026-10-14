import { consultar, consultarUno, ejecutar, type Ejecutor } from "@/lib/db";
import type { NumeroFase, Revision, TipoCorreccion } from "@/types";

/**
 * Consultas sobre portal.revisiones: lo que decidio el cliente en cada ronda.
 *
 * Las escribe el cliente con permiso de aprobar; el ejecutivo solo ajusta la
 * ruta de una correccion. El movimiento de fases que acompana a la decision
 * lo hace `portal.decidir_fase_5`, la unica via del cliente sobre las fases.
 */

const COLUMNAS = `
  r.id,
  r.pieza_id                        AS "piezaId",
  r.ronda,
  r.decision,
  r.tipo_correccion                 AS "tipoCorreccion",
  r.comentario,
  r.fases_reabiertas::int[]         AS "fasesReabiertas",
  r.version_id                      AS "versionId",
  a.nombre || ' ' || a.apellido     AS "autorNombre",
  r.creada_en                       AS "creadaEn",
  j.nombre || ' ' || j.apellido     AS "ajustadaPorNombre",
  r.ajustada_en                     AS "ajustadaEn"
`;

const DESDE = `
  FROM portal.revisiones r
  JOIN usuarios a ON a.id = r.autor_id
  LEFT JOIN usuarios j ON j.id = r.ajustada_por
`;

/** Las decisiones sobre una pieza, la mas reciente primero. */
export async function dePieza(piezaId: number, ejecutor: Ejecutor): Promise<Revision[]> {
  return consultar<Revision>(
    `SELECT ${COLUMNAS} ${DESDE}
     WHERE r.pieza_id = $1
     ORDER BY r.ronda DESC`,
    [piezaId],
    ejecutor,
  );
}

/** La revision de una ronda, si la hay. */
export async function deRonda(
  piezaId: number,
  ronda: number,
  ejecutor: Ejecutor,
): Promise<Revision | null> {
  return consultarUno<Revision>(
    `SELECT ${COLUMNAS} ${DESDE}
     WHERE r.pieza_id = $1 AND r.ronda = $2`,
    [piezaId, ronda],
    ejecutor,
  );
}

/** Deja constancia de la decision. Devuelve su id. */
export async function crear(
  datos: {
    piezaId: number;
    ronda: number;
    aprobar: boolean;
    tipoCorreccion: TipoCorreccion | null;
    comentario: string | null;
    fasesReabiertas: readonly NumeroFase[];
    versionId: number | null;
  },
  autorId: number,
  ejecutor: Ejecutor,
): Promise<number> {
  const fila = await consultarUno<{ id: number }>(
    `INSERT INTO portal.revisiones
       (pieza_id, ronda, decision, tipo_correccion, comentario, fases_reabiertas,
        version_id, autor_id)
     VALUES ($1, $2, $3, $4, $5, $6::smallint[], $7, $8)
     RETURNING id`,
    [
      datos.piezaId,
      datos.ronda,
      datos.aprobar ? "aprobada" : "correccion",
      datos.tipoCorreccion,
      datos.comentario,
      datos.fasesReabiertas,
      datos.versionId,
      autorId,
    ],
    ejecutor,
  );

  if (!fila) throw new Error("No se pudo guardar la decision");

  return fila.id;
}

/**
 * Mueve las fases segun la decision, a traves de la funcion de la base, que
 * es la unica via del cliente. Devuelve la ronda en que queda la pieza.
 */
export async function aplicarDecision(
  piezaId: number,
  aprobar: boolean,
  reabre: readonly NumeroFase[],
  ejecutor: Ejecutor,
): Promise<number> {
  const fila = await consultarUno<{ ronda: number }>(
    "SELECT portal.decidir_fase_5($1, $2, $3::smallint[]) AS ronda",
    [piezaId, aprobar, reabre],
    ejecutor,
  );

  if (!fila) throw new Error("La decision no se aplico");

  return fila.ronda;
}

/** Guarda la ruta ajustada por el ejecutivo. */
export async function ajustar(
  id: number,
  fasesReabiertas: readonly NumeroFase[],
  usuarioId: number,
  ejecutor: Ejecutor,
): Promise<boolean> {
  const filas = await ejecutar(
    `UPDATE portal.revisiones
     SET fases_reabiertas = $2::smallint[], ajustada_por = $3, ajustada_en = now()
     WHERE id = $1 AND decision = 'correccion'`,
    [id, fasesReabiertas, usuarioId],
    ejecutor,
  );

  return filas > 0;
}
