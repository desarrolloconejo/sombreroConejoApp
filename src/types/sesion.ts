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

/** Errores de validacion, indexados por el nombre del campo del formulario. */
export type ErroresCampo = Record<string, string>;

/**
 * Respuesta de una action hacia el formulario que la invoco.
 * Es la forma que consume useActionState, asi que debe ser serializable.
 */
export type EstadoFormulario = {
  ok: boolean;
  mensaje?: string;
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
};

/** Estado inicial de cualquier formulario, antes del primer envio. */
export const ESTADO_INICIAL: EstadoFormulario = { ok: false };
