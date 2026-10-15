import { consultar, consultarUno, ejecutar, type Ejecutor } from "@/lib/db";
import type {
  AclaracionBrief,
  Brief,
  EstadoBrief,
  RespuestaCongelada,
  Respuestas,
  VersionBrief,
} from "@/types";

/**
 * Consultas sobre portal.briefs y sus tablas.
 *
 * El ejecutor es obligatorio y sale de `conSesion` (o de `conEnlace`, para un
 * prospecto): quien ve que brief lo deciden las politicas. Llenar, abrir una
 * version y enviar pasan por las funciones de la base, que comprueban quien
 * pregunta; decidir (aceptar, descartar, presupuesto) es un UPDATE que solo
 * deja pasar a quien gestiona el brief.
 */

const COLUMNAS = `
  b.id,
  b.codigo,
  b.formato,
  b.formato_version                          AS "formatoVersion",
  b.estado,
  b.empresa_id                               AS "empresaId",
  e.nombre                                   AS "empresaNombre",
  b.prospecto_id                             AS "prospectoId",
  pr.empresa_nombre                          AS "prospectoNombre",
  coalesce(e.nombre, pr.empresa_nombre)      AS solicitante,
  b.version_actual                           AS "versionActual",
  b.borrador_abierto                         AS "borradorAbierto",
  b.fecha_aspirada::text                     AS "fechaAspirada",
  b.fecha_propuesta::text                    AS "fechaPropuesta",
  b.motivo_fecha_propuesta                   AS "motivoFechaPropuesta",
  b.motivo_descarte                          AS "motivoDescarte",
  b.enviado_en                               AS "enviadoEn",
  b.creado_en                                AS "creadoEn",
  b.actualizado_en                           AS "actualizadoEn",
  b.proyecto_id                              AS "proyectoId",
  p.id                                       AS "presupuestoId",
  p.estado                                   AS "presupuestoEstado",
  coalesce(p.estado = 'enviado' AND p.valido_hasta < finanzas.hoy(), false) AS "presupuestoVencido"
`;

const DESDE = `
  FROM portal.briefs b
  LEFT JOIN empresas e ON e.id = b.empresa_id
  LEFT JOIN portal.prospectos pr ON pr.id = b.prospecto_id
  LEFT JOIN LATERAL (
    SELECT x.id, x.estado, x.valido_hasta, x.creado_en FROM finanzas.presupuestos x
    WHERE x.brief_id = b.id ORDER BY x.id DESC LIMIT 1
  ) p ON true
`;

/** Un brief, o null si no existe para quien pregunta. */
export async function buscarPorId(id: number, ejecutor: Ejecutor): Promise<Brief | null> {
  return consultarUno<Brief>(`SELECT ${COLUMNAS} ${DESDE} WHERE b.id = $1`, [id], ejecutor);
}

/**
 * Los briefs que ve quien pregunta. La bandeja pide los enviados; el cliente,
 * todos los de su empresa, borradores incluidos.
 */
export async function listar(
  filtros: { estados?: EstadoBrief[]; sinBorradores?: boolean },
  ejecutor: Ejecutor,
): Promise<Brief[]> {
  const condiciones: string[] = [];
  const valores: unknown[] = [];

  if (filtros.estados?.length) {
    valores.push(filtros.estados);
    condiciones.push(`b.estado = ANY($${valores.length})`);
  }
  if (filtros.sinBorradores) condiciones.push("b.estado <> 'borrador'");

  const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  return consultar<Brief>(
    `SELECT ${COLUMNAS} ${DESDE} ${donde}
     ORDER BY coalesce(b.enviado_en, b.actualizado_en) DESC, b.id DESC
     LIMIT 200`,
    valores,
    ejecutor,
  );
}

/**
 * Los briefs que esperan su presupuesto: pasados a presupuesto y sin uno
 * hecho despues de esa decision. Si el anterior se rechazo y el ejecutivo lo
 * vuelve a pasar a presupuesto (S-09), reaparece. Lo que ve administracion.
 */
export async function esperandoPresupuesto(ejecutor: Ejecutor): Promise<Brief[]> {
  return consultar<Brief>(
    `SELECT ${COLUMNAS} ${DESDE}
     WHERE b.estado = 'en_presupuesto' AND (p.id IS NULL OR p.creado_en < b.resuelto_en)
     ORDER BY b.resuelto_en, b.id`,
    [],
    ejecutor,
  );
}

/** Lo que se va escribiendo: respuestas, fecha aspirada y quien lleno cada paso. */
export async function borradorDe(
  id: number,
  ejecutor: Ejecutor,
): Promise<{ respuestas: Respuestas; fechaAspirada: string | null; autores: Record<string, string> } | null> {
  return consultarUno(
    `SELECT borrador AS respuestas,
            fecha_aspirada_borrador::text AS "fechaAspirada",
            autores
     FROM portal.briefs WHERE id = $1`,
    [id],
    ejecutor,
  );
}

/** Abre un borrador nuevo. Devuelve su id. */
export async function crear(
  datos: {
    formato: string;
    formatoVersion: number;
    empresaId: number | null;
    prospectoId: number | null;
    enlaceId: number | null;
    creadoPor: number | null;
    respuestas: Respuestas;
  },
  ejecutor: Ejecutor,
): Promise<number> {
  const fila = await consultarUno<{ id: number }>(
    `INSERT INTO portal.briefs
       (formato, formato_version, empresa_id, prospecto_id, enlace_id, creado_por, borrador)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     RETURNING id`,
    [
      datos.formato,
      datos.formatoVersion,
      datos.empresaId,
      datos.prospectoId,
      datos.enlaceId,
      datos.creadoPor,
      JSON.stringify(datos.respuestas),
    ],
    ejecutor,
  );

  if (!fila) throw new Error("No se pudo crear el brief");
  return fila.id;
}

/** Guarda el borrador abierto. */
export async function guardarBorrador(
  id: number,
  datos: { respuestas: Respuestas; fechaAspirada: string | null; autores: Record<string, string> },
  ejecutor: Ejecutor,
): Promise<void> {
  await ejecutar(
    "SELECT portal.guardar_borrador_brief($1, $2::jsonb, $3::date, $4::jsonb)",
    [id, JSON.stringify(datos.respuestas), datos.fechaAspirada, JSON.stringify(datos.autores)],
    ejecutor,
  );
}

/** Abre una version nueva con lo ultimo enviado (S-08). */
export async function abrirVersion(id: number, ejecutor: Ejecutor): Promise<void> {
  await ejecutar("SELECT portal.abrir_version_brief($1)", [id], ejecutor);
}

/** Envia el borrador. Devuelve el codigo y el numero de version. */
export async function enviar(
  id: number,
  datos: {
    contenido: RespuestaCongelada[];
    sha256: string;
    respuestas: Respuestas;
    fechaAspirada: string;
    nombre: string;
  },
  ejecutor: Ejecutor,
): Promise<{ codigo: string; numero: number }> {
  const fila = await consultarUno<{ codigo: string; numero: number }>(
    "SELECT codigo, numero FROM portal.enviar_brief($1, $2::jsonb, $3, $4::jsonb, $5::date, $6)",
    [
      id,
      JSON.stringify(datos.contenido),
      datos.sha256,
      JSON.stringify(datos.respuestas),
      datos.fechaAspirada,
      datos.nombre,
    ],
    ejecutor,
  );

  if (!fila) throw new Error("No se pudo enviar el brief");
  return fila;
}

/** Las versiones enviadas, de la primera a la ultima. */
export async function versionesDe(id: number, ejecutor: Ejecutor): Promise<VersionBrief[]> {
  return consultar<VersionBrief>(
    `SELECT numero,
            contenido,
            contenido_sha256    AS "contenidoSha256",
            fecha_aspirada::text AS "fechaAspirada",
            enviado_en          AS "enviadoEn",
            enviado_por_nombre  AS "enviadoPorNombre"
     FROM portal.brief_versiones
     WHERE brief_id = $1
     ORDER BY numero`,
    [id],
    ejecutor,
  );
}

/** El hilo de aclaraciones, en orden. */
export async function aclaracionesDe(id: number, ejecutor: Ejecutor): Promise<AclaracionBrief[]> {
  return consultar<AclaracionBrief>(
    `SELECT id, autor_nombre AS "autorNombre", del_equipo AS "delEquipo", texto, creado_en AS "creadoEn"
     FROM portal.brief_aclaraciones
     WHERE brief_id = $1
     ORDER BY creado_en, id`,
    [id],
    ejecutor,
  );
}

/** Escribe en el hilo. `autorId` nulo es un prospecto. */
export async function aclarar(
  id: number,
  datos: { autorId: number | null; autorNombre: string; delEquipo: boolean; texto: string },
  ejecutor: Ejecutor,
): Promise<void> {
  await ejecutar(
    `INSERT INTO portal.brief_aclaraciones (brief_id, autor_id, autor_nombre, del_equipo, texto)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, datos.autorId, datos.autorNombre, datos.delEquipo, datos.texto],
    ejecutor,
  );
}

/**
 * Las decisiones de quien gestiona el brief. Cada una exige el estado del que
 * parte: devuelven false si el brief ya no estaba ahi.
 */
export async function aceptar(
  id: number,
  proyectoId: number,
  usuarioId: number,
  ejecutor: Ejecutor,
): Promise<boolean> {
  const filas = await ejecutar(
    `UPDATE portal.briefs
     SET estado = 'en_validacion', proyecto_id = $2, resuelto_por = $3, resuelto_en = now()
     WHERE id = $1 AND estado IN ('enviado', 'en_presupuesto') AND proyecto_id IS NULL`,
    [id, proyectoId, usuarioId],
    ejecutor,
  );
  return filas === 1;
}

export async function aPresupuesto(id: number, usuarioId: number, ejecutor: Ejecutor): Promise<boolean> {
  const filas = await ejecutar(
    `UPDATE portal.briefs SET estado = 'en_presupuesto', resuelto_por = $2, resuelto_en = now()
     WHERE id = $1 AND estado IN ('enviado', 'en_presupuesto')`,
    [id, usuarioId],
    ejecutor,
  );
  return filas === 1;
}

export async function descartar(
  id: number,
  motivo: string,
  usuarioId: number,
  ejecutor: Ejecutor,
): Promise<boolean> {
  const filas = await ejecutar(
    `UPDATE portal.briefs
     SET estado = 'descartado', motivo_descarte = $2, resuelto_por = $3, resuelto_en = now(),
         borrador_abierto = FALSE
     WHERE id = $1 AND estado IN ('enviado', 'en_presupuesto')`,
    [id, motivo, usuarioId],
    ejecutor,
  );
  return filas === 1;
}

/** El brief queda validado: la fase 1 de su proyecto se completo. */
export async function validar(id: number, ejecutor: Ejecutor): Promise<boolean> {
  const filas = await ejecutar(
    `UPDATE portal.briefs SET estado = 'aceptado', borrador_abierto = FALSE
     WHERE id = $1 AND estado = 'en_validacion'`,
    [id],
    ejecutor,
  );
  return filas === 1;
}

/** Propone otra fecha de entrega, con su motivo; o la retira (null). */
export async function proponerFecha(
  id: number,
  fecha: string | null,
  motivo: string | null,
  ejecutor: Ejecutor,
): Promise<boolean> {
  const filas = await ejecutar(
    `UPDATE portal.briefs SET fecha_propuesta = $2, motivo_fecha_propuesta = $3
     WHERE id = $1 AND estado IN ('enviado', 'en_validacion', 'en_presupuesto')`,
    [id, fecha, fecha ? motivo : null],
    ejecutor,
  );
  return filas === 1;
}

/** Convierte al prospecto: nace su empresa. Devuelve su id. */
export async function convertirProspecto(id: number, ejecutor: Ejecutor): Promise<number> {
  const fila = await consultarUno<{ empresa: number }>(
    "SELECT portal.convertir_prospecto($1) AS empresa",
    [id],
    ejecutor,
  );
  if (!fila) throw new Error("No se pudo convertir al prospecto");
  return fila.empresa;
}

/** Liga un proyecto al brief del que nace. */
export async function ligarProyecto(proyectoId: number, briefId: number, ejecutor: Ejecutor): Promise<void> {
  await ejecutar("UPDATE portal.proyectos SET brief_id = $2 WHERE id = $1", [proyectoId, briefId], ejecutor);
}

/** El prospecto de un brief, para convertirlo en cliente. */
export async function prospectoDe(
  id: number,
  ejecutor: Ejecutor,
): Promise<{ id: number; empresaNombre: string; contactoNombre: string; email: string; telefono: string | null } | null> {
  return consultarUno(
    `SELECT p.id, p.empresa_nombre AS "empresaNombre", p.contacto_nombre AS "contactoNombre",
            p.email, p.telefono
     FROM portal.briefs b JOIN portal.prospectos p ON p.id = b.prospecto_id
     WHERE b.id = $1`,
    [id],
    ejecutor,
  );
}

/** El enlace de un brief de prospecto, si lo tiene. */
export async function enlaceDe(id: number, ejecutor: Ejecutor): Promise<number | null> {
  const fila = await consultarUno<{ enlace: number | null }>(
    "SELECT enlace_id AS enlace FROM portal.briefs WHERE id = $1",
    [id],
    ejecutor,
  );
  return fila?.enlace ?? null;
}

/** El brief de un enlace de prospecto, si ya se empezo. */
export async function deEnlace(enlaceId: number, ejecutor: Ejecutor): Promise<number | null> {
  const fila = await consultarUno<{ id: number }>(
    "SELECT id FROM portal.briefs WHERE enlace_id = $1",
    [enlaceId],
    ejecutor,
  );
  return fila?.id ?? null;
}

/** El brief del que nacio un proyecto, si lo hay. */
export async function deProyecto(proyectoId: number, ejecutor: Ejecutor): Promise<number | null> {
  const fila = await consultarUno<{ id: number }>(
    "SELECT id FROM portal.briefs WHERE proyecto_id = $1",
    [proyectoId],
    ejecutor,
  );
  return fila?.id ?? null;
}

/** Quien atiende un brief: a quienes se avisa. */
export async function atienden(
  id: number,
  ejecutor: Ejecutor,
): Promise<{ id: number; nombre: string; email: string }[]> {
  return consultar("SELECT id, nombre, email FROM portal.atienden_brief($1)", [id], ejecutor);
}
