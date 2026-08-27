import { consultar, consultarUno, type Ejecutor } from "@/lib/db";
import type { Cargo, SlugCargo } from "@/types";

/**
 * Consultas sobre la tabla cargos.
 *
 * El cargo es el eje que decide QUE CONTENIDO ve un trabajador, asi que las
 * filas son un conjunto cerrado que vive en el esquema. Este modelo solo lee.
 */

const COLUMNAS = "id, slug, nombre, descripcion";

/** Todos los cargos, en el orden en que se definieron. */
export async function listar(ejecutor?: Ejecutor): Promise<Cargo[]> {
  return consultar<Cargo>(`SELECT ${COLUMNAS} FROM cargos ORDER BY id`, [], ejecutor);
}

/** Busca un cargo por su slug, que es contra lo que se filtra el contenido. */
export async function buscarPorSlug(
  slug: SlugCargo,
  ejecutor?: Ejecutor,
): Promise<Cargo | null> {
  return consultarUno<Cargo>(
    `SELECT ${COLUMNAS} FROM cargos WHERE slug = $1`,
    [slug],
    ejecutor,
  );
}

/** Busca un cargo por su identificador. */
export async function buscarPorId(
  id: number,
  ejecutor?: Ejecutor,
): Promise<Cargo | null> {
  return consultarUno<Cargo>(
    `SELECT ${COLUMNAS} FROM cargos WHERE id = $1`,
    [id],
    ejecutor,
  );
}
