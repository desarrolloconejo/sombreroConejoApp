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
  | "usuario.clave_pedida"
  | "usuario.clave_recuperada"
  | "usuario.foto_cambiada"
  | "usuario.perfil_editado"
  | "usuario.dos_pasos_activados"
  | "usuario.dos_pasos_desactivados"
  | "usuario.dos_pasos_retirados"
  | "usuario.dos_pasos_omitidos"
  | "empresa.creada"
  | "empresa.editada"
  | "empresa.activada"
  | "empresa.desactivada"
  | "empresa.ejecutivo_asignado"
  | "empresa.ejecutivo_quitado"
  | "correo.entregado_a_mano"
  | "correo.reintentado"
  | "tasa.registrada"
  | "tasa.rechazada"
  | "proyecto.creado"
  | "proyecto.editado"
  | "proyecto.estado_cambiado"
  | "pieza.creada"
  | "pieza.editada"
  | "pieza.cancelada"
  | "pieza.copy_editado"
  | "pieza.comentada"
  | "fase.completada"
  | "fase.regresada"
  | "fase.planificada"
  | "tarea.creada"
  | "tarea.editada"
  | "tarea.lista"
  | "tarea.reabierta"
  | "tarea.quitada"
  | "version.subida"
  | "version.enviada"
  | "pieza.aprobada"
  | "pieza.correccion_pedida"
  | "pieza.ruta_ajustada"
  | "presupuesto.creado"
  | "presupuesto.editado"
  | "presupuesto.enviado"
  | "presupuesto.aprobado"
  | "presupuesto.rechazado"
  | "proforma.creada"
  | "proforma.editada"
  | "proforma.emitida"
  | "proforma.anulada"
  | "proforma.recurrencia_cambiada"
  | "brief.creado"
  | "brief.enviado"
  | "brief.version_enviada"
  | "brief.aceptado"
  | "brief.a_presupuesto"
  | "brief.descartado"
  | "brief.validado"
  | "brief.aclaracion"
  | "brief.fecha_propuesta"
  | "enlace_brief.creado"
  | "enlace_brief.revocado"
  | "ajustes_finanzas.editados"
  | "ajustes_finanzas.numeracion"
  | "medio_pago.creado"
  | "medio_pago.editado"
  | "formato_impresion.creado"
  | "formato_impresion.editado"
  | "formato_impresion.habitual"
  | "factura.emitida"
  | "factura.anulada"
  | "factura.impresa"
  | "pago.reportado"
  | "pago.confirmado"
  | "pago.rechazado";

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
  "usuario.clave_pedida": "Pidio un enlace para una contrasena nueva",
  "usuario.clave_recuperada": "Puso una contrasena nueva con el enlace del correo",
  "usuario.foto_cambiada": "Cambio su foto de perfil",
  "usuario.perfil_editado": "Edito su perfil",
  "usuario.dos_pasos_activados": "Activo la verificacion en dos pasos",
  "usuario.dos_pasos_desactivados": "Desactivo la verificacion en dos pasos",
  "usuario.dos_pasos_retirados": "Un administrador le retiro los dos pasos",
  "usuario.dos_pasos_omitidos": "Prefirio no usar la verificacion en dos pasos",
  "empresa.creada": "Empresa creada",
  "empresa.editada": "Empresa editada",
  "empresa.activada": "Empresa reactivada",
  "empresa.desactivada": "Empresa desactivada",
  "empresa.ejecutivo_asignado": "Ejecutivo asignado a la empresa",
  "empresa.ejecutivo_quitado": "Ejecutivo retirado de la empresa",
  "correo.entregado_a_mano": "Correo entregado a mano",
  "correo.reintentado": "Reintento de envio de un correo",
  "tasa.registrada": "Tasa de cambio registrada",
  "tasa.rechazada": "Lectura de la tasa rechazada",
  "proyecto.creado": "Proyecto creado",
  "proyecto.editado": "Proyecto editado",
  "proyecto.estado_cambiado": "Cambio de estado de un proyecto",
  "pieza.creada": "Pieza anadida",
  "pieza.editada": "Pieza editada",
  "pieza.cancelada": "Pieza cancelada",
  "pieza.copy_editado": "Copy de una pieza editado",
  "pieza.comentada": "Comentario interno en una pieza",
  "fase.completada": "Fase completada",
  "fase.regresada": "Fase regresada",
  "fase.planificada": "Fecha o responsable de una fase",
  "tarea.creada": "Tarea creada",
  "tarea.editada": "Tarea editada",
  "tarea.lista": "Tarea marcada como lista",
  "tarea.reabierta": "Tarea reabierta",
  "tarea.quitada": "Tarea quitada",
  "version.subida": "Version subida",
  "version.enviada": "Version marcada para el cliente",
  "pieza.aprobada": "Pieza aprobada por el cliente",
  "pieza.correccion_pedida": "El cliente pidio una correccion",
  "pieza.ruta_ajustada": "Ruta de una correccion ajustada",
  "presupuesto.creado": "Presupuesto creado",
  "presupuesto.editado": "Presupuesto editado",
  "presupuesto.enviado": "Presupuesto enviado al cliente",
  "presupuesto.aprobado": "Presupuesto aprobado",
  "presupuesto.rechazado": "Presupuesto rechazado",
  "proforma.creada": "Proforma creada",
  "proforma.editada": "Proforma editada",
  "proforma.emitida": "Proforma emitida",
  "proforma.anulada": "Proforma anulada",
  "proforma.recurrencia_cambiada": "Recurrencia de una proforma cambiada",
  "brief.creado": "Brief empezado",
  "brief.enviado": "Brief enviado",
  "brief.version_enviada": "Version nueva de un brief enviada",
  "brief.aceptado": "Brief aceptado: proyecto abierto",
  "brief.a_presupuesto": "Brief pasado a presupuesto",
  "brief.descartado": "Brief descartado",
  "brief.validado": "Brief validado",
  "brief.aclaracion": "Aclaracion en un brief",
  "brief.fecha_propuesta": "Fecha de entrega propuesta",
  "enlace_brief.creado": "Enlace de brief para un prospecto",
  "enlace_brief.revocado": "Enlace de brief revocado",
  "ajustes_finanzas.editados": "Ajustes de finanzas cambiados",
  "ajustes_finanzas.numeracion": "Numeracion de facturas cambiada",
  "medio_pago.creado": "Medio de pago creado",
  "medio_pago.editado": "Medio de pago cambiado",
  "formato_impresion.creado": "Formato de impresion creado",
  "formato_impresion.editado": "Formato de impresion cambiado",
  "formato_impresion.habitual": "Formato de impresion habitual cambiado",
  "factura.emitida": "Factura emitida",
  "factura.anulada": "Factura anulada",
  "factura.impresa": "Factura impresa",
  "pago.reportado": "Pago reportado",
  "pago.confirmado": "Pago confirmado",
  "pago.rechazado": "Pago rechazado",
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
  proyecto: "Proyectos",
  pieza: "Piezas",
  fase: "Fases",
  tarea: "Tareas",
  version: "Versiones",
  presupuesto: "Presupuestos",
  proforma: "Proformas",
  brief: "Briefs",
  enlace_brief: "Enlaces de brief",
  ajustes_finanzas: "Ajustes de finanzas",
  medio_pago: "Medios de pago",
  formato_impresion: "Formatos de impresion",
  factura: "Facturas",
  pago: "Pagos",
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
