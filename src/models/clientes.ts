import { consultar, consultarUno, ejecutar, type Ejecutor } from "@/lib/db";
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

/**
 * Cuantas personas de contacto ACTIVAS tiene cada empresa del lote.
 *
 * Se pregunta por la pagina entera de una vez: el listado pinta hasta veinte
 * filas, y una consulta por fila serian veinte viajes para escribir un numero.
 * Es el mismo patron que `referencias.fichasGuardadas`.
 *
 * Cuenta solo las activas porque el numero responde «a cuanta gente puedo
 * escribirle en esta cuenta», y una cuenta desactivada no recibe nada.
 */
export async function contarPorEmpresas(
  ids: number[],
): Promise<Map<number, number>> {
  if (ids.length === 0) return new Map();

  const filas = await consultar<{ empresaId: number; total: string }>(
    `SELECT c.empresa_id AS "empresaId", count(*)::text AS total
     FROM clientes c
     JOIN usuarios u ON u.id = c.usuario_id
     WHERE c.empresa_id = ANY($1) AND u.activo
     GROUP BY c.empresa_id`,
    [ids],
  );

  return new Map(filas.map((fila) => [fila.empresaId, Number(fila.total)]));
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

/**
 * Quien puede decidir en la fase 5 por una empresa: sus personas activas con
 * el permiso de aprobar. Son a quienes se avisa de que una pieza les espera.
 */
export async function aprobadoresDe(empresaId: number, ejecutor?: Ejecutor): Promise<number[]> {
  const filas = await consultar<{ id: number }>(
    `SELECT u.id
     FROM clientes c
     JOIN usuarios u ON u.id = c.usuario_id
     WHERE c.empresa_id = $1 AND c.puede_aprobar AND u.activo`,
    [empresaId],
    ejecutor,
  );

  return filas.map((fila) => fila.id);
}

/** Concede o retira el permiso de aprobar. */
export async function cambiarPermisoDeAprobar(
  usuarioId: number,
  puedeAprobar: boolean,
  ejecutor?: Ejecutor,
): Promise<boolean> {
  const afectadas = await ejecutar(
    "UPDATE clientes SET puede_aprobar = $2 WHERE usuario_id = $1",
    [usuarioId, puedeAprobar],
    ejecutor,
  );

  return afectadas === 1;
}
