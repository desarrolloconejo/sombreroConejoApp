/**
 * Como se trata un servicio externo.
 *
 *   simulado  no se llama a nadie: se devuelve una respuesta fija y lo que
 *             cambia se guarda en la base.
 *   real      se llama al servicio de verdad.
 *
 * Se elige por variable de entorno, una por servicio.
 */
export type ModoExterno = "simulado" | "real";

/**
 * Los correos que la aplicacion sabe escribir.
 *
 * La tabla solo comprueba la forma: cada modulo anade los suyos aqui y en
 * `NOMBRES_DE_CORREO`, igual que con las acciones de la auditoria.
 */
export type TipoCorreo =
  | "bienvenida"
  | "clave_restablecida"
  | "pieza_en_revision"
  | "presupuesto_enviado"
  | "brief_enviado";

/** Como se lee cada tipo en pantalla. */
export const NOMBRES_DE_CORREO: Record<TipoCorreo, string> = {
  bienvenida: "Bienvenida",
  clave_restablecida: "Contrasena restablecida",
  pieza_en_revision: "Pieza lista para revisar",
  presupuesto_enviado: "Presupuesto para aprobar",
  brief_enviado: "Copia de un brief",
};

/**
 * En que quedo un correo. Espejo del CHECK `correos_salida_estado_valido`.
 *
 *   simulado   no se envio: esta para leerlo y entregarlo a mano.
 *   pendiente  se va a enviar; la entrega ocurre tras confirmar el cambio.
 *   enviado    el servicio lo acepto.
 *   fallido    el servicio lo rechazo o no respondio. Se puede reintentar.
 */
export type EstadoCorreo = "simulado" | "pendiente" | "enviado" | "fallido";

/** Como se lee cada estado en pantalla. */
export const NOMBRES_DE_ESTADO_CORREO: Record<EstadoCorreo, string> = {
  simulado: "Sin enviar",
  pendiente: "Pendiente",
  enviado: "Enviado",
  fallido: "Fallido",
};

/** Lo que hay que saber para escribir un correo en la bandeja de salida. */
export type NuevoCorreo = {
  para: string;
  paraUsuarioId?: number | null;
  empresaId?: number | null;
  tipo: TipoCorreo;
  asunto: string;

  /** Texto plano. Nunca lleva contrasenas ni tokens. */
  cuerpo: string;
};

/** Un correo tal como se lista y se muestra en la bandeja de salida. */
export type CorreoSalida = {
  id: number;
  para: string;
  paraNombre: string | null;
  empresaNombre: string | null;

  tipo: string;
  asunto: string;
  cuerpo: string;

  modo: ModoExterno;
  estado: EstadoCorreo;
  error: string | null;
  intentos: number;

  creadoPorNombre: string | null;
  creadoEn: Date;
  enviadoEn: Date | null;

  entregadoPorNombre: string | null;
  entregadoEn: Date | null;
};

export type FiltrosCorreos = {
  busqueda?: string;
  estado?: EstadoCorreo[];

  /** Solo los simulados que nadie ha entregado todavia a mano. */
  porEntregar?: boolean;

  direccion?: "asc" | "desc";
  pagina?: number;
  porPagina?: number;
};
