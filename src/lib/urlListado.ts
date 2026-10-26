import type { Direccion, EstadoListado } from "@/types";
import {
  acotarPorPagina,
  PARAMETROS,
  POR_PAGINA_POR_DEFECTO,
} from "@/lib/parametros";

/**
 * Construccion de las URLs del listado.
 *
 * Cada filtro, cada cabecera ordenable y cada pagina es un enlace, asi que
 * todo el listado se navega, se comparte y se guarda en marcadores. Estas
 * funciones parten SIEMPRE del estado vigente para que un cambio no borre los
 * demas: filtrar no pierde la busqueda, ordenar no pierde los filtros.
 *
 * Se omiten del querystring los valores que coinciden con el defecto, para que
 * la URL quede corta. Con `orden` y `dir` no se puede hacer lo mismo: su
 * defecto lo decide la ConfigListado de cada modulo, y estas funciones reciben
 * el estado, no la configuracion. Van siempre explicitos, que ademas es lo que
 * hace que el enlace ordenado se pueda compartir tal cual.
 */

function parametrosDe(estado: EstadoListado): URLSearchParams {
  const parametros = new URLSearchParams();

  if (estado.busqueda) parametros.set(PARAMETROS.busqueda, estado.busqueda);

  // El orden de insercion sigue al de `filtrosPermitidos`, asi que la misma
  // combinacion produce siempre la misma URL.
  //
  // `append` y no `set`: un filtro con varios valores se repite en la URL
  // ("?estado=borrador&estado=medida"), que es como se representa una lista
  // sin inventar un separador que despues habria que escapar.
  for (const [clave, valores] of Object.entries(estado.filtros)) {
    for (const valor of valores) {
      if (valor) parametros.append(clave, valor);
    }
  }

  parametros.set(PARAMETROS.orden, estado.orden);
  parametros.set(PARAMETROS.direccion, estado.direccion);

  if (estado.pagina > 1) {
    parametros.set(PARAMETROS.pagina, String(estado.pagina));
  }

  if (estado.porPagina !== POR_PAGINA_POR_DEFECTO) {
    parametros.set(PARAMETROS.porPagina, String(estado.porPagina));
  }

  if (estado.panel) {
    parametros.set(PARAMETROS.panel, estado.panel);
    if (estado.panelId !== null) {
      parametros.set(PARAMETROS.panelId, String(estado.panelId));
    }
  }

  return parametros;
}

function unir(ruta: string, parametros: URLSearchParams): string {
  const cadena = parametros.toString();
  return cadena ? `${ruta}?${cadena}` : ruta;
}

/** Buscar cambia el conjunto de resultados: vuelve a la primera pagina. */
export function conBusqueda(
  ruta: string,
  estado: EstadoListado,
  termino: string,
): string {
  return unir(ruta, parametrosDe({ ...estado, busqueda: termino.trim(), pagina: 1 }));
}

/**
 * Anade o quita un valor de un filtro, sin tocar los demas.
 *
 * Es un INTERRUPTOR, no una asignacion: pulsar sobre algo ya elegido lo quita.
 * Asi el mismo enlace sirve para poner y para sacar, y no hace falta una "x"
 * aparte en cada opcion.
 *
 * Un valor nulo o vacio limpia el filtro entero, que es lo que hace "Todos".
 *
 * Cambiar un filtro vuelve SIEMPRE a la primera pagina: el conjunto de
 * resultados es otro, y quedarse en la pagina siete de una lista que ahora
 * tiene dos paginas mostraria un vacio que parece un error.
 */
export function alternarFiltro(
  ruta: string,
  estado: EstadoListado,
  clave: string,
  valor: string | null,
): string {
  const filtros = { ...estado.filtros };

  if (valor === null || valor === "") {
    delete filtros[clave];
  } else {
    const actuales = filtros[clave] ?? [];

    const siguientes = actuales.includes(valor)
      ? actuales.filter((uno) => uno !== valor)
      : [...actuales, valor];

    if (siguientes.length > 0) {
      filtros[clave] = siguientes;
    } else {
      // Sin valores el filtro no existe, en lugar de quedarse como una clave
      // con lista vacia que ensuciaria la URL y `hayCriterios`.
      delete filtros[clave];
    }
  }

  return unir(ruta, parametrosDe({ ...estado, filtros, pagina: 1 }));
}

/**
 * Ordenar por una columna. Si ya se ordenaba por ella, invierte la direccion;
 * si no, empieza ascendente, que es lo que espera quien pulsa por primera vez.
 */
export function conOrden(
  ruta: string,
  estado: EstadoListado,
  clave: string,
): string {
  const direccion: Direccion =
    estado.orden === clave && estado.direccion === "asc" ? "desc" : "asc";

  return unir(ruta, parametrosDe({ ...estado, orden: clave, direccion, pagina: 1 }));
}

export function conPagina(
  ruta: string,
  estado: EstadoListado,
  pagina: number,
): string {
  const destino = Number.isFinite(pagina) ? Math.max(1, Math.trunc(pagina)) : 1;

  return unir(ruta, parametrosDe({ ...estado, pagina: destino }));
}

/** Cambiar el tamano de pagina descoloca el corte: se vuelve a la primera. */
export function conPorPagina(
  ruta: string,
  estado: EstadoListado,
  cuantos: number,
): string {
  return unir(
    ruta,
    parametrosDe({ ...estado, porPagina: acotarPorPagina(cuantos), pagina: 1 }),
  );
}

/** Quita todos los filtros y conserva la busqueda, que es lo que se escribio. */
export function sinFiltros(ruta: string, estado: EstadoListado, fijos: readonly string[] = []): string {
  // Los filtros fijos no son criterios del usuario sino parte de donde esta
  // (la pestana de una bandeja): limpiar no los quita.
  const conservados = Object.fromEntries(Object.entries(estado.filtros).filter(([clave]) => fijos.includes(clave)));
  return unir(ruta, parametrosDe({ ...estado, filtros: conservados, pagina: 1 }));
}

/** Abre o cierra el panel lateral. Cerrar tambien se lleva el id. */
export function conPanel(
  ruta: string,
  estado: EstadoListado,
  panel: string | null,
  id?: number,
): string {
  const panelId = panel !== null && typeof id === "number" ? id : null;

  return unir(ruta, parametrosDe({ ...estado, panel, panelId }));
}

/**
 * Los mismos parametros vigentes, en forma de campos ocultos.
 *
 * El buscador es un formulario GET: al enviarlo el navegador arma el
 * querystring SOLO con sus campos, asi que sin esto se perderian los filtros y
 * el orden. La pagina se descarta a proposito, para volver a la primera.
 */
export function camposOcultos(
  estado: EstadoListado,
  omitir: readonly string[] = [],
): { nombre: string; valor: string }[] {
  const parametros = parametrosDe({ ...estado, busqueda: "", pagina: 1 });
  const campos: { nombre: string; valor: string }[] = [];

  for (const [nombre, valor] of parametros.entries()) {
    if (!omitir.includes(nombre)) campos.push({ nombre, valor });
  }

  return campos;
}
