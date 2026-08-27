import {
  consultar,
  consultarUno,
  ejecutar,
  escaparLike,
  type Ejecutor,
} from "@/lib/db";
import type {
  Apertura,
  DatosNuevaApertura,
  SlugMecanismo,
  SlugTerritorio,
} from "@/types";

/**
 * Consultas sobre aperturas_hook: las 42 formas de empezar.
 *
 * Viven en la base porque la agencia las gestiona. No se borran nunca: se
 * retiran con `activa`, para que una apertura citada en fichas antiguas
 * siga pudiendo leerse.
 */

const COLUMNAS = `
  id,
  numero,
  territorio,
  mecanismos,
  plantilla,
  ejemplo,
  insert_titulo     AS "insertTitulo",
  direccion_edicion AS "direccionEdicion",
  usala_cuando      AS "usalaCuando",
  activa,
  creado_en         AS "creadoEn"
`;

export type FiltrosAperturas = {
  busqueda?: string;
  /** Lista: se pueden ver los de varios territorios a la vez. */
  territorio?: SlugTerritorio[];
  mecanismo?: SlugMecanismo;
  /** Por defecto solo las activas: las retiradas no se ofrecen para escribir. */
  incluirRetiradas?: boolean;
};

export async function listar(
  filtros: FiltrosAperturas = {},
): Promise<Apertura[]> {
  const condiciones: string[] = [];
  const valores: unknown[] = [];

  if (!filtros.incluirRetiradas) condiciones.push("activa");

  if (filtros.territorio?.length) {
    valores.push(filtros.territorio);
    condiciones.push(`territorio = ANY($${valores.length})`);
  }

  if (filtros.mecanismo) {
    // El operador de contencion de arrays: `mecanismos @> ARRAY['comparacion']`
    valores.push([filtros.mecanismo]);
    condiciones.push(`mecanismos @> $${valores.length}`);
  }

  if (filtros.busqueda?.trim()) {
    valores.push(`%${escaparLike(filtros.busqueda.trim())}%`);
    const marcador = `$${valores.length}`;
    condiciones.push(
      `(plantilla ILIKE ${marcador} ESCAPE '\\'
        OR ejemplo ILIKE ${marcador} ESCAPE '\\'
        OR insert_titulo ILIKE ${marcador} ESCAPE '\\'
        OR direccion_edicion ILIKE ${marcador} ESCAPE '\\'
        OR usala_cuando ILIKE ${marcador} ESCAPE '\\')`,
    );
  }

  const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  return consultar<Apertura>(
    `SELECT ${COLUMNAS} FROM aperturas_hook ${donde} ORDER BY numero`,
    valores,
  );
}

export async function buscarPorId(
  id: number,
  ejecutor?: Ejecutor,
): Promise<Apertura | null> {
  return consultarUno<Apertura>(
    `SELECT ${COLUMNAS} FROM aperturas_hook WHERE id = $1`,
    [id],
    ejecutor,
  );
}

/** Cuantas hay activas. Va en el contador del recorrido. */
export async function contarActivas(): Promise<number> {
  const fila = await consultarUno<{ total: string }>(
    "SELECT count(*)::text AS total FROM aperturas_hook WHERE activa",
  );

  return Number(fila?.total ?? 0);
}

/**
 * El siguiente numero libre.
 *
 * El numero es la identidad publica de la apertura ("la 37"), asi que una
 * nueva continua la serie en vez de reutilizar el hueco de una retirada.
 */
async function siguienteNumero(ejecutor?: Ejecutor): Promise<number> {
  const fila = await consultarUno<{ siguiente: number }>(
    "SELECT COALESCE(max(numero), 0) + 1 AS siguiente FROM aperturas_hook",
    [],
    ejecutor,
  );

  return fila?.siguiente ?? 1;
}

export async function crear(
  datos: Omit<DatosNuevaApertura, "numero">,
  ejecutor?: Ejecutor,
): Promise<Apertura> {
  const numero = await siguienteNumero(ejecutor);

  const apertura = await consultarUno<Apertura>(
    `INSERT INTO aperturas_hook (
       numero, territorio, mecanismos, plantilla, ejemplo,
       insert_titulo, direccion_edicion, usala_cuando
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${COLUMNAS}`,
    [
      numero,
      datos.territorio,
      datos.mecanismos,
      datos.plantilla,
      datos.ejemplo,
      datos.insertTitulo,
      datos.direccionEdicion,
      datos.usalaCuando,
    ],
    ejecutor,
  );

  if (!apertura) {
    throw new Error("La insercion de la apertura no devolvio ninguna fila");
  }

  return apertura;
}

export async function actualizar(
  id: number,
  datos: Omit<DatosNuevaApertura, "numero">,
): Promise<Apertura | null> {
  return consultarUno<Apertura>(
    `UPDATE aperturas_hook
     SET territorio = $2, mecanismos = $3, plantilla = $4, ejemplo = $5,
         insert_titulo = $6, direccion_edicion = $7, usala_cuando = $8
     WHERE id = $1
     RETURNING ${COLUMNAS}`,
    [
      id,
      datos.territorio,
      datos.mecanismos,
      datos.plantilla,
      datos.ejemplo,
      datos.insertTitulo,
      datos.direccionEdicion,
      datos.usalaCuando,
    ],
  );
}

/** Retira o repone una apertura. No hay borrado: ver la nota de arriba. */
export async function cambiarEstado(
  id: number,
  activa: boolean,
): Promise<boolean> {
  const afectadas = await ejecutar(
    "UPDATE aperturas_hook SET activa = $2 WHERE id = $1",
    [id, activa],
  );

  return afectadas === 1;
}
