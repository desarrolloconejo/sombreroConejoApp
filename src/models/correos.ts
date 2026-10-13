import {
  consultar,
  consultarUno,
  ejecutar,
  escaparLike,
  identificadorSeguro,
  type Ejecutor,
} from "@/lib/db";
import type {
  CorreoSalida,
  EstadoCorreo,
  FiltrosCorreos,
  ModoExterno,
  NuevoCorreo,
  Pagina,
} from "@/types";

/**
 * Consultas sobre portal.correos_salida.
 *
 * El ejecutor es OBLIGATORIO en todas: la tabla tiene seguridad por fila, y
 * sin la conexion de `conSesion` —la que declara quien hace la peticion— no
 * devuelve ni acepta nada. Un ejecutor por defecto haria que un olvido se
 * manifestara como «la bandeja esta vacia», que es mucho peor que un error de
 * tipos.
 */

const COLUMNAS = `
  c.id,
  c.para,
  CASE WHEN d.id IS NULL THEN NULL ELSE d.nombre || ' ' || d.apellido END
                 AS "paraNombre",
  e.nombre       AS "empresaNombre",
  c.tipo,
  c.asunto,
  c.cuerpo,
  c.modo,
  c.estado,
  c.error,
  c.intentos,
  CASE WHEN a.id IS NULL THEN NULL ELSE a.nombre || ' ' || a.apellido END
                 AS "creadoPorNombre",
  c.creado_en    AS "creadoEn",
  c.enviado_en   AS "enviadoEn",
  CASE WHEN m.id IS NULL THEN NULL ELSE m.nombre || ' ' || m.apellido END
                 AS "entregadoPorNombre",
  c.entregado_en AS "entregadoEn"
`;

const DESDE = `
  FROM portal.correos_salida c
  LEFT JOIN usuarios d ON d.id = c.para_usuario_id
  LEFT JOIN usuarios a ON a.id = c.creado_por
  LEFT JOIN usuarios m ON m.id = c.entregado_por
  LEFT JOIN empresas e ON e.id = c.empresa_id
`;

/** BIGSERIAL llega como texto; aqui se maneja como numero. */
function comoCorreo(fila: Omit<CorreoSalida, "id"> & { id: string }): CorreoSalida {
  return { ...fila, id: Number(fila.id) };
}

/**
 * Escribe un correo en la bandeja de salida y devuelve su identificador.
 *
 * No devuelve la fila con RETURNING a proposito: quien provoca un correo no
 * siempre puede leer la bandeja, y la politica de lectura rechazaria la
 * sentencia entera. El identificador sale de la secuencia.
 */
export async function registrar(
  correo: NuevoCorreo,
  datos: { modo: ModoExterno; estado: EstadoCorreo; creadoPor: number },
  ejecutor: Ejecutor,
): Promise<number> {
  const fila = await consultarUno<{ id: string }>(
    "SELECT nextval('portal.correos_salida_id_seq')::text AS id",
    [],
    ejecutor,
  );

  if (!fila) throw new Error("No se pudo reservar el identificador del correo");

  await ejecutar(
    `INSERT INTO portal.correos_salida (
       id, para, para_usuario_id, empresa_id, tipo, asunto, cuerpo,
       modo, estado, creado_por
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      fila.id,
      correo.para,
      correo.paraUsuarioId ?? null,
      correo.empresaId ?? null,
      correo.tipo,
      correo.asunto,
      correo.cuerpo,
      datos.modo,
      datos.estado,
      datos.creadoPor,
    ],
    ejecutor,
  );

  return Number(fila.id);
}

/** Lo minimo que hace falta para entregar un correo. */
export async function paraEntregar(
  id: number,
  ejecutor: Ejecutor,
): Promise<{ id: number; para: string; asunto: string; cuerpo: string; estado: EstadoCorreo } | null> {
  const fila = await consultarUno<{
    id: string;
    para: string;
    asunto: string;
    cuerpo: string;
    estado: EstadoCorreo;
  }>(
    `SELECT id, para, asunto, cuerpo, estado
     FROM portal.correos_salida WHERE id = $1`,
    [id],
    ejecutor,
  );

  return fila ? { ...fila, id: Number(fila.id) } : null;
}

/** Apunta como acabo un intento de entrega. */
export async function anotarEntrega(
  id: number,
  resultado: { enviado: true; idExterno: string } | { enviado: false; error: string },
  ejecutor: Ejecutor,
): Promise<void> {
  if (resultado.enviado) {
    await ejecutar(
      `UPDATE portal.correos_salida
       SET estado = 'enviado', id_externo = $2, error = NULL,
           enviado_en = now(), intentos = intentos + 1
       WHERE id = $1`,
      [id, resultado.idExterno],
      ejecutor,
    );
    return;
  }

  await ejecutar(
    `UPDATE portal.correos_salida
     SET estado = 'fallido', error = $2, intentos = intentos + 1
     WHERE id = $1`,
    // Lo que diga el servicio se recorta: un error puede traer una respuesta
    // entera, y aqui solo hace falta saber que paso.
    [id, resultado.error.slice(0, 500)],
    ejecutor,
  );
}

/**
 * Marca un correo simulado como entregado a mano. Devuelve si cambio algo:
 * no lo hace si ya estaba entregado o si no es un correo simulado.
 */
export async function marcarEntregado(
  id: number,
  quien: number,
  ejecutor: Ejecutor,
): Promise<boolean> {
  const afectadas = await ejecutar(
    `UPDATE portal.correos_salida
     SET entregado_por = $2, entregado_en = now()
     WHERE id = $1 AND estado = 'simulado' AND entregado_en IS NULL`,
    [id, quien],
    ejecutor,
  );

  return afectadas === 1;
}

/** Un correo concreto, para el panel de detalle. */
export async function buscarPorId(
  id: number,
  ejecutor: Ejecutor,
): Promise<CorreoSalida | null> {
  const fila = await consultarUno<Parameters<typeof comoCorreo>[0]>(
    `SELECT ${COLUMNAS} ${DESDE} WHERE c.id = $1`,
    [id],
    ejecutor,
  );

  return fila ? comoCorreo(fila) : null;
}

/** Cuantos correos simulados siguen sin entregarse a mano. */
export async function contarPorEntregar(ejecutor: Ejecutor): Promise<number> {
  const fila = await consultarUno<{ total: string }>(
    `SELECT count(*)::text AS total
     FROM portal.correos_salida
     WHERE estado = 'simulado' AND entregado_en IS NULL`,
    [],
    ejecutor,
  );

  return Number(fila?.total ?? 0);
}

/** Listado paginado, lo mas reciente primero salvo que se pida al reves. */
export async function listar(
  filtros: FiltrosCorreos,
  ejecutor: Ejecutor,
): Promise<Pagina<CorreoSalida>> {
  const pagina = Math.max(1, Math.trunc(filtros.pagina ?? 1));
  const porPagina = Math.min(100, Math.max(1, Math.trunc(filtros.porPagina ?? 20)));

  const condiciones: string[] = [];
  const valores: unknown[] = [];

  if (filtros.busqueda?.trim()) {
    valores.push(`%${escaparLike(filtros.busqueda.trim())}%`);
    const marcador = `$${valores.length}`;
    condiciones.push(
      `(c.para ILIKE ${marcador} ESCAPE '\\'
        OR c.asunto ILIKE ${marcador} ESCAPE '\\'
        OR d.nombre ILIKE ${marcador} ESCAPE '\\'
        OR d.apellido ILIKE ${marcador} ESCAPE '\\'
        OR e.nombre ILIKE ${marcador} ESCAPE '\\')`,
    );
  }

  if (filtros.estado?.length) {
    valores.push(filtros.estado);
    condiciones.push(`c.estado = ANY($${valores.length})`);
  }

  if (filtros.porEntregar) {
    condiciones.push("c.estado = 'simulado' AND c.entregado_en IS NULL");
  }

  const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";
  const direccion = identificadorSeguro(filtros.direccion ?? "desc", ["asc", "desc"]);

  const totales = await consultarUno<{ total: string }>(
    `SELECT count(*)::text AS total ${DESDE} ${donde}`,
    valores,
    ejecutor,
  );
  const total = Number(totales?.total ?? 0);

  valores.push(porPagina, (pagina - 1) * porPagina);

  const filas = await consultar<Parameters<typeof comoCorreo>[0]>(
    `SELECT ${COLUMNAS}
     ${DESDE}
     ${donde}
     ORDER BY c.creado_en ${direccion.toUpperCase()}, c.id ${direccion.toUpperCase()}
     LIMIT $${valores.length - 1} OFFSET $${valores.length}`,
    valores,
    ejecutor,
  );

  return {
    filas: filas.map(comoCorreo),
    total,
    pagina,
    porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
  };
}
