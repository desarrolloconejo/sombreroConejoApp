/**
 * Punto unico de importacion de los tipos del proyecto.
 *
 *   import type { UsuarioCompleto, Sesion } from "@/types";
 */
export type {
  Tema,
  TipoUsuario,
  NombreRol,
  SlugCargo,
  Usuario,
  UsuarioCompleto,
  UsuarioConCredenciales,
  DatosNuevoUsuario,
  DatosPerfil,
  OrdenUsuarios,
  FiltrosUsuarios,
  Pagina,
} from "./usuario";

export type {
  Rol,
  Cargo,
  Empresa,
  DatosNuevaEmpresa,
  OrdenEmpresas,
  FiltrosEmpresas,
  ResumenEmpresa,
  NombreEmpresa,
  Trabajador,
  Cliente,
} from "./organizacion";

export { ESTADO_AUDITORIA } from "./hooks";
export type {
  Sesion,
  MotivoRevocacion,
  SesionAbierta,
  EstadoRenovacion,
  ErroresCampo,
  EstadoFormulario,
} from "./sesion";
export { ESTADO_INICIAL } from "./sesion";

export type {
  SlugTerritorio,
  SlugMecanismo,
  SlugObjetivo,
  SlugPlataforma,
  EstadoFicha,
  Territorio,
  Mecanismo,
  Objetivo,
  Apertura,
  DatosNuevaApertura,
  ReglaHook,
  DatosNuevaRegla,
  LimitesAuditoria,
  EstadoControl,
  EstadoAuditoria,
  Control,
  Veredicto,
  ResultadoAuditoria,
  EntradaAuditoria,
  FichaHook,
  ResultadoHook,
  FichaConResultado,
  ReferenciaHook,
  AccionEdicion,
  EdicionFicha,
  DatosNuevaReferencia,
} from "./hooks";

export { NOMBRES_DE_ACCION, MODULOS_DE_AUDITORIA } from "./auditoria";
export type {
  AccionAuditoria,
  ModuloAuditoria,
  ValoresAuditoria,
  NuevaLineaAuditoria,
  LineaAuditoria,
  PeriodoAuditoria,
  FiltrosAuditoria,
} from "./auditoria";

export { NOMBRES_DE_CORREO, NOMBRES_DE_ESTADO_CORREO } from "./correo";
export type {
  ModoExterno,
  TipoCorreo,
  EstadoCorreo,
  NuevoCorreo,
  CorreoSalida,
  FiltrosCorreos,
} from "./correo";

export type {
  TipoNotificacion,
  NuevaNotificacion,
  Notificacion,
  ResumenDeNotificaciones,
} from "./notificacion";

export type {
  FuenteTasa,
  OrigenTasa,
  TasaLeida,
  LecturaDeTasas,
  TasaDeCambio,
  ResultadoDeTasas,
} from "./tasa";

export type {
  Columna,
  OpcionFiltro,
  DefinicionFiltro,
  Direccion,
  EstadoListado,
  ConfigListado,
} from "./listado";
