import { consultarUno, ejecutar, type Ejecutor } from "@/lib/db";
import type { Trabajador } from "@/types";

/**
 * Consultas sobre la tabla trabajadores, que vincula a un usuario con el
 * personal de la empresa y le asigna un rol.
 *
 * La base impide que un mismo usuario tenga fila aqui y en clientes: un
 * trigger lanza una violacion de unicidad si se intenta.
 */

const COLUMNAS = `
  id,
  usuario_id    AS "usuarioId",
  rol_id        AS "rolId",
  cargo_id      AS "cargoId",
  fecha_ingreso AS "fechaIngreso",
  creado_en     AS "creadoEn"
`;

/** Registra a un usuario como trabajador con un rol. */
export async function crear(
  datos: {
    usuarioId: number;
    rolId: number;
    cargoId: number;
    fechaIngreso: Date | null;
  },
  ejecutor?: Ejecutor,
): Promise<Trabajador> {
  const trabajador = await consultarUno<Trabajador>(
    `INSERT INTO trabajadores (usuario_id, rol_id, cargo_id, fecha_ingreso)
     VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE))
     RETURNING ${COLUMNAS}`,
    [datos.usuarioId, datos.rolId, datos.cargoId, datos.fechaIngreso],
    ejecutor,
  );

  if (!trabajador) {
    throw new Error("La insercion del trabajador no devolvio ninguna fila");
  }

  return trabajador;
}

/** Cambia el rol y el cargo de un trabajador. */
export async function actualizar(
  usuarioId: number,
  datos: { rolId: number; cargoId: number },
  ejecutor?: Ejecutor,
): Promise<boolean> {
  const afectadas = await ejecutar(
    "UPDATE trabajadores SET rol_id = $2, cargo_id = $3 WHERE usuario_id = $1",
    [usuarioId, datos.rolId, datos.cargoId],
    ejecutor,
  );

  return afectadas === 1;
}
