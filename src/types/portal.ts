/**
 * Proyectos, piezas, fases y tareas.
 *
 * Los conjuntos cerrados son el espejo de los CHECK de db/schema.sql: si se
 * anade un valor hay que tocar los dos sitios. Las reglas estan en
 * docs/reglasBateria.md.
 *
 * Las fechas sin hora (estimadas, de inicio) viajan como texto AAAA-MM-DD: un
 * `Date` les inventaria una hora y una zona, y en Caracas eso cambia el dia.
 */

/** La plantilla de fases que usa un proyecto. */
export type TipoProyecto = "redes_sociales" | "especial";

export type EstadoProyecto = "activo" | "pausado" | "cerrado" | "cancelado";

export type TipoPieza =
  | "post"
  | "carrusel"
  | "reel"
  | "historia"
  | "video"
  | "logo"
  | "entregable"
  | "otro";

export type EstadoPieza = "activa" | "cancelada";

export type NumeroFase = 1 | 2 | 3 | 4 | 5;

/** Las fases que llevan tareas. Las demas son controles. */
export type FaseDeTrabajo = 1 | 3;

export type EstadoFase = "pendiente" | "en_curso" | "completada";

export type EstadoTarea = "pendiente" | "lista";

/** Lo que el cliente marca al pedir una correccion en la fase 5. */
export type TipoCorreccion = "redaccion" | "diseno" | "ambas";

/** Las cuatro alertas del tablero. */
export type AlertaPieza =
  | "por_vencer"
  | "atrasada"
  | "esperando_cliente"
  | "en_correccion";

export const NOMBRES_DE_ESTADO_PROYECTO: Record<EstadoProyecto, string> = {
  activo: "Activo",
  pausado: "Pausado",
  cerrado: "Cerrado",
  cancelado: "Cancelado",
};

export const NOMBRES_DE_TIPO_PIEZA: Record<TipoPieza, string> = {
  post: "Post",
  carrusel: "Carrusel",
  reel: "Reel",
  historia: "Historia",
  video: "Video",
  logo: "Logo",
  entregable: "Entregable",
  otro: "Otro",
};

export const NOMBRES_DE_ESTADO_FASE: Record<EstadoFase, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  completada: "Completada",
};

export const NOMBRES_DE_ALERTA: Record<AlertaPieza, string> = {
  por_vencer: "Por vencer",
  atrasada: "Atrasada",
  esperando_cliente: "Esperando al cliente",
  en_correccion: "En correccion",
};

/** Lo minimo de una persona para pintarla junto a algo. */
export type PersonaBreve = {
  id: number;
  nombre: string;
};

/** Que ejecutivo atiende a que empresa. */
export type Asignacion = {
  id: number;
  usuarioId: number;
  usuarioNombre: string;
  empresaId: number;
  empresaNombre: string;
  creadoEn: Date;
};

/** El avance de un proyecto, tal como lo calcula la base. */
export type AvanceProyecto = {
  totalPiezas: number;
  fasesCompletadas: number;
  /** De 0 a 100, con dos decimales como mucho. */
  porcentaje: number;
  piezasAprobadas: number;
};

/** Cuantas piezas tiene el proyecto en cada alerta. */
export type AlertasProyecto = Record<AlertaPieza, number>;

/** Un proyecto tal como se lista. */
export type Proyecto = {
  id: number;
  empresaId: number;
  empresaNombre: string;
  ejecutivoId: number;
  ejecutivoNombre: string;
  servicio: string;
  tipo: TipoProyecto;
  nombre: string;
  descripcion: string | null;
  estado: EstadoProyecto;
  fechaInicio: string | null;
  fechaEstimadaCierre: string | null;
  creadoEn: Date;
  avance: AvanceProyecto;
  alertas: AlertasProyecto;
};

/** Una fase de una pieza. */
export type FasePieza = {
  id: number;
  fase: NumeroFase;
  estado: EstadoFase;
  fechaEstimada: string | null;
  responsableId: number | null;
  responsableNombre: string | null;
  completadaEn: Date | null;
  rondaCompletada: number | null;
};

/** El avance de una pieza, tal como lo calcula la base. */
export type AvancePieza = {
  fasesCompletadas: number;
  porcentaje: number;
  /** La primera fase no completada. Nula si la pieza esta aprobada. */
  faseActual: NumeroFase | null;
  aprobada: boolean;
  fechaEstimadaActual: string | null;
  alertas: AlertaPieza[];
};

/** Una pieza con sus cinco fases. */
export type Pieza = {
  id: number;
  proyectoId: number;
  orden: number;
  tipo: TipoPieza;
  titulo: string;
  responsableId: number | null;
  responsableNombre: string | null;
  ronda: number;
  estado: EstadoPieza;
  motivoCancelacion: string | null;
  fases: FasePieza[];
  avance: AvancePieza;
};

/** Una tarea dentro de una fase de trabajo. */
export type Tarea = {
  id: number;
  piezaId: number;
  fase: FaseDeTrabajo;
  orden: number;
  titulo: string;
  responsableId: number | null;
  responsableNombre: string | null;
  herramienta: string | null;
  fechaEstimada: string | null;
  estado: EstadoTarea;
  listaEn: Date | null;
};

/** Una tarea vista desde «Mi trabajo»: con donde esta. */
export type TareaAsignada = Tarea & {
  proyectoId: number;
  proyectoNombre: string;
  empresaNombre: string;
  piezaTitulo: string;
  piezaTipo: TipoPieza;
  /** Si la fase de la tarea es la que esta en curso ahora. */
  faseEnCurso: boolean;
};

/** Un comentario interno sobre una pieza. */
export type ComentarioPieza = {
  id: number;
  autorId: number;
  autorNombre: string;
  texto: string;
  creadoEn: Date;
};

/** Lo que hace falta para crear una pieza. */
export type DatosNuevaPieza = {
  tipo: TipoPieza;
  titulo: string;
};

/** Lo que hace falta para crear una tarea. */
export type DatosNuevaTarea = {
  fase: FaseDeTrabajo;
  titulo: string;
  responsableId?: number | null;
  herramienta?: string | null;
  fechaEstimada?: string | null;
};

/** Lo que hace falta para crear un proyecto. */
export type DatosNuevoProyecto = {
  empresaId: number;
  ejecutivoId: number;
  servicio: string;
  tipo: TipoProyecto;
  nombre: string;
  descripcion?: string | null;
  fechaInicio?: string | null;
  fechaEstimadaCierre?: string | null;
};

export type FiltrosProyectos = {
  busqueda?: string;
  estado?: EstadoProyecto[];
  empresaId?: number[];
  ejecutivoId?: number[];
  tipo?: TipoProyecto[];
  direccion?: "asc" | "desc";
  pagina?: number;
  porPagina?: number;
};
