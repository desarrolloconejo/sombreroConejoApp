/**
 * Las notificaciones que la aplicacion sabe dar, con la forma `entidad.hecho`.
 *
 * Son lo que se lee en la campana del panel. No confundir con los «avisos»
 * de `ProveedorAvisos`, que son los mensajes flotantes que confirman una
 * accion y desaparecen: aquellos viven en el navegador, estas en la base.
 *
 * La tabla solo comprueba la forma; la lista vive aqui. Un modulo nuevo anade
 * las suyas a esta union.
 */
export type TipoNotificacion =
  | "cuenta.bloqueada"
  | "cuenta.clave_restablecida"
  | "correo.fallido"
  | "tasa.rechazada";

/** Lo que hay que saber para notificar. Los destinatarios van aparte. */
export type NuevaNotificacion = {
  tipo: TipoNotificacion;
  titulo: string;
  cuerpo?: string | null;

  /** A donde lleva al pulsarla. Solo rutas del panel. */
  href?: string | null;
  empresaId?: number | null;
};

/** Una notificacion tal como se pinta en la campana. */
export type Notificacion = {
  id: number;
  tipo: string;
  titulo: string;
  cuerpo: string | null;
  href: string | null;
  creadoEn: Date;
  leida: boolean;
};

/** Lo que la campana recibe del layout. */
export type ResumenDeNotificaciones = {
  recientes: Notificacion[];
  sinLeer: number;
};
