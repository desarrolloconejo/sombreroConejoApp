import { consultarUno, ejecutar, type Ejecutor } from "@/lib/db";
import type { Cliente } from "@/types";

/**
 * Consultas sobre la tabla clientes, que vincula a un usuario con la empresa
 * a la que pertenece.
 *
 * Un usuario con fila aqui no puede tenerla en trabajadores: la base lo impide
 * con un trigger.
 */

const COLUMNAS = `
  id,
  usuario_id AS "usuarioId",
  empresa_id AS "empresaId",
  cargo,
  creado_en  AS "creadoEn"
`;

/** Registra a un usuario como persona de contacto de una empresa. */
export async function crear(
  datos: { usuarioId: number; empresaId: number; cargo: string | null },
  ejecutor?: Ejecutor,
): Promise<Cliente> {
  const cliente = await consultarUno<Cliente>(
    `INSERT INTO clientes (usuario_id, empresa_id, cargo)
     VALUES ($1, $2, $3)
     RETURNING ${COLUMNAS}`,
    [datos.usuarioId, datos.empresaId, datos.cargo],
    ejecutor,
  );

  if (!cliente) {
    throw new Error("La insercion del cliente no devolvio ninguna fila");
  }

  return cliente;
}

/** Busca el vinculo de cliente de un usuario. */
export async function buscarPorUsuarioId(
  usuarioId: number,
  ejecutor?: Ejecutor,
): Promise<Cliente | null> {
  return consultarUno<Cliente>(
    `SELECT ${COLUMNAS} FROM clientes WHERE usuario_id = $1`,
    [usuarioId],
    ejecutor,
  );
}

/** Cambia la empresa o el cargo de un cliente. */
export async function actualizar(
  usuarioId: number,
  datos: { empresaId: number; cargo: string | null },
  ejecutor?: Ejecutor,
): Promise<boolean> {
  const afectadas = await ejecutar(
    "UPDATE clientes SET empresa_id = $2, cargo = $3 WHERE usuario_id = $1",
    [usuarioId, datos.empresaId, datos.cargo],
    ejecutor,
  );

  return afectadas === 1;
}
