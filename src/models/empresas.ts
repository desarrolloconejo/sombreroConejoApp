import {
  consultar,
  consultarUno,
  ejecutar,
  escaparLike,
  identificadorSeguro,
  type Ejecutor,
} from "@/lib/db";
import type {
  DatosFiscalesEmpresa,
  DatosNuevaEmpresa,
  Empresa,
  FiltrosEmpresas,
  NombreEmpresa,
  Pagina,
} from "@/types";

/**
 * Consultas sobre empresas: los clientes de la agencia.
 *
 * NO SE BORRAN, SE DESACTIVAN
 * ---------------------------
 * `clientes` y `fichas_hook` la referencian con ON DELETE RESTRICT, asi que la
 * base impide borrar una empresa con personas o con piezas. Y una empresa sin
 * nada tampoco hace falta borrarla. Por eso aqui no hay `borrar`: hay
 * `cambiarEstado`, igual que en usuarios.
 *
 * `listarActivas` alimenta los desplegables de otros modulos y `listar` alimenta
 * el listado de este. Son dos consultas distintas a proposito: un desplegable
 * quiere todas las que se pueden elegir, sin paginar y sin las desactivadas.
 */

const COLUMNAS = `
  id, nombre, rif, sector, telefono, direccion,
  sitio_web      AS "sitioWeb",
  instagram,
  tiktok,
  facebook,
  youtube,
  linkedin,
  logo_url       AS "logoUrl",
  activo,
  creado_en      AS "creadoEn",
  actualizado_en AS "actualizadoEn"
`;

/* Las columnas por las que se puede ordenar, con su nombre real en la tabla. */
const COLUMNAS_ORDEN = {
  nombre: "lower(nombre)",
  creadoEn: "creado_en",
} as const;

/** Las que se pueden elegir. Alimenta los desplegables de hooks y usuarios. */
export async function listarActivas(): Promise<Empresa[]> {
  return consultar<Empresa>(
    `SELECT ${COLUMNAS} FROM empresas WHERE activo ORDER BY lower(nombre)`,
  );
}

/**
 * Solo el id y el nombre, de TODAS: lo que necesita un desplegable de filtro y
 * nada mas.
 *
 * Incluye las desactivadas a proposito, al reves que `listarActivas`. Un
 * desplegable de alta ofrece lo que se PUEDE ELEGIR; uno de filtro tiene que
 * poder poner nombre a lo que ya viene en la URL, y a los contactos de una
 * empresa desactivada se sigue llegando desde su ficha. Con solo las activas,
 * ese enlace acabaria pintando un filtro sin nombre.
 */
export async function nombres(): Promise<NombreEmpresa[]> {
  return consultar<NombreEmpresa>(
    "SELECT id, nombre FROM empresas ORDER BY lower(nombre)",
  );
}

/**
 * El listado del modulo, paginado y con filtros.
 *
 * Mismo patron que `usuarios.listar`: las condiciones se acumulan con sus
 * marcadores, los filtros de lista van con `= ANY($n)` y la clave de orden pasa
 * por `identificadorSeguro` porque llega de la URL.
 */
export async function listar(
  filtros: FiltrosEmpresas = {},
): Promise<Pagina<Empresa>> {
  const pagina = Math.max(1, Math.trunc(filtros.pagina ?? 1));
  const porPagina = Math.min(100, Math.max(1, Math.trunc(filtros.porPagina ?? 20)));

  const condiciones: string[] = [];
  const valores: unknown[] = [];

  if (filtros.busqueda?.trim()) {
    valores.push(`%${escaparLike(filtros.busqueda.trim())}%`);
    const marcador = `$${valores.length}`;

    // El RIF entra en la busqueda porque es como se identifica a una empresa
    // en una factura, y muchas veces es lo unico que se tiene a mano.
    condiciones.push(
      `(nombre ILIKE ${marcador} ESCAPE '\\'
        OR rif ILIKE ${marcador} ESCAPE '\\')`,
    );
  }

  if (filtros.sector?.length) {
    valores.push(filtros.sector);
    condiciones.push(`sector = ANY($${valores.length})`);
  }

  if (filtros.activo?.length) {
    valores.push(filtros.activo);
    condiciones.push(`activo = ANY($${valores.length})`);
  }

  const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  const claveOrden = identificadorSeguro(
    filtros.orden ?? "nombre",
    Object.keys(COLUMNAS_ORDEN) as (keyof typeof COLUMNAS_ORDEN)[],
  );
  const columnaOrden = COLUMNAS_ORDEN[claveOrden];
  const direccion = identificadorSeguro(filtros.direccion ?? "asc", ["asc", "desc"]);

  const totales = await consultarUno<{ total: string }>(
    `SELECT count(*)::text AS total FROM empresas ${donde}`,
    valores,
  );

  const total = Number(totales?.total ?? 0);

  valores.push(porPagina, (pagina - 1) * porPagina);

  const filas = await consultar<Empresa>(
    `SELECT ${COLUMNAS}
     FROM empresas
     ${donde}
     ORDER BY ${columnaOrden} ${direccion.toUpperCase()} NULLS LAST, id DESC
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
 * Los sectores que existen de verdad, para el filtro.
 *
 * El sector es texto libre, asi que las opciones no se pueden declarar en el
 * codigo: se leen de lo que hay. Es el equivalente a `cargos.listar()` en el
 * modulo de usuarios, solo que ahi los cargos si son un conjunto cerrado.
 */
export async function sectores(): Promise<string[]> {
  const filas = await consultar<{ sector: string }>(
    `SELECT DISTINCT sector
     FROM empresas
     WHERE sector IS NOT NULL AND btrim(sector) <> ''
     ORDER BY sector`,
  );

  return filas.map((fila) => fila.sector);
}

export async function buscarPorId(
  id: number,
  ejecutor?: Ejecutor,
): Promise<Empresa | null> {
  return consultarUno<Empresa>(
    `SELECT ${COLUMNAS} FROM empresas WHERE id = $1`,
    [id],
    ejecutor,
  );
}

/** Hay otra empresa —distinta de esta— con ese RIF. */
export async function existeRifDeOtra(rif: string, id: number): Promise<boolean> {
  const fila = await consultarUno<{ existe: boolean }>(
    "SELECT TRUE AS existe FROM empresas WHERE rif = $1 AND id <> $2 LIMIT 1",
    [rif, id],
  );

  return fila !== null;
}

export async function crear(
  datos: DatosNuevaEmpresa,
  ejecutor?: Ejecutor,
): Promise<Empresa> {
  const empresa = await consultarUno<Empresa>(
    `INSERT INTO empresas (
       nombre, rif, sector, telefono, direccion,
       sitio_web, instagram, tiktok, facebook, youtube, linkedin
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING ${COLUMNAS}`,
    [
      datos.nombre,
      datos.rif,
      datos.sector,
      datos.telefono,
      datos.direccion,
      datos.sitioWeb,
      datos.instagram,
      datos.tiktok,
      datos.facebook,
      datos.youtube,
      datos.linkedin,
    ],
    ejecutor,
  );

  if (!empresa) {
    throw new Error("La insercion de la empresa no devolvio ninguna fila");
  }

  return empresa;
}

/**
 * Edita los datos de una empresa. NO toca `activo`.
 *
 * Activar o desactivar es otra decision, con su propia confirmacion y su
 * propio aviso: si viajara en este UPDATE, guardar el telefono desde el
 * formulario podria reactivar sin querer una cuenta que alguien cerro.
 */
export async function actualizar(
  id: number,
  datos: DatosNuevaEmpresa,
  ejecutor?: Ejecutor,
): Promise<Empresa | null> {
  return consultarUno<Empresa>(
    `UPDATE empresas
     SET nombre = $2, rif = $3, sector = $4, telefono = $5, direccion = $6,
         sitio_web = $7, instagram = $8, tiktok = $9, facebook = $10,
         youtube = $11, linkedin = $12
     WHERE id = $1
     RETURNING ${COLUMNAS}`,
    [
      id,
      datos.nombre,
      datos.rif,
      datos.sector,
      datos.telefono,
      datos.direccion,
      datos.sitioWeb,
      datos.instagram,
      datos.tiktok,
      datos.facebook,
      datos.youtube,
      datos.linkedin,
    ],
    ejecutor,
  );
}

export async function cambiarEstado(
  id: number,
  activo: boolean,
  ejecutor?: Ejecutor,
): Promise<boolean> {
  const afectadas = await ejecutar(
    "UPDATE empresas SET activo = $2 WHERE id = $1",
    [id, activo],
    ejecutor,
  );

  return afectadas === 1;
}

/**
 * Lo que la factura necesita de cada empresa activa: si retiene IVA y cuanto,
 * y sus dias de credito (sin valor, los de los ajustes de finanzas).
 */
export async function datosFiscales(ejecutor?: Ejecutor): Promise<DatosFiscalesEmpresa[]> {
  return consultar<DatosFiscalesEmpresa>(
    `SELECT id, nombre, rif,
            agente_retencion          AS "agenteRetencion",
            retencion_iva_pct::int    AS "retencionIvaPct",
            dias_credito              AS "diasCredito"
     FROM empresas WHERE activo ORDER BY lower(nombre)`,
    [],
    ejecutor,
  );
}

export async function cambiarDatosFiscales(
  id: number,
  datos: { retencionIvaPct: 75 | 100 | null; diasCredito: number | null },
  ejecutor?: Ejecutor,
): Promise<boolean> {
  const afectadas = await ejecutar(
    `UPDATE empresas SET
       agente_retencion = $2::int IS NOT NULL, retencion_iva_pct = $2, dias_credito = $3,
       actualizado_en = now()
     WHERE id = $1`,
    [id, datos.retencionIvaPct, datos.diasCredito],
    ejecutor,
  );

  return afectadas === 1;
}
