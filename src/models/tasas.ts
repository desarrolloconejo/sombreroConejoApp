import { consultar, ejecutar, type Ejecutor } from "@/lib/db";
import type {
  FuenteTasa,
  LecturaDeTasas,
  LecturaTasa,
  ResultadoLecturaTasa,
  TasaDeCambio,
} from "@/types";

/**
 * Consultas sobre finanzas.tasas_cambio y finanzas.lecturas_tasa.
 *
 * El ejecutor es obligatorio: la tabla tiene seguridad por fila. Lo entrega
 * `conSesion` cuando hay una persona, o `conSistema` cuando escribe la tarea
 * programada.
 */

const COLUMNAS = `
  id,
  fuente,
  moneda,
  to_char(fecha_valor, 'YYYY-MM-DD') AS "fechaValor",
  valor::text                        AS valor,
  origen,
  obtenida_en                        AS "obtenidaEn"
`;

/** BIGSERIAL llega como texto; aqui se maneja como numero. */
function comoTasa(fila: Omit<TasaDeCambio, "id"> & { id: string }): TasaDeCambio {
  return { ...fila, id: Number(fila.id) };
}

/**
 * Guarda las tasas de una lectura y devuelve cuantas eran nuevas.
 *
 * Lo que ya estaba NO se pisa: la tabla es un historico, y volver a leer la
 * misma fecha valor —pasa varias veces al dia— no debe cambiar nada.
 */
export async function registrarLectura(
  lectura: LecturaDeTasas,
  ejecutor: Ejecutor,
): Promise<number> {
  return ejecutar(
    `INSERT INTO finanzas.tasas_cambio (fuente, moneda, fecha_valor, valor, origen)
     SELECT $1, moneda, $2::date, valor::numeric, 'automatica'
     FROM unnest($3::text[], $4::text[]) AS leida (moneda, valor)
     ON CONFLICT (fuente, moneda, fecha_valor) DO NOTHING`,
    [
      lectura.fuente,
      lectura.fechaValor,
      lectura.tasas.map((tasa) => tasa.moneda),
      lectura.tasas.map((tasa) => tasa.valor),
    ],
    ejecutor,
  );
}

/**
 * La ultima tasa guardada de cada moneda, anterior a una fecha valor.
 *
 * Es contra lo que se compara una lectura nueva para saber si es creible.
 * Devuelve un mapa de moneda a valor.
 */
export async function ultimasAntesDe(
  fuente: FuenteTasa,
  fechaValor: string,
  ejecutor: Ejecutor,
): Promise<Map<string, string>> {
  const filas = await consultar<{ moneda: string; valor: string }>(
    `SELECT DISTINCT ON (moneda) moneda, valor::text AS valor
     FROM finanzas.tasas_cambio
     WHERE fuente = $1 AND fecha_valor < $2::date
     ORDER BY moneda, fecha_valor DESC`,
    [fuente, fechaValor],
    ejecutor,
  );

  return new Map(filas.map((fila) => [fila.moneda, fila.valor]));
}

/** La tasa vigente de cada moneda: la de fecha valor mas reciente. */
export async function vigentes(
  fuente: FuenteTasa,
  ejecutor: Ejecutor,
): Promise<TasaDeCambio[]> {
  const filas = await consultar<Parameters<typeof comoTasa>[0]>(
    `SELECT DISTINCT ON (moneda) ${COLUMNAS}
     FROM finanzas.tasas_cambio
     WHERE fuente = $1
     ORDER BY moneda, fecha_valor DESC`,
    [fuente],
    ejecutor,
  );

  return filas.map(comoTasa);
}

/** Las ultimas tasas de una moneda, de la mas reciente a la mas vieja. */
export async function recientes(
  fuente: FuenteTasa,
  moneda: string,
  limite: number,
  ejecutor: Ejecutor,
): Promise<TasaDeCambio[]> {
  const filas = await consultar<Parameters<typeof comoTasa>[0]>(
    `SELECT ${COLUMNAS}
     FROM finanzas.tasas_cambio
     WHERE fuente = $1 AND moneda = $2
     ORDER BY fecha_valor DESC
     LIMIT $3`,
    [fuente, moneda, limite],
    ejecutor,
  );

  return filas.map(comoTasa);
}

/**
 * Registra una tasa escrita a mano. Devuelve false si ya habia una para esa
 * fecha: la tabla es un historico y no se pisa.
 */
export async function registrarManual(
  datos: { fuente: FuenteTasa; moneda: string; fechaValor: string; valor: string },
  usuarioId: number,
  ejecutor: Ejecutor,
): Promise<boolean> {
  const filas = await ejecutar(
    `INSERT INTO finanzas.tasas_cambio (fuente, moneda, fecha_valor, valor, origen, registrada_por)
     VALUES ($1, $2, $3::date, $4::numeric, 'manual', $5)
     ON CONFLICT (fuente, moneda, fecha_valor) DO NOTHING`,
    [datos.fuente, datos.moneda, datos.fechaValor, datos.valor, usuarioId],
    ejecutor,
  );
  return filas === 1;
}

/** Si ya hay tasa de una moneda para una fecha. */
export async function hayTasaDel(
  fuente: FuenteTasa,
  moneda: string,
  fechaValor: string,
  ejecutor: Ejecutor,
): Promise<boolean> {
  const filas = await consultar<{ uno: number }>(
    `SELECT 1 AS uno FROM finanzas.tasas_cambio
     WHERE fuente = $1 AND moneda = $2 AND fecha_valor = $3::date`,
    [fuente, moneda, fechaValor],
    ejecutor,
  );
  return filas.length > 0;
}

/** Anota una corrida de la tarea diaria, acabe como acabe. */
export async function anotarLectura(
  datos: { resultado: ResultadoLecturaTasa; fechaValor: string | null; motivo: string | null },
  ejecutor: Ejecutor,
): Promise<void> {
  await ejecutar(
    `INSERT INTO finanzas.lecturas_tasa (resultado, fecha_valor, motivo)
     VALUES ($1, $2::date, $3)`,
    [datos.resultado, datos.fechaValor, datos.motivo],
    ejecutor,
  );
}

/** Las ultimas corridas de la tarea diaria, de la mas reciente a la mas vieja. */
export async function ultimasLecturas(limite: number, ejecutor: Ejecutor): Promise<LecturaTasa[]> {
  const filas = await consultar<Omit<LecturaTasa, "id"> & { id: string }>(
    `SELECT id,
            leida_en                           AS "leidaEn",
            resultado,
            to_char(fecha_valor, 'YYYY-MM-DD') AS "fechaValor",
            motivo
     FROM finanzas.lecturas_tasa
     ORDER BY leida_en DESC
     LIMIT $1`,
    [limite],
    ejecutor,
  );

  // BIGSERIAL llega como texto.
  return filas.map((fila) => ({ ...fila, id: Number(fila.id) }));
}
