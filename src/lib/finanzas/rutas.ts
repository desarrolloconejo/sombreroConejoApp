/**
 * Las rutas de finanzas, en un solo sitio. Las usan los enlaces, las
 * notificaciones y las revalidaciones de las actions.
 */

/** Lo que opera administracion: todos los presupuestos y proformas. */
export const RUTA_PRESUPUESTOS = "/dashboard/presupuestos";
export const RUTA_PROFORMAS = "/dashboard/proformas";

export function rutaPresupuesto(id: number): string {
  return `${RUTA_PRESUPUESTOS}/${id}`;
}

export function rutaProforma(id: number): string {
  return `${RUTA_PROFORMAS}/${id}`;
}

/** Lo que ve el cliente con permiso de finanzas: lo de su empresa. */
export const RUTA_FACTURACION = "/dashboard/facturacion";

export function rutaMiPresupuesto(id: number): string {
  return `${RUTA_FACTURACION}/presupuestos/${id}`;
}

export function rutaMiProforma(id: number): string {
  return `${RUTA_FACTURACION}/proformas/${id}`;
}

/** Lo que se configura: emisor, impuestos, numeracion, medios y formatos. */
export const RUTA_AJUSTES_FINANZAS = "/dashboard/ajustes-finanzas";

export function rutaFormatoImpresion(id: number): string {
  return `${RUTA_AJUSTES_FINANZAS}/formatos/${id}`;
}

/** Las facturas emitidas, los pagos por confirmar y la cobranza. */
export const RUTA_FACTURAS = "/dashboard/facturas";
export const RUTA_COBRANZA = "/dashboard/cobranza";

export function rutaFactura(id: number): string {
  return `${RUTA_FACTURAS}/${id}`;
}

export function rutaMiFactura(id: number): string {
  return `${RUTA_FACTURACION}/facturas/${id}`;
}
