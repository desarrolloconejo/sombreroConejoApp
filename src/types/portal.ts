/**
 * Proyectos, piezas, fases y tareas.
 *
 * Los conjuntos cerrados son el espejo de los CHECK de db/schema.sql: si se
 * anade un valor hay que tocar los dos sitios. Las reglas estan en
 * docs/negocio/reglasBateria.md.
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

/**
 * Un ejecutivo de cuentas que puede llevar un proyecto de una empresa. Los de
 * otra cuenta solo los ofrece el administrador: es la excepcion por proyecto.
 */
export type EjecutivoPosible = PersonaBreve & { deOtraCuenta: boolean };

/** Alguien del equipo a quien se le puede asignar trabajo. */
export type PersonaDeEquipo = PersonaBreve & {
  /** El nombre del cargo, para distinguir a quien se elige. */
  cargo: string | null;
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
  /** La sigla de la empresa: el bloque CLIENTE de los nombres de archivo. */
  empresaSigla: string;
  ejecutivoId: number;
  ejecutivoNombre: string;
  servicio: string;
  tipo: TipoProyecto;
  nombre: string;
  /** El bloque PROYECTO de los nombres de archivo. */
  nombreCorto: string;
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
  proyectoTipo: TipoProyecto;
  empresaNombre: string;
  piezaTitulo: string;
  piezaTipo: TipoPieza;
  /** Si la fase de la tarea es la que esta en curso ahora. */
  faseEnCurso: boolean;
};

/** Una pieza que espera la revision del cliente, para llevarle directo a ella. */
export type PiezaEsperandoCliente = {
  piezaId: number;
  proyectoId: number;
  titulo: string;
  proyectoNombre: string;
};

/**
 * Una fase de la que alguien es responsable, vista desde «Mi trabajo»: donde
 * esta, para cuando, y las tareas que le faltan, sean de quien sean. Quien
 * lleva la fase responde por que salga.
 */
export type FaseACargo = {
  id: number;
  piezaId: number;
  fase: NumeroFase;
  estado: EstadoFase;
  fechaEstimada: string | null;
  proyectoId: number;
  proyectoNombre: string;
  proyectoTipo: TipoProyecto;
  empresaNombre: string;
  piezaTitulo: string;
  piezaTipo: TipoPieza;
  /** Las tareas pendientes de la fase, de cualquiera. */
  tareas: Tarea[];
};

/** Un comentario interno sobre una pieza. */
export type ComentarioPieza = {
  id: number;
  autorId: number;
  autorNombre: string;
  texto: string;
  creadoEn: Date;
  /** La fase en la que se dijo; null, un comentario general de la pieza. */
  fase: NumeroFase | null;
  /** La tarea de esa fase a la que se refiere, si se marco. */
  tareaId: number | null;
  tareaTitulo: string | null;
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
/** Un proyecto tal como lo necesita el armador de nombres de archivo. */
export type ProyectoParaNombrar = {
  id: number;
  empresaId: number;
  nombre: string;
  nombreCorto: string;
};

export type DatosNuevoProyecto = {
  empresaId: number;
  ejecutivoId: number;
  servicio: string;
  tipo: TipoProyecto;
  nombre: string;
  /** Sin el, la base propone uno a partir del nombre. */
  nombreCorto?: string | null;
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

/** De donde sale una version: un archivo subido o un enlace externo. */
export type OrigenVersion = "archivo" | "enlace";

export type DecisionRevision = "aprobada" | "correccion";

export const NOMBRES_DE_CORRECCION: Record<TipoCorreccion, string> = {
  redaccion: "Redaccion",
  diseno: "Diseno o edicion",
  ambas: "Redaccion y diseno",
};

/** Una version de una pieza. Nunca lleva donde esta guardado el archivo. */
export type Version = {
  id: number;
  piezaId: number;
  numero: number;
  ronda: number;
  fase: NumeroFase;
  origen: OrigenVersion;
  /** Solo en las de enlace. */
  enlace: string | null;
  nombre: string;
  mime: string | null;
  tamano: number | null;
  subidaPorNombre: string;
  creadaEn: Date;
  /** Cuando se marco como la que vera el cliente. */
  enviadaEn: Date | null;
};

/** Lo que hace falta para guardar una version. */
export type NuevaVersion = {
  piezaId: number;
  ronda: number;
  fase: NumeroFase;
  origen: OrigenVersion;
  archivoId?: string | null;
  enlace?: string | null;
  nombre: string;
  mime?: string | null;
  tamano?: number | null;
};

/** La decision del cliente en una ronda. */
export type Revision = {
  id: number;
  piezaId: number;
  ronda: number;
  decision: DecisionRevision;
  tipoCorreccion: TipoCorreccion | null;
  comentario: string | null;
  fasesReabiertas: NumeroFase[];
  versionId: number | null;
  autorNombre: string;
  creadaEn: Date;
  ajustadaPorNombre: string | null;
  ajustadaEn: Date | null;
};
