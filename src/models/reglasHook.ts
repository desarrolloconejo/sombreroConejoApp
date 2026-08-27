import { consultar, consultarUno, ejecutar, type Ejecutor } from "@/lib/db";
import type { DatosNuevaRegla, LimitesAuditoria, ReglaHook } from "@/types";

/**
 * Consultas sobre reglas_hook: como habla cada cuenta.
 *
 * Las tres listas de terminos se guardan como TEXTO separado por comas, que es
 * como las escribe el formulario, y se parten aqui. Se hace en el modelo y no
 * en la action para que nadie fuera de esta capa tenga que saber que por
 * dentro es una cadena.
 */

const COLUMNAS = `
  id,
  etiqueta,
  empresa_id            AS "empresaId",
  sector,
  max_palabras_voz      AS "maxPalabrasVoz",
  max_palabras_insert   AS "maxPalabrasInsert",
  exigir_prueba         AS "exigirPrueba",
  preambulos,
  formulas_gastadas     AS "formulasGastadas",
  terminos_tension      AS "terminosTension",
  creado_por            AS "creadoPor",
  creado_en             AS "creadoEn",
  actualizado_en        AS "actualizadoEn"
`;

/** Lo que devuelve el driver antes de partir las listas. */
type FilaRegla = Omit<
  ReglaHook,
  "preambulos" | "formulasGastadas" | "terminosTension"
> & {
  preambulos: string;
  formulasGastadas: string;
  terminosTension: string;
};

/** "hola, buenas ,  chicos" -> ["hola", "buenas", "chicos"] */
function partir(texto: string): string[] {
  return texto
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function comoRegla(fila: FilaRegla): ReglaHook {
  return {
    ...fila,
    preambulos: partir(fila.preambulos),
    formulasGastadas: partir(fila.formulasGastadas),
    terminosTension: partir(fila.terminosTension),
  };
}

/** Todas las reglas, la del cliente antes que la del sector. */
export async function listar(): Promise<ReglaHook[]> {
  const filas = await consultar<FilaRegla>(
    `SELECT ${COLUMNAS}
     FROM reglas_hook
     ORDER BY (empresa_id IS NULL), etiqueta`,
  );

  return filas.map(comoRegla);
}

export async function buscarPorId(
  id: number,
  ejecutor?: Ejecutor,
): Promise<ReglaHook | null> {
  const fila = await consultarUno<FilaRegla>(
    `SELECT ${COLUMNAS} FROM reglas_hook WHERE id = $1`,
    [id],
    ejecutor,
  );

  return fila ? comoRegla(fila) : null;
}

/**
 * La regla que gobierna a una empresa.
 *
 * El orden importa y es el del documento: primero una regla de ESE cliente,
 * si no la hay una de su SECTOR, y si tampoco, ninguna — quien llama usa
 * entonces el estandar de la casa. Nunca se combinan: gana una sola.
 *
 * Se resuelve en una consulta con ORDER BY en lugar de dos viajes: la clave
 * es que `empresa_id = $1` ordena antes que la coincidencia por sector.
 */
export async function resolverParaEmpresa(
  empresaId: number,
  ejecutor?: Ejecutor,
): Promise<ReglaHook | null> {
  const fila = await consultarUno<FilaRegla>(
    `SELECT ${COLUMNAS}
     FROM reglas_hook
     WHERE empresa_id = $1
        OR (
          empresa_id IS NULL
          AND sector IS NOT NULL
          AND sector = (SELECT sector FROM empresas WHERE id = $1)
        )
     ORDER BY (empresa_id IS NULL)
     LIMIT 1`,
    [empresaId],
    ejecutor,
  );

  return fila ? comoRegla(fila) : null;
}

/**
 * Los limites con los que auditar, ya listos para el auditor.
 *
 * Devuelve null cuando la cuenta no tiene regla propia, y es quien llama
 * quien decide caer al estandar. Se prefiere null a devolver el estandar
 * aqui para que la interfaz pueda decir si la regla es de la cuenta o de
 * la casa, que es informacion que la creadora necesita ver.
 */
export async function limitesDeEmpresa(
  empresaId: number,
): Promise<LimitesAuditoria | null> {
  const regla = await resolverParaEmpresa(empresaId);

  if (!regla) return null;

  return {
    etiqueta: regla.etiqueta,
    maxPalabrasVoz: regla.maxPalabrasVoz,
    maxPalabrasInsert: regla.maxPalabrasInsert,
    exigirPrueba: regla.exigirPrueba,
    preambulos: regla.preambulos,
    formulasGastadas: regla.formulasGastadas,
    terminosTension: regla.terminosTension,
  };
}

export async function crear(
  datos: DatosNuevaRegla,
  ejecutor?: Ejecutor,
): Promise<ReglaHook> {
  const fila = await consultarUno<FilaRegla>(
    `INSERT INTO reglas_hook (
       etiqueta, empresa_id, sector, max_palabras_voz, max_palabras_insert,
       exigir_prueba, preambulos, formulas_gastadas, terminos_tension, creado_por
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING ${COLUMNAS}`,
    [
      datos.etiqueta,
      datos.empresaId,
      datos.sector,
      datos.maxPalabrasVoz,
      datos.maxPalabrasInsert,
      datos.exigirPrueba,
      datos.preambulos.join(", "),
      datos.formulasGastadas.join(", "),
      datos.terminosTension.join(", "),
      datos.creadoPor,
    ],
    ejecutor,
  );

  if (!fila) throw new Error("La insercion de la regla no devolvio ninguna fila");

  return comoRegla(fila);
}

export async function actualizar(
  id: number,
  datos: Omit<DatosNuevaRegla, "creadoPor">,
): Promise<ReglaHook | null> {
  const fila = await consultarUno<FilaRegla>(
    `UPDATE reglas_hook
     SET etiqueta = $2, empresa_id = $3, sector = $4,
         max_palabras_voz = $5, max_palabras_insert = $6, exigir_prueba = $7,
         preambulos = $8, formulas_gastadas = $9, terminos_tension = $10
     WHERE id = $1
     RETURNING ${COLUMNAS}`,
    [
      id,
      datos.etiqueta,
      datos.empresaId,
      datos.sector,
      datos.maxPalabrasVoz,
      datos.maxPalabrasInsert,
      datos.exigirPrueba,
      datos.preambulos.join(", "),
      datos.formulasGastadas.join(", "),
      datos.terminosTension.join(", "),
    ],
  );

  return fila ? comoRegla(fila) : null;
}

/**
 * Borra una regla.
 *
 * Aqui si se borra de verdad, al contrario que con las aperturas: una regla
 * no queda citada en ninguna ficha. Lo que se guarda en la ficha es la nota
 * que salio, no con que limites se calculo.
 */
export async function borrar(id: number): Promise<boolean> {
  const afectadas = await ejecutar("DELETE FROM reglas_hook WHERE id = $1", [id]);
  return afectadas === 1;
}
