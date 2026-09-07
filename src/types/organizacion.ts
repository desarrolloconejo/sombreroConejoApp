import type { NombreRol, SlugCargo } from "./usuario";

/** Fila de la tabla roles. */
export type Rol = {
  id: number;
  nombre: NombreRol;
  descripcion: string | null;
};

/**
 * Area de la agencia a la que pertenece un trabajador.
 *
 * No es un dato descriptivo: de el depende que contenido ve esa persona.
 * Es el segundo eje de autorizacion, independiente del rol.
 */
export type Cargo = {
  id: number;
  slug: SlugCargo;
  nombre: string;
  descripcion: string | null;
};

/**
 * Empresa cliente. Puede tener varias personas de contacto, y determina que
 * contenido ven todas ellas.
 */
export type Empresa = {
  id: number;
  nombre: string;
  rif: string | null;

  /**
   * El sector, que decide la regla del auditor cuando la empresa no tiene
   * una propia: la resolucion es cliente, luego sector, luego el estandar.
   */
  sector: string | null;
  telefono: string | null;
  direccion: string | null;

  /*
   * Donde esta la empresa en internet.
   *
   * Son columnas fijas y no una lista de enlaces porque las plataformas son
   * siempre las mismas cinco. Se guardan como URL completa: un handle suelto
   * no se puede abrir.
   */
  sitioWeb: string | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  youtube: string | null;
  linkedin: string | null;

  logoUrl: string | null;
  activo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
};

/**
 * Datos necesarios para registrar o editar una empresa.
 *
 * Sirve para las dos cosas: los campos que se escriben son los mismos, y lo
 * unico que no se toca al editar —`activo`— tiene su propia action.
 */
export type DatosNuevaEmpresa = {
  nombre: string;
  rif: string | null;
  sector: string | null;
  telefono: string | null;
  direccion: string | null;
  sitioWeb: string | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  youtube: string | null;
  linkedin: string | null;
};

/** Por que columna se puede ordenar el listado de empresas. */
export type OrdenEmpresas = "nombre" | "creadoEn";

export type FiltrosEmpresas = {
  busqueda?: string;

  /* Listas, como en usuarios: el listado admite varios valores por grupo. */
  sector?: string[];
  activo?: boolean[];

  orden?: OrdenEmpresas;
  direccion?: "asc" | "desc";
  pagina?: number;
  porPagina?: number;
};

/**
 * Una empresa con lo que se ve de ella de un vistazo en el listado.
 *
 * Los dos recuentos no salen de un JOIN en la consulta principal: se piden
 * por lote para la pagina visible, igual que hace el historial de hooks. Un
 * JOIN con dos agregados obligaria a agrupar por todas las columnas de la
 * empresa para pintar dos numeros.
 */
export type ResumenEmpresa = Empresa & {
  /** Personas de contacto activas. */
  contactos: number;
  /** Fichas de hook de esta cuenta, en cualquier estado. */
  piezas: number;
};

/**
 * Una empresa reducida a lo que hace falta para nombrarla en una lista.
 *
 * Existe para el desplegable de filtro del modulo de usuarios, que solo pinta
 * texto: traer la fila entera —RIF, direccion, seis enlaces— para eso seria
 * pagar el ancho de banda de una ficha por cada opcion de un menu.
 */
export type NombreEmpresa = {
  id: number;
  nombre: string;
};

/** Vinculo de un usuario con el personal de la empresa. */
export type Trabajador = {
  id: number;
  usuarioId: number;
  rolId: number;
  cargoId: number;
  fechaIngreso: Date | null;
  creadoEn: Date;
};

/** Vinculo de un usuario con una empresa cliente. */
export type Cliente = {
  id: number;
  usuarioId: number;
  empresaId: number;
  cargo: string | null;
  creadoEn: Date;
};
