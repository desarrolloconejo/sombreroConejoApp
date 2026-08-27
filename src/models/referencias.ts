import {
  consultar,
  consultarUno,
  ejecutar,
  escaparLike,
  type Ejecutor,
} from "@/lib/db";
import type {
  DatosNuevaReferencia,
  ReferenciaHook,
  SlugPlataforma,
  SlugTerritorio,
} from "@/types";

/**
 * Consultas sobre referencias_hook: el banco del equipo.
 *
 * Las etiquetas se guardan como texto separado por comas, igual que las listas
 * de las reglas, y se parten aqui. Son pocas por referencia y solo sirven para
 * buscar: una tabla puente seria mas maquinaria de la que el problema pide.
 */

const COLUMNAS = `
  r.id,
  r.hablado,
  r.insert_titulo AS "insertTitulo",
  r.plataforma,
  r.territorio,
  r.url_fuente    AS "urlFuente",
  r.lectura,
  r.etiquetas,
  r.creado_por    AS "creadoPor",
  r.creado_en     AS "creadoEn"
`;

type FilaReferencia = Omit<ReferenciaHook, "etiquetas"> & { etiquetas: string };

function comoReferencia(fila: FilaReferencia): ReferenciaHook {
  return {
    ...fila,
    etiquetas: fila.etiquetas
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean),
  };
}

export type FiltrosReferencias = {
  busqueda?: string;
  plataforma?: SlugPlataforma;
  territorio?: SlugTerritorio;
};

export async function listar(
  filtros: FiltrosReferencias = {},
): Promise<ReferenciaHook[]> {
  const condiciones: string[] = [];
  const valores: unknown[] = [];

  if (filtros.plataforma) {
    valores.push(filtros.plataforma);
    condiciones.push(`r.plataforma = $${valores.length}`);
  }

  if (filtros.territorio) {
    valores.push(filtros.territorio);
    condiciones.push(`r.territorio = $${valores.length}`);
  }

  if (filtros.busqueda?.trim()) {
    valores.push(`%${escaparLike(filtros.busqueda.trim())}%`);
    const marcador = `$${valores.length}`;
    // Se busca tambien en la lectura: muchas veces uno recuerda POR QUE
    // funcionaba antes que la frase exacta.
    condiciones.push(
      `(r.hablado ILIKE ${marcador} ESCAPE '\\'
        OR r.insert_titulo ILIKE ${marcador} ESCAPE '\\'
        OR r.lectura ILIKE ${marcador} ESCAPE '\\'
        OR r.etiquetas ILIKE ${marcador} ESCAPE '\\')`,
    );
  }

  const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  const filas = await consultar<FilaReferencia>(
    `SELECT ${COLUMNAS} FROM referencias_hook r ${donde} ORDER BY r.creado_en DESC`,
    valores,
  );

  return filas.map(comoReferencia);
}

export async function buscarPorId(
  id: number,
  ejecutor?: Ejecutor,
): Promise<ReferenciaHook | null> {
  const fila = await consultarUno<FilaReferencia>(
    `SELECT ${COLUMNAS} FROM referencias_hook r WHERE r.id = $1`,
    [id],
    ejecutor,
  );

  return fila ? comoReferencia(fila) : null;
}

export async function contar(): Promise<number> {
  const fila = await consultarUno<{ total: string }>(
    "SELECT count(*)::text AS total FROM referencias_hook",
  );

  return Number(fila?.total ?? 0);
}

export async function crear(
  datos: DatosNuevaReferencia,
  ejecutor?: Ejecutor,
): Promise<ReferenciaHook> {
  const fila = await consultarUno<FilaReferencia>(
    `INSERT INTO referencias_hook (
       hablado, insert_titulo, plataforma, territorio, url_fuente,
       lectura, etiquetas, creado_por
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${COLUMNAS.replace(/r\./g, "")}`,
    [
      datos.hablado,
      datos.insertTitulo,
      datos.plataforma,
      datos.territorio,
      datos.urlFuente,
      datos.lectura,
      datos.etiquetas.join(", "),
      datos.creadoPor,
    ],
    ejecutor,
  );

  if (!fila) {
    throw new Error("La insercion de la referencia no devolvio ninguna fila");
  }

  return comoReferencia(fila);
}

export async function actualizar(
  id: number,
  datos: Omit<DatosNuevaReferencia, "creadoPor">,
): Promise<ReferenciaHook | null> {
  const fila = await consultarUno<FilaReferencia>(
    `UPDATE referencias_hook
     SET hablado = $2, insert_titulo = $3, plataforma = $4, territorio = $5,
         url_fuente = $6, lectura = $7, etiquetas = $8
     WHERE id = $1
     RETURNING ${COLUMNAS.replace(/r\./g, "")}`,
    [
      id,
      datos.hablado,
      datos.insertTitulo,
      datos.plataforma,
      datos.territorio,
      datos.urlFuente,
      datos.lectura,
      datos.etiquetas.join(", "),
    ],
  );

  return fila ? comoReferencia(fila) : null;
}

/**
 * Borra una referencia.
 *
 * Aqui si se borra: una referencia es material de consulta y no queda citada
 * en ninguna ficha. Lo que se lleva al Canvas es una copia del texto, no un
 * vinculo.
 */
export async function borrar(id: number): Promise<boolean> {
  const afectadas = await ejecutar(
    "DELETE FROM referencias_hook WHERE id = $1",
    [id],
  );

  return afectadas === 1;
}
