import { consultar, consultarUno, type Ejecutor } from "@/lib/db";
import type { NombreRol, Rol } from "@/types";

/** Consultas sobre la tabla roles. */

const COLUMNAS = "id, nombre, descripcion";

/** Todos los roles, en un orden estable para poder pintarlos en un selector. */
export async function listar(): Promise<Rol[]> {
  return consultar<Rol>(`SELECT ${COLUMNAS} FROM roles ORDER BY id`);
}

/**
 * Roles que se pueden asignar a un trabajador.
 *
 * "cliente" queda fuera: no es un rol que se asigne, se deriva de que la
 * persona tenga fila en la tabla clientes.
 */
export async function listarAsignables(): Promise<Rol[]> {
  return consultar<Rol>(
    `SELECT ${COLUMNAS} FROM roles WHERE nombre <> 'cliente' ORDER BY id`,
  );
}

/** Busca un rol por su nombre. */
export async function buscarPorNombre(
  nombre: NombreRol,
  ejecutor?: Ejecutor,
): Promise<Rol | null> {
  return consultarUno<Rol>(
    `SELECT ${COLUMNAS} FROM roles WHERE nombre = $1`,
    [nombre],
    ejecutor,
  );
}

/** Busca un rol por su identificador. */
export async function buscarPorId(
  id: number,
  ejecutor?: Ejecutor,
): Promise<Rol | null> {
  return consultarUno<Rol>(
    `SELECT ${COLUMNAS} FROM roles WHERE id = $1`,
    [id],
    ejecutor,
  );
}
