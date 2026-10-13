/**
 * Lo que se puede anotar en la auditoria.
 *
 * Es un conjunto cerrado y vive aqui: la tabla solo comprueba la forma
 * (`entidad.hecho`), para no tener que migrarla con cada modulo. Un modulo
 * nuevo anade sus acciones a esta union y a `NOMBRES_DE_ACCION`.
 */
export type AccionAuditoria =
  | "sesion.inicio"
  | "sesion.fallo"
  | "sesion.bloqueo"
  | "sesion.cierre"
  | "sesion.otras_cerradas"
  | "usuario.creado"
  | "usuario.editado"
  | "usuario.activado"
  | "usuario.desactivado"
  | "usuario.clave_cambiada"
  | "usuario.clave_restablecida"
  | "usuario.perfil_editado"
  | "usuario.dos_pasos_activados"
  | "usuario.dos_pasos_desactivados"
  | "usuario.dos_pasos_retirados"
  | "usuario.dos_pasos_omitidos"
  | "empresa.creada"
  | "empresa.editada"
  | "empresa.activada"
  | "empresa.desactivada"
  | "correo.entregado_a_mano"
  | "correo.reintentado"
  | "tasa.registrada"
  | "tasa.rechazada";

/** Como se lee cada accion en pantalla. */
export const NOMBRES_DE_ACCION: Record<AccionAuditoria, string> = {
  "sesion.inicio": "Inicio de sesion",
  "sesion.fallo": "Intento de acceso fallido",
  "sesion.bloqueo": "Cuenta bloqueada por intentos",
  "sesion.cierre": "Cierre de sesion",
  "sesion.otras_cerradas": "Cerro sus otras sesiones",
  "usuario.creado": "Usuario creado",
  "usuario.editado": "Usuario editado",
  "usuario.activado": "Usuario reactivado",
  "usuario.desactivado": "Usuario desactivado",
  "usuario.clave_cambiada": "Cambio su contrasena",
  "usuario.clave_restablecida": "Contrasena restablecida",
  "usuario.perfil_editado": "Edito su perfil",
  "usuario.dos_pasos_activados": "Activo la verificacion en dos pasos",
  "usuario.dos_pasos_desactivados": "Desactivo la verificacion en dos pasos",
  "usuario.dos_pasos_retirados": "Un administrador le retiro los dos pasos",
  "usuario.dos_pasos_omitidos": "Prefirio no usar la verificacion en dos pasos",
  "empresa.creada": "Empresa creada",
  "empresa.editada": "Empresa editada",
  "empresa.activada": "Empresa reactivada",
  "empresa.desactivada": "Empresa desactivada",
  "correo.entregado_a_mano": "Correo entregado a mano",
  "correo.reintentado": "Reintento de envio de un correo",
  "tasa.registrada": "Tasa de cambio registrada",
  "tasa.rechazada": "Lectura de la tasa rechazada",
};

/**
 * Los modulos por los que se filtra: la parte de la accion antes del punto.
 * Las claves son las entidades; los valores, como se nombran en el filtro.
 */
export const MODULOS_DE_AUDITORIA = {
  sesion: "Acceso",
  usuario: "Usuarios",
  empresa: "Empresas",
  correo: "Correos",
  tasa: "Tasa de cambio",
} as const;

export type ModuloAuditoria = keyof typeof MODULOS_DE_AUDITORIA;

/** Los valores de un cambio, campo a campo. Nunca contrasenas ni tokens. */
export type ValoresAuditoria = Record<string, string | number | boolean | null>;

/** Lo que una action entrega para dejar constancia de lo que hizo. */
export type NuevaLineaAuditoria = {
  /** Quien. Nulo solo cuando no hay nadie identificado. */
  actorId: number | null;
  actorRol: string | null;
  actorCargo: string | null;

  accion: AccionAuditoria;

  entidad?: string | null;
  entidadId?: number | null;
  empresaId?: number | null;

  antes?: ValoresAuditoria | null;
  despues?: ValoresAuditoria | null;

  ip: string | null;
};

/** Una linea tal como se lista y se muestra. */
export type LineaAuditoria = {
  id: number;
  accion: string;
  creadoEn: Date;

  actorId: number | null;
  actorNombre: string | null;
  actorEmail: string | null;
  actorRol: string | null;
  actorCargo: string | null;

  entidad: string | null;
  entidadId: number | null;

  empresaId: number | null;
  empresaNombre: string | null;

  antes: ValoresAuditoria | null;
  despues: ValoresAuditoria | null;
  ip: string | null;
};

/** Hace cuanto, como maximo, ocurrio lo que se lista. */
export type PeriodoAuditoria = "hoy" | "semana" | "mes";

export type FiltrosAuditoria = {
  busqueda?: string;
  modulo?: ModuloAuditoria[];
  periodo?: PeriodoAuditoria;
  direccion?: "asc" | "desc";
  pagina?: number;
  porPagina?: number;
};
