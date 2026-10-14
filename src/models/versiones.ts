import { consultar, consultarUno, ejecutar, type Ejecutor } from "@/lib/db";
import type { NuevaVersion, Version } from "@/types";

/**
 * Consultas sobre portal.versiones: lo que se produce para cada pieza.
 *
 * El ejecutor es obligatorio y sale de `conSesion`. El cliente solo alcanza la
 * version enviada, y solo con la pieza frente a el: lo decide la base.
 */

const COLUMNAS = `
  v.id,
  v.pieza_id                        AS "piezaId",
  v.numero,
  v.ronda,
  v.fase,
  v.origen,
  v.enlace,
  v.nombre,
  v.mime,
  v.tamano,
  u.nombre || ' ' || u.apellido     AS "subidaPorNombre",
  v.creada_en                       AS "creadaEn",
  v.enviada_en                      AS "enviadaEn"
`;

const DESDE = `
  FROM portal.versiones v
  JOIN usuarios u ON u.id = v.subida_por
`;

/** Las versiones de una pieza, la mas nueva primero. */
export async function dePieza(piezaId: number, ejecutor: Ejecutor): Promise<Version[]> {
  return consultar<Version>(
    `SELECT ${COLUMNAS} ${DESDE}
     WHERE v.pieza_id = $1
     ORDER BY v.numero DESC`,
    [piezaId],
    ejecutor,
  );
}

/**
 * Una version, con donde esta guardado su archivo. Solo para la ruta de
 * entrega: `archivoId` no sale nunca hacia el navegador.
 */
export async function paraEntregar(
  id: number,
  ejecutor: Ejecutor,
): Promise<(Version & { archivoId: string | null; aprobada: boolean }) | null> {
  return consultarUno(
    `SELECT ${COLUMNAS},
            v.archivo_id AS "archivoId",
            EXISTS (
              SELECT 1 FROM portal.pieza_fases f
              WHERE f.pieza_id = v.pieza_id AND f.fase = 5 AND f.estado = 'completada'
            ) AS aprobada
     ${DESDE}
     WHERE v.id = $1`,
    [id],
    ejecutor,
  );
}

/** Guarda una version al final de la pieza. Devuelve su id. */
export async function crear(
  datos: NuevaVersion,
  subidaPor: number,
  ejecutor: Ejecutor,
): Promise<number> {
  const fila = await consultarUno<{ id: number }>(
    `INSERT INTO portal.versiones
       (pieza_id, numero, ronda, fase, origen, archivo_id, enlace, nombre, mime, tamano, subida_por)
     VALUES (
       $1,
       (SELECT COALESCE(max(numero), 0) + 1 FROM portal.versiones WHERE pieza_id = $1),
       $2, $3, $4, $5, $6, $7, $8, $9, $10
     )
     RETURNING id`,
    [
      datos.piezaId,
      datos.ronda,
      datos.fase,
      datos.origen,
      datos.archivoId ?? null,
      datos.enlace ?? null,
      datos.nombre,
      datos.mime ?? null,
      datos.tamano ?? null,
      subidaPor,
    ],
    ejecutor,
  );

  if (!fila) throw new Error("No se pudo guardar la version");

  return fila.id;
}

/** Cuantas versiones tiene ya una pieza: el numero de la siguiente es este mas uno. */
export async function contar(piezaId: number, ejecutor: Ejecutor): Promise<number> {
  const fila = await consultarUno<{ total: number }>(
    "SELECT count(*)::int AS total FROM portal.versiones WHERE pieza_id = $1",
    [piezaId],
    ejecutor,
  );

  return fila?.total ?? 0;
}

/**
 * Marca una version como la que vera el cliente en esta ronda. La que lo
 * estuviera antes deja de estarlo: solo hay una enviada por ronda.
 */
export async function marcarEnviada(
  id: number,
  piezaId: number,
  ronda: number,
  usuarioId: number,
  ejecutor: Ejecutor,
): Promise<boolean> {
  await ejecutar(
    `UPDATE portal.versiones
     SET enviada_en = NULL, enviada_por = NULL
     WHERE pieza_id = $1 AND ronda = $2 AND enviada_en IS NOT NULL AND id <> $3`,
    [piezaId, ronda, id],
    ejecutor,
  );

  const filas = await ejecutar(
    `UPDATE portal.versiones
     SET enviada_en = now(), enviada_por = $3
     WHERE id = $1 AND pieza_id = $2 AND ronda = $4 AND enviada_en IS NULL`,
    [id, piezaId, usuarioId, ronda],
    ejecutor,
  );

  return filas > 0;
}

/** La version enviada en una ronda, si la hay. */
export async function enviadaDeRonda(
  piezaId: number,
  ronda: number,
  ejecutor: Ejecutor,
): Promise<Version | null> {
  return consultarUno<Version>(
    `SELECT ${COLUMNAS} ${DESDE}
     WHERE v.pieza_id = $1 AND v.ronda = $2 AND v.enviada_en IS NOT NULL`,
    [piezaId, ronda],
    ejecutor,
  );
}
