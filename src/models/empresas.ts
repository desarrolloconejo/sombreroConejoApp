import { consultar, consultarUno, ejecutar, escaparLike, type Ejecutor } from "@/lib/db";
import type { DatosNuevaEmpresa, Empresa } from "@/types";

/** Consultas sobre la tabla empresas. */

const COLUMNAS = `
  id,
  nombre,
  rif,
  sector,
  telefono,
  direccion,
  logo_url       AS "logoUrl",
  activo,
  creado_en      AS "creadoEn",
  actualizado_en AS "actualizadoEn"
`;

/** Empresas activas, ordenadas por nombre. Alimenta el selector de clientes. */
export async function listarActivas(): Promise<Empresa[]> {
  return consultar<Empresa>(
    `SELECT ${COLUMNAS} FROM empresas WHERE activo ORDER BY nombre`,
  );
}

/** Todas las empresas, activas o no. */
export async function listar(busqueda?: string): Promise<Empresa[]> {
  if (!busqueda?.trim()) {
    return consultar<Empresa>(`SELECT ${COLUMNAS} FROM empresas ORDER BY nombre`);
  }

  return consultar<Empresa>(
    `SELECT ${COLUMNAS}
     FROM empresas
     WHERE nombre ILIKE $1 ESCAPE '\\' OR rif ILIKE $1 ESCAPE '\\'
     ORDER BY nombre`,
    [`%${escaparLike(busqueda.trim())}%`],
  );
}

/** Busca una empresa por su identificador. */
export async function buscarPorId(
  id: number,
  ejecutor?: Ejecutor,
): Promise<Empresa | null> {
  return consultarUno<Empresa>(
    `SELECT ${COLUMNAS} FROM empresas WHERE id = $1`,
    [id],
    ejecutor,
  );
}

/** Inserta una empresa y devuelve la fila creada. */
export async function crear(
  datos: DatosNuevaEmpresa,
  ejecutor?: Ejecutor,
): Promise<Empresa> {
  const empresa = await consultarUno<Empresa>(
    `INSERT INTO empresas (nombre, rif, sector, telefono, direccion)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${COLUMNAS}`,
    [datos.nombre, datos.rif, datos.sector, datos.telefono, datos.direccion],
    ejecutor,
  );

  if (!empresa) {
    throw new Error("La insercion de la empresa no devolvio ninguna fila");
  }

  return empresa;
}

/** Activa o desactiva una empresa. */
export async function cambiarEstado(id: number, activo: boolean): Promise<boolean> {
  const afectadas = await ejecutar(
    "UPDATE empresas SET activo = $2 WHERE id = $1",
    [id, activo],
  );

  return afectadas === 1;
}
