import {
  consultar,
  consultarUno,
  ejecutar,
  escaparLike,
  identificadorSeguro,
  type Ejecutor,
} from "@/lib/db";
import type {
  EstadoFicha,
  FichaConResultado,
  FichaHook,
  Pagina,
  SlugObjetivo,
} from "@/types";

/**
 * Consultas sobre fichas_hook.
 *
 * EL ALCANCE ES MIXTO, Y ES DELIBERADO
 * ------------------------------------
 * Cada quien trabaja sobre SU pieza, pero el historial es del equipo. Son dos
 * necesidades distintas y por eso hay dos comportamientos:
 *
 * - `enCurso`, `ultimaMedida` y `contarPorEstado` reciben un usuario y filtran
 *   por el. Alimentan la portada del modulo, que responde "que estoy haciendo
 *   yo": con el alcance de equipo, a alguien le aparecia como pieza en curso
 *   el borrador de otro, y el porcentaje de avance no era el suyo.
 *
 * - `listar`, `buscarPorId` y `buscarConResultado` NO filtran. Son el
 *   historial, donde se consulta y se aprende de lo que hizo la agencia
 *   entera, y donde se puede ver, editar y borrar lo de cualquiera.
 *
 * Filtrar la lectura no protege nada por si solo: `actualizar`, `borrar` y
 * `guardarNota` siguen yendo por id, asi que si algun dia hiciera falta
 * restringir quien puede tocar que, la comprobacion va en la action, no aqui.
 */

const COLUMNAS = `
  f.id,
  f.empresa_id        AS "empresaId",
  e.nombre            AS "empresaNombre",
  f.objetivo,
  f.plataforma,
  f.audiencia,
  f.tension,
  f.verdad_marca      AS "verdadMarca",
  f.prueba,
  f.hablado,
  f.insert_titulo     AS "insertTitulo",
  f.primer_fotograma  AS "primerFotograma",
  f.pago_promesa      AS "pagoPromesa",
  f.cta,
  f.riesgo_claim      AS "riesgoClaim",
  f.nota_auditor      AS "notaAuditor",
  f.metrica_principal AS "metricaPrincipal",
  f.estado,
  f.tarea_id          AS "tareaId",
  f.creado_por        AS "creadoPor",
  u.nombre            AS "creadoPorNombre",
  f.creado_en         AS "creadoEn",
  f.actualizado_en    AS "actualizadoEn"
`;

const DESDE = `
  FROM fichas_hook f
  JOIN empresas e ON e.id = f.empresa_id
  JOIN usuarios u ON u.id = f.creado_por
`;

const COLUMNAS_ORDEN = {
  creadoEn: "f.creado_en",
  actualizadoEn: "f.actualizado_en",
  nota: "f.nota_auditor",
  empresa: "e.nombre",
} as const;

export type FiltrosFichas = {
  busqueda?: string;

  /*
   * Los filtros son LISTAS: el listado admite elegir varios valores del mismo
   * grupo. Una lista vacia equivale a no filtrar por esa clave.
   */
  empresaId?: number[];
  estado?: EstadoFicha[];
  objetivo?: SlugObjetivo[];
  orden?: string;
  direccion?: "asc" | "desc";
  pagina?: number;
  porPagina?: number;
};

export async function buscarPorId(
  id: number,
  ejecutor?: Ejecutor,
): Promise<FichaHook | null> {
  return consultarUno<FichaHook>(
    `SELECT ${COLUMNAS} ${DESDE} WHERE f.id = $1`,
    [id],
    ejecutor,
  );
}

/**
 * Una ficha con su resultado y su tasa ya calculada.
 *
 * El hook rate se calcula en SQL y no en TypeScript porque asi la misma cifra
 * sirve para ordenar y para filtrar sin traerse todas las filas. `NULLIF`
 * evita la division por cero cuando aun no hay impresiones.
 */
const HOOK_RATE = `
  CASE
    WHEN r.impresiones > 0
    THEN round(r.vistas_3s::numeric * 100 / NULLIF(r.impresiones, 0), 1)::float8
  END AS "hookRate"
`;

const RESULTADO = `
  CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object(
    'id', r.id,
    'fichaId', r.ficha_id,
    'impresiones', r.impresiones,
    'vistas3s', r.vistas_3s,
    'meGusta', r.me_gusta,
    'compartidos', r.compartidos,
    'clics', r.clics,
    'guardados', r.guardados,
    'aprendizaje', r.aprendizaje,
    'observadoEn', r.observado_en,
    'actualizadoEn', r.actualizado_en
  ) END AS resultado
`;

export async function buscarConResultado(
  id: number,
): Promise<FichaConResultado | null> {
  return consultarUno<FichaConResultado>(
    `SELECT ${COLUMNAS}, ${RESULTADO}, ${HOOK_RATE}
     ${DESDE}
     LEFT JOIN resultados_hook r ON r.ficha_id = f.id
     WHERE f.id = $1`,
    [id],
  );
}

/** Listado paginado del historial. */
export async function listar(
  filtros: FiltrosFichas = {},
): Promise<Pagina<FichaConResultado>> {
  const pagina = Math.max(1, Math.trunc(filtros.pagina ?? 1));
  const porPagina = Math.min(100, Math.max(1, Math.trunc(filtros.porPagina ?? 20)));

  const condiciones: string[] = [];
  const valores: unknown[] = [];

  if (filtros.busqueda?.trim()) {
    valores.push(`%${escaparLike(filtros.busqueda.trim())}%`);
    const marcador = `$${valores.length}`;
    condiciones.push(
      `(f.hablado ILIKE ${marcador} ESCAPE '\\'
        OR f.insert_titulo ILIKE ${marcador} ESCAPE '\\'
        OR e.nombre ILIKE ${marcador} ESCAPE '\\')`,
    );
  }

  /*
   * ANY y no IN.
   *
   * Con ANY la lista entera viaja como UN parametro, asi que el texto de la
   * consulta no cambia con el numero de valores: no hay que fabricar
   * marcadores a mano, no hay riesgo de descuadrar la numeracion, y el plan de
   * PostgreSQL se reutiliza entre peticiones. Con IN habria que generar tantos
   * marcadores como valores, que es justo donde se cuela una concatenacion.
   */
  if (filtros.empresaId?.length) {
    valores.push(filtros.empresaId);
    condiciones.push(`f.empresa_id = ANY($${valores.length})`);
  }

  if (filtros.estado?.length) {
    valores.push(filtros.estado);
    condiciones.push(`f.estado = ANY($${valores.length})`);
  }

  if (filtros.objetivo?.length) {
    valores.push(filtros.objetivo);
    condiciones.push(`f.objetivo = ANY($${valores.length})`);
  }

  const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  const claveOrden = identificadorSeguro(
    filtros.orden ?? "actualizadoEn",
    Object.keys(COLUMNAS_ORDEN) as (keyof typeof COLUMNAS_ORDEN)[],
  );
  const columnaOrden = COLUMNAS_ORDEN[claveOrden];
  const direccion = identificadorSeguro(filtros.direccion ?? "desc", ["asc", "desc"]);

  const totales = await consultarUno<{ total: string }>(
    `SELECT count(*)::text AS total ${DESDE} ${donde}`,
    valores,
  );
  const total = Number(totales?.total ?? 0);

  valores.push(porPagina, (pagina - 1) * porPagina);

  const filas = await consultar<FichaConResultado>(
    `SELECT ${COLUMNAS}, ${RESULTADO}, ${HOOK_RATE}
     ${DESDE}
     LEFT JOIN resultados_hook r ON r.ficha_id = f.id
     ${donde}
     ORDER BY ${columnaOrden} ${direccion.toUpperCase()} NULLS LAST, f.id DESC
     LIMIT $${valores.length - 1} OFFSET $${valores.length}`,
    valores,
  );

  return {
    filas,
    total,
    pagina,
    porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
  };
}

/**
 * Las piezas en curso: las que muestra la raiz del modulo.
 *
 * Son las que aun NO estan medidas, en ORDEN DE CREACION, la ultima primero.
 *
 * Antes esto devolvia una sola y ordenaba por lo avanzada que estuviera —las
 * que solo esperaban numeros por delante de los borradores—. La idea era que
 * una pieza publicada sin metricas es la que mas urge cerrar, pero el efecto
 * practico era otro: la portada ensenaba una pieza que podia no tener nada que
 * ver con lo que se estaba escribiendo, y las demas no existian.
 *
 * Devolver la lista deja que sea quien mira el que decida cual retomar, que es
 * una decision suya y no del ORDER BY.
 */
export async function enCurso(
  creadoPor: number,
  limite = 10,
): Promise<FichaConResultado[]> {
  return consultar<FichaConResultado>(
    `SELECT ${COLUMNAS}, ${RESULTADO}, ${HOOK_RATE}
     ${DESDE}
     LEFT JOIN resultados_hook r ON r.ficha_id = f.id
     WHERE f.creado_por = $1 AND f.estado <> 'medida'
     ORDER BY f.creado_en DESC
     LIMIT $2`,
    [creadoPor, limite],
  );
}

/** La ultima terminada, para el cuarto estado de la tarjeta de la raiz. */
export async function ultimaMedida(
  creadoPor: number,
): Promise<FichaConResultado | null> {
  return consultarUno<FichaConResultado>(
    `SELECT ${COLUMNAS}, ${RESULTADO}, ${HOOK_RATE}
     ${DESDE}
     LEFT JOIN resultados_hook r ON r.ficha_id = f.id
     WHERE f.creado_por = $1 AND f.estado = 'medida'
     ORDER BY f.actualizado_en DESC
     LIMIT 1`,
    [creadoPor],
  );
}

/** Cuantas fichas hay en cada estado. Alimenta los contadores del recorrido. */
/**
 * Cuantas piezas tiene cada empresa del lote, en cualquier estado.
 *
 * Para el listado de empresas. Va por lote y no por fila, como los demas
 * recuentos del proyecto. No filtra por usuario: la cartera es de la agencia,
 * no de quien mira.
 */
export async function contarPorEmpresas(
  ids: number[],
): Promise<Map<number, number>> {
  if (ids.length === 0) return new Map();

  const filas = await consultar<{ empresaId: number; total: string }>(
    `SELECT empresa_id AS "empresaId", count(*)::text AS total
     FROM fichas_hook
     WHERE empresa_id = ANY($1)
     GROUP BY empresa_id`,
    [ids],
  );

  return new Map(filas.map((fila) => [fila.empresaId, Number(fila.total)]));
}

/**
 * Las piezas de UNA empresa, repartidas por estado. Para su ficha de detalle.
 *
 * Es `contarPorEstado` con otra condicion: alli la pregunta es «que estoy
 * haciendo yo» y aqui «en que punto esta la cuenta».
 */
export async function contarPorEstadoDeEmpresa(
  empresaId: number,
): Promise<Record<EstadoFicha, number>> {
  const filas = await consultar<{ estado: EstadoFicha; total: string }>(
    `SELECT estado, count(*)::text AS total
     FROM fichas_hook
     WHERE empresa_id = $1
     GROUP BY estado`,
    [empresaId],
  );

  const conteo: Record<EstadoFicha, number> = {
    borrador: 0,
    auditada: 0,
    medida: 0,
  };

  for (const fila of filas) conteo[fila.estado] = Number(fila.total);

  return conteo;
}

export async function contarPorEstado(
  creadoPor: number,
): Promise<Record<EstadoFicha, number>> {
  // Esta es la unica consulta que va contra la tabla pelada, sin el JOIN de
  // las demas, asi que la columna se nombra sin alias.
  const filas = await consultar<{ estado: EstadoFicha; total: string }>(
    `SELECT estado, count(*)::text AS total
     FROM fichas_hook
     WHERE creado_por = $1
     GROUP BY estado`,
    [creadoPor],
  );

  const conteo: Record<EstadoFicha, number> = {
    borrador: 0,
    auditada: 0,
    medida: 0,
  };

  for (const fila of filas) conteo[fila.estado] = Number(fila.total);

  return conteo;
}

export type DatosFicha = {
  empresaId: number;
  objetivo: string;
  plataforma: string;
  audiencia: string | null;
  tension: string | null;
  verdadMarca: string | null;
  prueba: string | null;
  hablado: string;
  insertTitulo: string | null;
  primerFotograma: string | null;
  pagoPromesa: string | null;
  cta: string | null;
  riesgoClaim: string | null;
  metricaPrincipal: string | null;
};

const CAMPOS_FICHA = [
  "empresa_id",
  "objetivo",
  "plataforma",
  "audiencia",
  "tension",
  "verdad_marca",
  "prueba",
  "hablado",
  "insert_titulo",
  "primer_fotograma",
  "pago_promesa",
  "cta",
  "riesgo_claim",
  "metrica_principal",
] as const;

function valoresDe(datos: DatosFicha): unknown[] {
  return [
    datos.empresaId,
    datos.objetivo,
    datos.plataforma,
    datos.audiencia,
    datos.tension,
    datos.verdadMarca,
    datos.prueba,
    datos.hablado,
    datos.insertTitulo,
    datos.primerFotograma,
    datos.pagoPromesa,
    datos.cta,
    datos.riesgoClaim,
    datos.metricaPrincipal,
  ];
}

export async function crear(
  datos: DatosFicha,
  creadoPor: number,
  ejecutor?: Ejecutor,
): Promise<FichaHook> {
  const valores = [...valoresDe(datos), creadoPor];
  const marcadores = valores.map((_, i) => `$${i + 1}`).join(", ");

  const creada = await consultarUno<{ id: number }>(
    `INSERT INTO fichas_hook (${CAMPOS_FICHA.join(", ")}, creado_por)
     VALUES (${marcadores})
     RETURNING id`,
    valores,
    ejecutor,
  );

  if (!creada) throw new Error("La insercion de la ficha no devolvio ninguna fila");

  const ficha = await buscarPorId(creada.id, ejecutor);
  if (!ficha) throw new Error("No se pudo releer la ficha recien creada");

  return ficha;
}

export async function actualizar(
  id: number,
  datos: DatosFicha,
): Promise<FichaHook | null> {
  const valores = [id, ...valoresDe(datos)];
  const asignaciones = CAMPOS_FICHA.map((campo, i) => `${campo} = $${i + 2}`).join(", ");

  const afectadas = await ejecutar(
    `UPDATE fichas_hook SET ${asignaciones} WHERE id = $1`,
    valores,
  );

  return afectadas === 1 ? buscarPorId(id) : null;
}

/**
 * Guarda la nota del auditor y sube el estado a "auditada".
 *
 * No baja nunca de "medida": una pieza ya terminada que se vuelve a auditar
 * conserva su estado, o desapareceria del recuento de terminadas.
 */
export async function guardarNota(
  id: number,
  nota: number,
): Promise<boolean> {
  const afectadas = await ejecutar(
    `UPDATE fichas_hook
     SET nota_auditor = $2,
         estado = CASE WHEN estado = 'medida' THEN 'medida' ELSE 'auditada' END
     WHERE id = $1`,
    [id, nota],
  );

  return afectadas === 1;
}

/**
 * Liga la ficha a la tarea que cumple. Solo si aun no tiene otra: una ficha
 * nacida para una tarea no se cambia de tarea por abrirla desde otra.
 */
export async function vincularTarea(id: number, tareaId: number): Promise<boolean> {
  const afectadas = await ejecutar(
    "UPDATE fichas_hook SET tarea_id = $2 WHERE id = $1 AND tarea_id IS NULL",
    [id, tareaId],
  );

  return afectadas === 1;
}

/** La ultima ficha escrita para una tarea, para seguir donde se dejo. */
export async function ultimaDeTarea(tareaId: number): Promise<FichaHook | null> {
  return consultarUno<FichaHook>(
    `SELECT ${COLUMNAS} ${DESDE}
     WHERE f.tarea_id = $1
     ORDER BY f.actualizado_en DESC, f.id DESC
     LIMIT 1`,
    [tareaId],
  );
}

/**
 * Borra una ficha. Sus resultados caen con ella por la llave foranea.
 *
 * Devuelve si la ficha estaba medida, para que quien llama pueda decir en el
 * mensaje que se fue tambien el aprendizaje de esa cuenta.
 */
export async function borrar(
  id: number,
): Promise<{ borrada: boolean; estado: EstadoFicha | null }> {
  const fila = await consultarUno<{ estado: EstadoFicha }>(
    "DELETE FROM fichas_hook WHERE id = $1 RETURNING estado",
    [id],
  );

  /*
   * Devuelve el ESTADO, no un booleano.
   *
   * Antes devolvia `estabaMedida`, y ahi se perdia informacion que el DELETE
   * ya traia: los estados son tres y quien llamaba solo podia distinguir dos.
   * El resultado era que borrar una ficha auditada avisaba «Borrador borrado.»
   */
  return { borrada: fila !== null, estado: fila?.estado ?? null };
}
