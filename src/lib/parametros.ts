import type { ConfigListado, Direccion, EstadoListado } from "@/types";
import { comoIdentificador, limpiarTexto } from "@/lib/validaciones";

/**
 * Lectura del estado de un listado desde los searchParams.
 *
 * POR QUE ESTA PIEZA EXISTE
 * -------------------------
 * `identificadorSeguro` (lib/db) LANZA cuando el valor no esta en su lista
 * blanca, y los modelos lo llaman con la clave de orden y con la direccion.
 * Un "?orden=;DROP" escrito a mano en la barra del navegador tumbaria la
 * pagina con un 500 si el valor crudo llegara al modelo.
 *
 * Por eso `leerEstadoListado` NUNCA lanza: ante cualquier basura cae al valor
 * por defecto. Es la unica puerta por la que la URL entra al listado.
 */

/** Nombres de los parametros en la URL. Se leen y se escriben desde aqui. */
export const PARAMETROS = {
  busqueda: "busqueda",
  orden: "orden",
  direccion: "dir",
  pagina: "pagina",
  porPagina: "porPagina",
  panel: "panel",
  panelId: "id",
} as const;

/** Cuantos registros por pagina cuando el modulo no dice otra cosa. */
export const POR_PAGINA_POR_DEFECTO = 20;

/** Opciones del selector de tamano de pagina. */
export const OPCIONES_POR_PAGINA = [10, 20, 50, 100] as const;

const POR_PAGINA_MINIMO = 1;
const POR_PAGINA_MAXIMO = 100;

/** Tope de la busqueda. Mas alla de esto no hay consulta que gane nada. */
const LIMITE_BUSQUEDA = 120;

/** Tope del valor de un filtro. Son etiquetas cortas, no texto libre. */
const LIMITE_FILTRO = 60;

/*
 * Los paneles que se pueden abrir desde la URL.
 *
 * Es una lista blanca: sin ella un "?panel=" escrito a mano llegaria hasta la
 * page, que decide con el que consultar. Lo que no este aqui se ignora y no se
 * abre nada, en lugar de fallar.
 */
const PANELES: readonly string[] = ["nuevo", "ver", "editar", "estado", "clave"];

/**
 * Un parametro repetido ("?tipo=a&tipo=b") llega como arreglo. Se toma el
 * primero: el listado no tiene filtros de seleccion multiple.
 */
function primerValor(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

/** Deja el tamano de pagina dentro de un rango que la base pueda servir. */
export function acotarPorPagina(cuantos: number): number {
  if (!Number.isFinite(cuantos)) return POR_PAGINA_POR_DEFECTO;

  return Math.min(POR_PAGINA_MAXIMO, Math.max(POR_PAGINA_MINIMO, Math.trunc(cuantos)));
}

/**
 * Convierte los searchParams de una page en el estado del listado.
 *
 * En Next 16 los searchParams son una promesa, asi que la page hace el await
 * antes de llamar aqui:
 *
 *   const estado = leerEstadoListado(await searchParams, CONFIG);
 */
export function leerEstadoListado(
  parametros: Record<string, string | string[] | undefined>,
  config: ConfigListado,
): EstadoListado {
  const leer = (clave: string): string | undefined => primerValor(parametros[clave]);

  const ordenPedido = leer(PARAMETROS.orden);
  const orden =
    typeof ordenPedido === "string" && config.ordenPermitido.includes(ordenPedido)
      ? ordenPedido
      : config.ordenPorDefecto;

  const direccionPedida = leer(PARAMETROS.direccion);
  const direccion: Direccion =
    direccionPedida === "asc" || direccionPedida === "desc"
      ? direccionPedida
      : (config.direccionPorDefecto ?? "desc");

  const porPaginaPedido = comoIdentificador(leer(PARAMETROS.porPagina));
  const porPagina =
    porPaginaPedido === null
      ? acotarPorPagina(config.porPaginaPorDefecto ?? POR_PAGINA_POR_DEFECTO)
      : acotarPorPagina(porPaginaPedido);

  // Solo se recogen las claves que el modulo declaro. Cualquier otro parametro
  // de la URL se queda fuera del estado y, por tanto, fuera de la consulta.
  const filtros: Record<string, string> = {};
  for (const clave of config.filtrosPermitidos ?? []) {
    const valor = limpiarTexto(leer(clave), LIMITE_FILTRO);
    if (valor) filtros[clave] = valor;
  }

  const panelPedido = leer(PARAMETROS.panel);
  const panel = typeof panelPedido === "string" && PANELES.includes(panelPedido)
    ? panelPedido
    : null;

  return {
    busqueda: limpiarTexto(leer(PARAMETROS.busqueda), LIMITE_BUSQUEDA),
    orden,
    direccion,
    pagina: comoIdentificador(leer(PARAMETROS.pagina)) ?? 1,
    porPagina,
    filtros,
    panel,

    // Sin panel no hay id: un "?id=12" suelto no debe hacer que la page
    // consulte un registro que nadie va a mostrar.
    panelId: panel === null ? null : comoIdentificador(leer(PARAMETROS.panelId)),
  };
}

/** Hay algo aplicado que se pueda limpiar. Decide el estado vacio y el enlace. */
export function hayCriterios(estado: EstadoListado): boolean {
  return estado.busqueda.length > 0 || Object.keys(estado.filtros).length > 0;
}
