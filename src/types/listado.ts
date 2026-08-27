import type { ReactNode } from "react";

/**
 * Contrato del listado estandar.
 *
 * Un solo componente sirve a todos los modulos que muestren registros. El
 * modulo no escribe su tabla: aporta tres cosas y nada mas.
 *
 *   sus columnas  -> que se ve y como se pinta cada celda
 *   sus filtros   -> las opciones propias de la entidad
 *   su consulta   -> la funcion del modelo que ya acepta filtros, orden y pagina
 *
 * El estado (busqueda, filtros, orden, pagina) NO vive en el componente: vive
 * en la URL. De ahi sale lo que gobierna el diseno de estas piezas: cada
 * interaccion es un enlace o un formulario GET, asi que casi todo el listado
 * se renderiza en el servidor y se puede compartir el enlace de lo que se
 * este viendo.
 *
 * Solo dos piezas son de cliente, y ninguna de las dos manda sobre el estado:
 *
 *   FiltroDesplegable  decide si el grupo se ve abierto o cerrado. Las
 *                      opciones de dentro siguen siendo enlaces del servidor
 *   ListadoBuscador    adelanta el envio del formulario mientras se escribe.
 *                      El <form method="get"> sigue ahi, asi que sin
 *                      JavaScript se busca igual pulsando Enter
 */

/**
 * Una columna de la tabla.
 *
 * `clave` cumple doble papel: identifica la columna y es la clave de orden que
 * se le pasa al modelo, asi que tiene que coincidir con lo que ese modelo
 * acepta (para usuarios: "nombre", "email", "creadoEn", "ultimoAcceso").
 */
export type Columna<T> = {
  clave: string;
  titulo: string;
  ordenable?: boolean;

  /**
   * Pista de la rejilla CSS: una fraccion ("2.2fr") o una medida fija
   * ("44px"). Sin valor, la columna reparte el espacio a partes iguales.
   */
  ancho?: string;

  alineacion?: "izquierda" | "derecha" | "centro";

  /**
   * Papel de la columna cuando el listado se pinta como tarjetas.
   *
   * Por debajo de lg no hay tabla: una tabla de cinco columnas en 360 px o
   * desborda o encoge el texto hasta lo ilegible, y obligar a arrastrar de
   * lado para leer un registro es peor que no tener tabla. Cada fila pasa a
   * ser una tarjeta, y para montarla hace falta saber que papel juega cada
   * columna dentro de ella:
   *
   *   "titulo"    encabeza la tarjeta, sin rotulo (el nombre, el codigo...)
   *   "dato"      rotulo + valor en el cuerpo. Es el valor por defecto
   *   "acciones"  va al pie, separada del resto
   *   "oculta"    no aparece en la tarjeta, solo en la tabla
   *
   * Si ninguna columna se declara "titulo", encabeza la primera: es lo que
   * hace que un modulo que no se plantee esto siga saliendo razonable.
   */
  tarjeta?: "titulo" | "dato" | "acciones" | "oculta";

  /** Como se pinta la celda. Recibe la fila entera. */
  render: (fila: T) => ReactNode;
};

/** Una opcion de un filtro. El valor vacio significa "sin filtrar". */
export type OpcionFiltro = {
  valor: string;
  texto: string;
};

/**
 * Un grupo de chips.
 *
 * `clave` es el nombre del parametro en la URL, asi que no puede chocar con
 * los que ya usa el listado: busqueda, orden, dir, pagina, porPagina, panel
 * e id.
 */
export type DefinicionFiltro = {
  clave: string;
  titulo: string;
  opciones: OpcionFiltro[];
};

export type Direccion = "asc" | "desc";

/**
 * El estado del listado, ya leido y saneado desde la URL.
 *
 * Se construye SIEMPRE con `leerEstadoListado`. Nadie debe armarlo a mano a
 * partir de searchParams: es esa funcion la que garantiza que ningun valor
 * inventado llegue al modelo.
 */
export type EstadoListado = {
  busqueda: string;
  orden: string;
  direccion: Direccion;
  pagina: number;
  porPagina: number;

  /**
   * Solo las claves declaradas en `filtrosPermitidos`, y sin valores vacios.
   *
   * Cada filtro es una LISTA, aunque casi siempre traiga un solo elemento. Es
   * lo que permite elegir dos estados a la vez sin que uno pise al otro: la
   * URL los repite ("?estado=borrador&estado=medida") y aqui llegan los dos.
   * Una clave presente con la lista vacia no existe: se descarta al leerla.
   */
  filtros: Record<string, string[]>;

  /** Panel lateral abierto: ?panel=nuevo | ?panel=editar | ausente. */
  panel: string | null;

  /** Registro que edita el panel: ?id=12. */
  panelId: number | null;
};

/**
 * Lo que cada modulo declara para que su estado se pueda leer sin riesgo.
 *
 * `ordenPermitido` es una lista blanca de verdad: el modelo pasa la clave de
 * orden por `identificadorSeguro`, que LANZA si no la reconoce. Sin esta lista
 * un "?orden=cualquiercosa" escrito a mano tumbaria la pagina.
 */
export type ConfigListado = {
  ordenPermitido: readonly string[];
  ordenPorDefecto: string;
  direccionPorDefecto?: Direccion;
  filtrosPermitidos?: readonly string[];
  porPaginaPorDefecto?: number;
};
