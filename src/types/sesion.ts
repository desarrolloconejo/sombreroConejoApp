import type { NombreRol, SlugCargo, TipoUsuario } from "./usuario";

/**
 * Lo que viaja dentro del token de sesion.
 *
 * Se guarda lo minimo para poder decidir el acceso sin consultar la base en
 * cada peticion. Nada sensible: el token es legible por cualquiera que tenga
 * la cookie, la firma solo garantiza que no fue alterado.
 */
export type Sesion = {
  usuarioId: number;

  /**
   * La fila de la tabla sesiones a la que pertenece este token.
   *
   * Es lo que permite cerrar una sesion desde el servidor: las guardias
   * comprueban en cada peticion que esa fila siga viva.
   */
  sesionId: number;

  /** Cuando caduca este token de acceso, en milisegundos desde la epoca. */
  accesoCaducaEn: number;

  email: string;
  nombre: string;
  tipo: TipoUsuario;
  rol: NombreRol;

  /**
   * El ambito de contenido: cargo para trabajadores, empresa para clientes.
   *
   * Viaja en el token para que el proxy pueda enrutar sin consultar la base.
   * OJO: es una foto del momento en que se inicio sesion. Si un administrador
   * cambia el cargo o la empresa de alguien, su token sigue diciendo lo
   * anterior hasta que caduque.
   *
   * Por eso el proxy es la primera barrera y no la ultima: las pages y las
   * actions que filtran contenido leen el valor fresco con usuarioActual().
   */
  cargo: SlugCargo | null;
  empresaId: number | null;
};

/**
 * Por que se cerro una sesion desde el servidor.
 *
 * Es el espejo del CHECK `sesiones_motivo_valido` de db/schema.sql: si se
 * anade un motivo hay que tocar los dos sitios.
 */
export type MotivoRevocacion =
  | "salida"
  | "cerrada_por_usuario"
  | "clave_cambiada"
  | "clave_restablecida"
  | "usuario_desactivado"
  | "empresa_desactivada"
  | "vinculo_cambiado"
  | "token_reutilizado";

/** Una sesion viva, tal como se lista en Mi perfil. */
export type SesionAbierta = {
  id: number;
  navegador: string | null;
  creadaEn: Date;
  ultimoUso: Date;
  caducaEn: Date;
};

/**
 * Lo que devuelve la renovacion de la sesion al navegador.
 *
 * Solo las dos horas que necesita el reloj del cliente: ni el token ni nada
 * de la persona cruza por aqui.
 */
export type EstadoRenovacion =
  | { ok: true; accesoCaducaEn: number; sesionCaducaEn: number }
  | { ok: false };

/** Errores de validacion, indexados por el nombre del campo del formulario. */
export type ErroresCampo = Record<string, string>;

/**
 * Respuesta de una action hacia el formulario que la invoco.
 * Es la forma que consume useActionState, asi que debe ser serializable.
 */
export type EstadoFormulario = {
  ok: boolean;
  mensaje?: string;
  /** Se termino algo que cuenta (una fase): el aviso se celebra. */
  logro?: boolean;
  errores?: ErroresCampo;

  /**
   * Una contrasena provisional recien generada, para entregarla en mano.
   *
   * Va en su propio campo y no dentro de `mensaje` por una razon practica: es
   * un dato que hay que poder copiar, destacar y mostrar en una pantalla
   * aparte. Metida en una frase, lo unico que se puede hacer con ella es
   * leerla, y solo si te fijas.
   *
   * La usan el alta de usuarios y el restablecimiento de contrasena. Se
   * muestra UNA vez: en la base solo queda su hash.
   */
  credencial?: { email: string; password: string };

  /**
   * La ruta de un enlace privado recien generado (/brief/<token>), para
   * copiarla. Como la credencial, se muestra UNA vez: la base solo guarda el
   * hash del token, y ningun correo lo lleva.
   */
  enlace?: string;
};

/**
 * Lo que devuelven las actions de la verificacion en dos pasos.
 *
 * Extiende el estado normal con lo que solo se muestra UNA vez: el secreto
 * mientras se registra en la app, y los codigos de respaldo al activar.
 */
export type EstadoDosPasos = EstadoFormulario & {
  /** El secreto, en grupos, para quien lo teclea a mano. */
  secreto?: string;

  /** El enlace que registra la cuenta al abrirlo desde el telefono. */
  enlace?: string;

  /** Ese mismo enlace como codigo QR, para escanearlo desde otra pantalla. */
  qr?: { lado: number; trazo: string };

  /** Los codigos de respaldo recien generados. No se vuelven a mostrar. */
  respaldos?: string[];
};

/** Estado inicial de cualquier formulario, antes del primer envio. */
export const ESTADO_INICIAL: EstadoFormulario = { ok: false };
