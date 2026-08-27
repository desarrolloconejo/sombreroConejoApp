import { consultarUno, transaccion, type Ejecutor } from "@/lib/db";
import type { ResultadoHook } from "@/types";

/**
 * Consultas sobre resultados_hook: lo que paso de verdad.
 *
 * Es el final del recorrido. Una pieza esta terminada cuando tiene una fila
 * aqui, no cuando saca buena nota en el auditor.
 */

const COLUMNAS = `
  id,
  ficha_id       AS "fichaId",
  impresiones,
  vistas_3s      AS "vistas3s",
  guardados,
  compartidos,
  clics,
  conversiones,
  aprendizaje,
  observado_en   AS "observadoEn",
  actualizado_en AS "actualizadoEn"
`;

export type DatosResultado = {
  impresiones: number;
  vistas3s: number;
  guardados: number;
  compartidos: number;
  clics: number;
  conversiones: number;
  aprendizaje: string | null;
};

export async function buscarPorFicha(
  fichaId: number,
  ejecutor?: Ejecutor,
): Promise<ResultadoHook | null> {
  return consultarUno<ResultadoHook>(
    `SELECT ${COLUMNAS} FROM resultados_hook WHERE ficha_id = $1`,
    [fichaId],
    ejecutor,
  );
}

/**
 * Guarda el resultado de una ficha y la deja marcada como medida.
 *
 * Es un UPSERT contra `ficha_id`, que es UNICO: registrar dos veces la misma
 * pieza ACTUALIZA en lugar de duplicar. Sin eso, corregir una cifra mal
 * copiada dejaria dos filas y la ficha tendria dos verdades.
 *
 * Las dos escrituras van en una transaccion: una ficha con resultado pero sin
 * el estado "medida" desapareceria del recuento de terminadas, y al reves
 * apareceria terminada sin numeros que ensenar.
 */
export async function guardar(
  fichaId: number,
  datos: DatosResultado,
): Promise<ResultadoHook> {
  return transaccion(async (cliente) => {
    const resultado = await consultarUno<ResultadoHook>(
      `INSERT INTO resultados_hook (
         ficha_id, impresiones, vistas_3s, guardados, compartidos, clics,
         conversiones, aprendizaje
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (ficha_id) DO UPDATE
         SET impresiones  = EXCLUDED.impresiones,
             vistas_3s    = EXCLUDED.vistas_3s,
             guardados    = EXCLUDED.guardados,
             compartidos  = EXCLUDED.compartidos,
             clics        = EXCLUDED.clics,
             conversiones = EXCLUDED.conversiones,
             aprendizaje  = EXCLUDED.aprendizaje
       RETURNING ${COLUMNAS}`,
      [
        fichaId,
        datos.impresiones,
        datos.vistas3s,
        datos.guardados,
        datos.compartidos,
        datos.clics,
        datos.conversiones,
        datos.aprendizaje,
      ],
      cliente,
    );

    if (!resultado) {
      throw new Error("El guardado del resultado no devolvio ninguna fila");
    }

    await cliente.query(
      "UPDATE fichas_hook SET estado = 'medida' WHERE id = $1",
      [fichaId],
    );

    return resultado;
  });
}
