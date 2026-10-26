import {
  consultar,
  consultarUno,
  ejecutar,
  escaparLike,
  identificadorSeguro,
  type Ejecutor,
} from "@/lib/db";
import type {
  DatosNuevoProyecto,
  EjecutivoPosible,
  EstadoProyecto,
  FiltrosProyectos,
  NombreEmpresa,
  NumeroFase,
  Pagina,
  PersonaBreve,
  Proyecto,
} from "@/types";

/**
 * Consultas sobre portal.proyectos.
 *
 * El ejecutor es obligatorio y sale de `conSesion`: que proyectos existen
 * para quien pregunta lo deciden las politicas de la base. El admin los ve
 * todos; un ejecutivo, los de sus empresas; quien hace una tarea, los de las
 * piezas donde trabaja; un cliente, los de su empresa.
 *
 * El avance y las alertas no se guardan: salen de las vistas
 * `portal.v_progreso_proyecto` y `portal.v_progreso_pieza`.
 */

const COLUMNAS = `
  p.id,
  p.empresa_id                           AS "empresaId",
  e.nombre                               AS "empresaNombre",
  p.ejecutivo_id                         AS "ejecutivoId",
  u.nombre || ' ' || u.apellido          AS "ejecutivoNombre",
  p.servicio,
  p.tipo,
  p.nombre,
  p.descripcion,
  p.estado,
  p.fecha_inicio::text                   AS "fechaInicio",
  p.fecha_estimada_cierre::text          AS "fechaEstimadaCierre",
  p.creado_en                            AS "creadoEn",
  COALESCE(v.total_piezas, 0)            AS "totalPiezas",
  COALESCE(v.fases_completadas, 0)       AS "fasesCompletadas",
  COALESCE(v.porcentaje, 0)::float8      AS porcentaje,
  COALESCE(v.piezas_aprobadas, 0)        AS "piezasAprobadas",
  COALESCE(a.por_vencer, 0)              AS "porVencer",
  COALESCE(a.atrasada, 0)                AS atrasada,
  COALESCE(a.esperando_cliente, 0)       AS "esperandoCliente",
  COALESCE(a.en_correccion, 0)           AS "enCorreccion"
`;

const DESDE = `
  FROM portal.proyectos p
  JOIN empresas e ON e.id = p.empresa_id
  JOIN usuarios u ON u.id = p.ejecutivo_id
  LEFT JOIN portal.v_progreso_proyecto v ON v.proyecto_id = p.id
  LEFT JOIN LATERAL (
    SELECT count(*) FILTER (WHERE pp.por_vencer)::int        AS por_vencer,
           count(*) FILTER (WHERE pp.atrasada)::int          AS atrasada,
           count(*) FILTER (WHERE pp.esperando_cliente)::int AS esperando_cliente,
           count(*) FILTER (WHERE pp.en_correccion)::int     AS en_correccion
    FROM portal.v_progreso_pieza pp
    WHERE pp.proyecto_id = p.id
  ) a ON true
`;

type FilaProyecto = Omit<Proyecto, "avance" | "alertas"> & {
  totalPiezas: number;
  fasesCompletadas: number;
  porcentaje: number;
  piezasAprobadas: number;
  porVencer: number;
  atrasada: number;
  esperandoCliente: number;
  enCorreccion: number;
};

function comoProyecto(fila: FilaProyecto): Proyecto {
  const {
    totalPiezas,
    fasesCompletadas,
    porcentaje,
    piezasAprobadas,
    porVencer,
    atrasada,
    esperandoCliente,
    enCorreccion,
    ...resto
  } = fila;

  return {
    ...resto,
    avance: { totalPiezas, fasesCompletadas, porcentaje, piezasAprobadas },
    alertas: {
      por_vencer: porVencer,
      atrasada,
      esperando_cliente: esperandoCliente,
      en_correccion: enCorreccion,
    },
  };
}

const COLUMNAS_ORDEN = {
  creadoEn: "p.creado_en",
  nombre: "lower(p.nombre)",
  cierre: "p.fecha_estimada_cierre",
} as const;

/** El listado, paginado y con filtros. */
export async function listar(
  filtros: FiltrosProyectos & { orden?: keyof typeof COLUMNAS_ORDEN },
  ejecutor: Ejecutor,
): Promise<Pagina<Proyecto>> {
  const pagina = Math.max(1, Math.trunc(filtros.pagina ?? 1));
  const porPagina = Math.min(100, Math.max(1, Math.trunc(filtros.porPagina ?? 20)));

  const condiciones: string[] = [];
  const valores: unknown[] = [];

  if (filtros.busqueda?.trim()) {
    valores.push(`%${escaparLike(filtros.busqueda.trim())}%`);
    const marcador = `$${valores.length}`;
    condiciones.push(
      `(p.nombre ILIKE ${marcador} ESCAPE '\\' OR e.nombre ILIKE ${marcador} ESCAPE '\\')`,
    );
  }

  if (filtros.estado?.length) {
    valores.push(filtros.estado);
    condiciones.push(`p.estado = ANY($${valores.length})`);
  }

  if (filtros.empresaId?.length) {
    valores.push(filtros.empresaId);
    condiciones.push(`p.empresa_id = ANY($${valores.length})`);
  }

  if (filtros.ejecutivoId?.length) {
    valores.push(filtros.ejecutivoId);
    condiciones.push(`p.ejecutivo_id = ANY($${valores.length})`);
  }

  if (filtros.tipo?.length) {
    valores.push(filtros.tipo);
    condiciones.push(`p.tipo = ANY($${valores.length})`);
  }

  const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  const claveOrden = identificadorSeguro(
    filtros.orden ?? "creadoEn",
    Object.keys(COLUMNAS_ORDEN) as (keyof typeof COLUMNAS_ORDEN)[],
  );
  const direccion = identificadorSeguro(filtros.direccion ?? "desc", ["asc", "desc"]);

  const totales = await consultarUno<{ total: string }>(
    `SELECT count(*)::text AS total
     FROM portal.proyectos p
     JOIN empresas e ON e.id = p.empresa_id
     ${donde}`,
    valores,
    ejecutor,
  );

  const total = Number(totales?.total ?? 0);

  valores.push(porPagina, (pagina - 1) * porPagina);

  const filas = await consultar<FilaProyecto>(
    `SELECT ${COLUMNAS} ${DESDE}
     ${donde}
     ORDER BY ${COLUMNAS_ORDEN[claveOrden]} ${direccion.toUpperCase()} NULLS LAST, p.id DESC
     LIMIT $${valores.length - 1} OFFSET $${valores.length}`,
    valores,
    ejecutor,
  );

  return {
    filas: filas.map(comoProyecto),
    total,
    pagina,
    porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
  };
}

/** Los proyectos en curso (activos o pausados), sin paginar: el tablero. */
export async function enCurso(ejecutor: Ejecutor): Promise<Proyecto[]> {
  const filas = await consultar<FilaProyecto>(
    `SELECT ${COLUMNAS} ${DESDE}
     WHERE p.estado IN ('activo', 'pausado')
     ORDER BY lower(e.nombre), p.creado_en DESC`,
    [],
    ejecutor,
  );

  return filas.map(comoProyecto);
}

/** Cuantos proyectos activos o pausados lleva una persona como ejecutivo. */
export async function contarEnCursoDe(
  ejecutivoId: number,
  ejecutor: Ejecutor,
): Promise<number> {
  const fila = await consultarUno<{ total: number }>(
    `SELECT count(*)::int AS total
     FROM portal.proyectos
     WHERE ejecutivo_id = $1 AND estado IN ('activo', 'pausado')`,
    [ejecutivoId],
    ejecutor,
  );

  return fila?.total ?? 0;
}

/**
 * En que fase va cada proyecto: la mas atrasada de sus piezas activas sin
 * aprobar, y cuantas piezas hay en ella. Es lo que dice el tablero en
 * «Fase actual». Un proyecto con todo aprobado no aparece.
 */
export async function fasesMasAtrasadas(
  ejecutor: Ejecutor,
): Promise<Map<number, { fase: NumeroFase; piezas: number }>> {
  const filas = await consultar<{ proyectoId: number; fase: NumeroFase; piezas: number }>(
    `SELECT proyecto_id AS "proyectoId", fase, count(*)::int AS piezas
     FROM (
       SELECT proyecto_id,
              fase_actual AS fase,
              min(fase_actual) OVER (PARTITION BY proyecto_id) AS minima
       FROM portal.v_progreso_pieza
       WHERE estado = 'activa' AND fase_actual IS NOT NULL
     ) actuales
     WHERE fase = minima
     GROUP BY proyecto_id, fase`,
    [],
    ejecutor,
  );

  return new Map(filas.map(({ proyectoId, ...resto }) => [proyectoId, resto]));
}

/** Un proyecto, si quien pregunta lo puede ver. */
export async function buscarPorId(
  id: number,
  ejecutor: Ejecutor,
): Promise<Proyecto | null> {
  const fila = await consultarUno<FilaProyecto>(
    `SELECT ${COLUMNAS} ${DESDE} WHERE p.id = $1`,
    [id],
    ejecutor,
  );

  return fila ? comoProyecto(fila) : null;
}

/**
 * Si quien pregunta gestiona el proyecto: lo crea, lo mueve y asigna. La
 * respuesta es la de la base, la misma que aplican sus politicas: quien
 * gestiona la empresa, o el ejecutivo que lo lleva aunque sea de otra cuenta.
 */
export async function gestiona(id: number, ejecutor: Ejecutor): Promise<boolean> {
  const fila = await consultarUno<{ gestiona: boolean }>(
    `SELECT portal.gestiona_proyecto(id) AS gestiona
     FROM portal.proyectos WHERE id = $1`,
    [id],
    ejecutor,
  );

  return fila?.gestiona ?? false;
}

/** Crea el proyecto y devuelve su id. Las piezas se crean aparte. */
export async function crear(
  datos: DatosNuevoProyecto,
  creadoPor: number,
  ejecutor: Ejecutor,
): Promise<number> {
  const fila = await consultarUno<{ id: number }>(
    `INSERT INTO portal.proyectos
       (empresa_id, ejecutivo_id, servicio, tipo, nombre, descripcion,
        fecha_inicio, fecha_estimada_cierre, creado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8::date, $9)
     RETURNING id`,
    [
      datos.empresaId,
      datos.ejecutivoId,
      datos.servicio,
      datos.tipo,
      datos.nombre,
      datos.descripcion ?? null,
      datos.fechaInicio ?? null,
      datos.fechaEstimadaCierre ?? null,
      creadoPor,
    ],
    ejecutor,
  );

  if (!fila) throw new Error("No se pudo crear el proyecto");

  return fila.id;
}

/** Lo que se puede editar de un proyecto despues de crearlo. */
export type CambiosProyecto = {
  nombre: string;
  descripcion: string | null;
  ejecutivoId: number;
  fechaInicio: string | null;
  fechaEstimadaCierre: string | null;
};

export async function actualizar(
  id: number,
  cambios: CambiosProyecto,
  ejecutor: Ejecutor,
): Promise<boolean> {
  const filas = await ejecutar(
    `UPDATE portal.proyectos
     SET nombre = $2,
         descripcion = $3,
         ejecutivo_id = $4,
         fecha_inicio = $5::date,
         fecha_estimada_cierre = $6::date
     WHERE id = $1`,
    [
      id,
      cambios.nombre,
      cambios.descripcion,
      cambios.ejecutivoId,
      cambios.fechaInicio,
      cambios.fechaEstimadaCierre,
    ],
    ejecutor,
  );

  return filas > 0;
}

/** Cambia el estado. `cerrado_en` acompana al cierre, como exige la base. */
export async function cambiarEstado(
  id: number,
  estado: EstadoProyecto,
  ejecutor: Ejecutor,
): Promise<boolean> {
  const filas = await ejecutar(
    `UPDATE portal.proyectos
     SET estado = $2,
         cerrado_en = CASE WHEN $2 = 'cerrado' THEN now() ELSE NULL END
     WHERE id = $1`,
    [id, estado],
    ejecutor,
  );

  return filas > 0;
}

/**
 * Las empresas activas en las que quien pregunta puede abrir proyectos: todas
 * para el admin, las asignadas para un ejecutivo.
 */
export async function empresasGestionables(ejecutor: Ejecutor): Promise<NombreEmpresa[]> {
  return consultar<NombreEmpresa>(
    `SELECT id, nombre
     FROM empresas
     WHERE activo AND portal.gestiona_empresa(id)
     ORDER BY lower(nombre)`,
    [],
    ejecutor,
  );
}

/**
 * Quien puede llevar un proyecto de una empresa: los ejecutivos de cuentas
 * activos. Primero los asignados a ella; despues los de otra cuenta, que solo
 * puede elegir un administrador (la excepcion por proyecto). Un administrador
 * no lleva proyectos.
 */
export async function ejecutivosPosibles(
  empresaId: number,
  ejecutor: Ejecutor,
): Promise<EjecutivoPosible[]> {
  return consultar<EjecutivoPosible>(
    `SELECT v.id,
            v.nombre || ' ' || v.apellido AS nombre,
            NOT EXISTS (
              SELECT 1 FROM portal.asignaciones a
              WHERE a.usuario_id = v.id AND a.empresa_id = $1
            ) AS "deOtraCuenta"
     FROM vw_usuarios_completos v
     WHERE v.activo AND v.cargo_slug = 'cuentas'
     ORDER BY "deOtraCuenta", lower(v.nombre), lower(v.apellido)`,
    [empresaId],
    ejecutor,
  );
}

/** Todos los ejecutivos de cuentas activos: el alta del administrador los ofrece. */
export async function ejecutivosDeCuentas(ejecutor: Ejecutor): Promise<PersonaBreve[]> {
  return consultar<PersonaBreve>(
    `SELECT v.id, v.nombre || ' ' || v.apellido AS nombre
     FROM vw_usuarios_completos v
     WHERE v.activo AND v.cargo_slug = 'cuentas'
     ORDER BY lower(v.nombre), lower(v.apellido)`,
    [],
    ejecutor,
  );
}
