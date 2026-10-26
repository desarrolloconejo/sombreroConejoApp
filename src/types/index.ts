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
  EstadoDosPasos,
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

export {
  NOMBRES_DE_ESTADO_PROYECTO,
  NOMBRES_DE_TIPO_PIEZA,
  NOMBRES_DE_ESTADO_FASE,
  NOMBRES_DE_ALERTA,
  NOMBRES_DE_CORRECCION,
} from "./portal";
export type {
  TipoProyecto,
  EstadoProyecto,
  TipoPieza,
  EstadoPieza,
  NumeroFase,
  FaseDeTrabajo,
  EstadoFase,
  EstadoTarea,
  TipoCorreccion,
  AlertaPieza,
  PersonaBreve,
  PersonaDeEquipo,
  Asignacion,
  AvanceProyecto,
  AlertasProyecto,
  Proyecto,
  FasePieza,
  AvancePieza,
  Pieza,
  Tarea,
  TareaAsignada,
  FaseACargo,
  PiezaEsperandoCliente,
  ComentarioPieza,
  DatosNuevaPieza,
  DatosNuevaTarea,
  DatosNuevoProyecto,
  FiltrosProyectos,
  OrigenVersion,
  DecisionRevision,
  Version,
  NuevaVersion,
  Revision,
} from "./portal";

export type {
  Columna,
  OpcionFiltro,
  DefinicionFiltro,
  Direccion,
  EstadoListado,
  ConfigListado,
} from "./listado";

export { NOMBRES_DE_SITUACION, NOMBRES_DE_ESTADO_PROFORMA } from "./finanzas";
export type {
  EstadoPresupuesto,
  SituacionPresupuesto,
  EstadoProforma,
  TipoDocumento,
  Importes,
  Renglon,
  RenglonNuevo,
  Presupuesto,
  Proforma,
  ProyectoDeProforma,
  DatosNuevoPresupuesto,
  FiltrosPresupuestos,
  FiltrosProformas,
} from "./finanzas";

export { NOMBRES_DE_ESTADO_BRIEF } from "./brief";
export type {
  EstadoBrief,
  TipoPregunta,
  OpcionPregunta,
  FilaMatriz,
  Pregunta,
  PasoBrief,
  CondicionRegla,
  ReglaBrief,
  FormatoBrief,
  ValorRespuesta,
  Respuestas,
  RespuestaCongelada,
  Brief,
  VersionBrief,
  AclaracionBrief,
  EnlaceBrief,
} from "./brief";

export {
  NOMBRES_DE_ESTADO_COBRO,
  NOMBRES_DE_TIPO_PAGO,
  NOMBRES_DE_ESTADO_PAGO,
  CAMPOS_FACTURA,
  COLUMNAS_FACTURA,
  NOMBRES_DE_CAMPO_FACTURA,
} from "./facturas";
export type {
  EstadoFactura,
  EstadoCobro,
  TipoPago,
  EstadoPago,
  MonedaPago,
  ParteFactura,
  Factura,
  RenglonFactura,
  Pago,
  DatosNuevoPago,
  MedioPago,
  DatosMedioPago,
  AjustesFinanzas,
  Numeracion,
  PosicionCampo,
  ColumnaRenglon,
  CampoFactura,
  ColumnaFactura,
  FormatoImpresion,
  DatosFormatoImpresion,
  FiltrosFacturas,
  CobranzaEmpresa,
  DatosFiscalesEmpresa,
} from "./facturas";
