/**
 * Briefs (etapa 6 del plan del portal; reglas en appFacturas/docs/05).
 *
 * Un formato de brief es un JSON versionado dentro del repositorio
 * (src/lib/portal/formatos/). Lo que se envia se congela con el texto exacto
 * de cada pregunta, asi que un brief viejo se sigue leyendo aunque el formato
 * cambie.
 *
 * Los conjuntos cerrados son espejo de los CHECK de db/schema.sql.
 */

/** Espejo de `briefs_estado_valido`. Los de en medio son los de S-07. */
export type EstadoBrief =
  | "borrador"
  | "enviado"
  | "en_validacion"
  | "en_presupuesto"
  | "aceptado"
  | "descartado";

export type TipoPregunta =
  | "texto_corto"
  | "texto_largo"
  | "email"
  | "telefono"
  | "fecha"
  | "numero"
  | "opcion_unica"
  | "opcion_multiple"
  | "confirmacion"
  | "matriz_alcance";

export type OpcionPregunta = { valor: string; texto: string };

export type FilaMatriz = { clave: string; titulo: string; descripcion?: string };

export type Pregunta = {
  clave: string;
  tipo: TipoPregunta;
  texto: string;
  numero?: number;
  ayuda?: string;
  obligatoria?: boolean;
  permiteNoSe?: boolean;
  prellenarDe?: "cliente.nombre" | "usuario.nombre" | "usuario.email";
  opciones?: OpcionPregunta[];
  columnas?: OpcionPregunta[];
  filas?: FilaMatriz[];
};

export type PasoBrief = {
  id: string;
  titulo: string;
  introduccion?: string;
  ocultoSi?: string;
  preguntas: Pregunta[];
};

export type CondicionRegla = { pregunta: string; fila?: string; igual: string };

export type ReglaBrief = {
  id: string;
  cuando: { todas: CondicionRegla[] };
  entonces: { ocultarPaso: string; avisoAlUsuario?: string };
};

export type FormatoBrief = {
  clave: string;
  version: number;
  nombre: string;
  lema?: string;
  tiempoEstimadoMinutos: number;
  instrucciones: string;
  confidencialidad?: string;
  valorNoSe: string;
  pasos: PasoBrief[];
  reglas?: ReglaBrief[];
};

/**
 * Lo que se va escribiendo. Texto para casi todo; arreglo de valores en la
 * opcion multiple; un objeto fila -> columna en la matriz; true en la
 * confirmacion.
 */
export type ValorRespuesta = string | string[] | Record<string, string> | boolean;
export type Respuestas = Record<string, ValorRespuesta>;

/** Una pregunta tal como queda congelada al enviar: con su texto exacto. */
export type RespuestaCongelada = {
  paso: string;
  clave: string;
  numero: number | null;
  pregunta: string;
  ayuda: string | null;
  tipo: TipoPregunta | "matriz_alcance_fila";
  valor: string | string[] | boolean | null;
  textoMostrado: string;
};

/** Un brief en la bandeja o en la lista del cliente. */
export type Brief = {
  id: number;
  codigo: string | null;
  formato: string;
  formatoVersion: number;
  estado: EstadoBrief;
  empresaId: number | null;
  empresaNombre: string | null;
  prospectoId: number | null;
  prospectoNombre: string | null;
  /** Quien lo pidio, como se muestra: la empresa o el prospecto. */
  solicitante: string;
  versionActual: number;
  /** Hay un borrador abierto: el primero, o el de una version nueva. */
  borradorAbierto: boolean;
  fechaAspirada: string | null;
  fechaPropuesta: string | null;
  motivoFechaPropuesta: string | null;
  motivoDescarte: string | null;
  enviadoEn: Date | null;
  creadoEn: Date;
  actualizadoEn: Date;
  proyectoId: number | null;
  presupuestoId: number | null;
  presupuestoEstado: string | null;
  presupuestoVencido: boolean;
};

/** Una version enviada. */
export type VersionBrief = {
  numero: number;
  contenido: RespuestaCongelada[];
  contenidoSha256: string;
  fechaAspirada: string;
  enviadoEn: Date;
  enviadoPorNombre: string;
};

/** Un mensaje del hilo de aclaraciones. */
export type AclaracionBrief = {
  id: number;
  autorNombre: string;
  /** Si lo escribio alguien de la agencia. */
  delEquipo: boolean;
  texto: string;
  creadoEn: Date;
};

export const NOMBRES_DE_ESTADO_BRIEF: Record<EstadoBrief, string> = {
  borrador: "Borrador",
  enviado: "Recibido",
  en_validacion: "En validacion",
  en_presupuesto: "En presupuesto",
  aceptado: "Validado",
  descartado: "Descartado",
};
