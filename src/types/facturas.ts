/**
 * Facturas, pagos y cobranza (etapa 7 del plan del portal, seccion 7).
 *
 * Como en presupuestos y proformas, los importes y las tasas son TEXTO
 * decimal: nunca pasan por `number`. Las cuentas las hace la base.
 *
 * Los conjuntos cerrados son espejo de los CHECK de db/schema.sql: si se
 * anade un valor hay que tocar los dos sitios.
 */

/** Espejo de `facturas_estado_valido`. */
export type EstadoFactura = "emitida" | "anulada";

/** Lo que dice `finanzas.v_estado_cobro_factura`. */
export type EstadoCobro = "pendiente" | "parcial" | "pagada" | "anulada";

/** Espejo de `pagos_tipo_valido`. */
export type TipoPago = "pago" | "retencion_iva" | "retencion_islr";

/** Espejo de `pagos_estado_valido`. */
export type EstadoPago = "por_confirmar" | "confirmado" | "rechazado";

/** Espejo de `pagos_moneda_valida` y de las monedas de un medio de pago. */
export type MonedaPago = "USD" | "VES";

/** Las copias congeladas del emisor y del cliente en una factura. */
export type ParteFactura = {
  razonSocial: string;
  rif: string;
  domicilio: string;
};

export type Factura = {
  id: number;
  serie: string;
  numero: number;
  numeroControl: string;
  empresaId: number;
  empresaNombre: string;
  proformaId: number;
  proformaNumero: number;
  estado: EstadoFactura;
  fechaEmision: string;
  venceEl: string;

  tasa: string;
  tasaFuente: string;
  tasaFecha: string;
  totalUsd: string;

  baseImponible: string;
  montoExento: string;
  ivaPct: string;
  ivaMonto: string;
  total: string;
  retencionIvaPct: string | null;
  retencionEsperada: string;

  emisor: ParteFactura;
  cliente: ParteFactura;

  emitidaPorNombre: string;
  emitidaEn: Date;
  impresaEn: Date | null;
  anuladaEn: Date | null;
  motivoAnulacion: string | null;

  /** De `v_estado_cobro_factura`. */
  cobro: EstadoCobro;
  pagado: string;
  retenido: string;
  saldo: string;
  porConfirmar: number;
  retencionAbierta: boolean;

  /** Emitida, con saldo y con la fecha de vencimiento ya pasada. */
  vencida: boolean;
};

export type RenglonFactura = {
  orden: number;
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
  exento: boolean;
  subtotal: string;
};

export type Pago = {
  id: number;
  facturaId: number;
  facturaNumero: string;
  empresaNombre: string;
  tipo: TipoPago;
  medioId: number | null;
  medioNombre: string | null;
  referencia: string | null;
  fechaPago: string;
  monto: string;
  moneda: MonedaPago;
  tieneComprobante: boolean;
  estado: EstadoPago;
  montoAplicado: string | null;
  tasaAplicada: string | null;
  motivoRechazo: string | null;
  reportadoPorNombre: string;
  reportadoEn: Date;
  aNombreDelCliente: boolean;
  resueltoPorNombre: string | null;
  resueltoEn: Date | null;
};

export type DatosNuevoPago = {
  facturaId: number;
  tipo: TipoPago;
  medioId: number | null;
  referencia: string | null;
  fechaPago: string;
  monto: string;
  moneda: MonedaPago;
  comprobanteArchivo: string | null;
  comprobanteMime: string | null;
  aNombreDelCliente: boolean;
};

export type MedioPago = {
  id: number;
  nombre: string;
  monedas: MonedaPago[];
  pideReferencia: boolean;
  datosParaPagar: string | null;
  orden: number;
  activo: boolean;
};

export type DatosMedioPago = Omit<MedioPago, "id">;

/** Lo que se configura una vez (finanzas.ajustes). */
export type AjustesFinanzas = {
  emisorRazonSocial: string | null;
  emisorRif: string | null;
  emisorDomicilio: string | null;
  ivaPct: string;
  islrActivo: boolean;
  islrPct: string;
  igtfActivo: boolean;
  igtfPct: string;
  diasCredito: number;
};

/** Los proximos numeros. Solo suben. */
export type Numeracion = {
  serie: string;
  proximaFactura: number;
  proximoControl: number;
  controlPrefijo: string;
  controlHasta: number;
};

/** Una posicion en la hoja, en milimetros desde la esquina superior izquierda. */
export type PosicionCampo = {
  x: number;
  y: number;
  ancho: number;
  alinear?: "izquierda" | "derecha";
};

export type ColumnaRenglon = Omit<PosicionCampo, "y">;

/** Los datos de la factura que se colocan en la hoja. */
export type CampoFactura =
  | "numero"
  | "fecha"
  | "vence"
  | "razonSocial"
  | "rif"
  | "domicilio"
  | "tasa"
  | "referenciaUsd"
  | "baseImponible"
  | "exento"
  | "ivaPct"
  | "ivaMonto"
  | "total";

export type ColumnaFactura = "cantidad" | "descripcion" | "precio" | "subtotal";

export type FormatoImpresion = {
  id: number;
  nombre: string;
  anchoMm: string;
  altoMm: string;
  fuentePt: string;
  campos: Partial<Record<CampoFactura, PosicionCampo>>;
  renglones: {
    y_inicio: number;
    alto_mm: number;
    max: number;
    columnas: Partial<Record<ColumnaFactura, ColumnaRenglon>>;
  };
  habitual: boolean;
  activo: boolean;
};

export type DatosFormatoImpresion = Omit<FormatoImpresion, "id" | "habitual">;

export type FiltrosFacturas = {
  busqueda?: string;
  cobro?: EstadoCobro[];
  empresaId?: number[];
  orden: "numero" | "fechaEmision" | "total";
  direccion: "asc" | "desc";
  pagina: number;
  porPagina: number;
};

/** La deuda de una empresa por antiguedad, en bolivares. */
export type CobranzaEmpresa = {
  empresaId: number;
  empresaNombre: string;
  facturas: number;
  porVencer: string;
  dias0a30: string;
  dias31a60: string;
  dias61a90: string;
  mas90: string;
  total: string;
  retencionesAbiertas: number;
};

export const NOMBRES_DE_ESTADO_COBRO: Record<EstadoCobro, string> = {
  pendiente: "Pendiente",
  parcial: "Pago parcial",
  pagada: "Pagada",
  anulada: "Anulada",
};

export const NOMBRES_DE_TIPO_PAGO: Record<TipoPago, string> = {
  pago: "Pago",
  retencion_iva: "Retencion de IVA",
  retencion_islr: "Retencion de ISLR",
};

export const NOMBRES_DE_ESTADO_PAGO: Record<EstadoPago, string> = {
  por_confirmar: "Por confirmar",
  confirmado: "Confirmado",
  rechazado: "Rechazado",
};

export const CAMPOS_FACTURA: readonly CampoFactura[] = [
  "numero",
  "fecha",
  "vence",
  "razonSocial",
  "rif",
  "domicilio",
  "tasa",
  "referenciaUsd",
  "baseImponible",
  "exento",
  "ivaPct",
  "ivaMonto",
  "total",
];

export const COLUMNAS_FACTURA: readonly ColumnaFactura[] = ["cantidad", "descripcion", "precio", "subtotal"];

export const NOMBRES_DE_CAMPO_FACTURA: Record<CampoFactura | ColumnaFactura, string> = {
  numero: "Numero de factura",
  fecha: "Fecha de emision",
  vence: "Vencimiento",
  razonSocial: "Razon social del cliente",
  rif: "RIF del cliente",
  domicilio: "Domicilio fiscal del cliente",
  tasa: "Tasa de cambio",
  referenciaUsd: "Total de referencia en dolares",
  baseImponible: "Base imponible",
  exento: "Monto exento",
  ivaPct: "Porcentaje de IVA",
  ivaMonto: "IVA",
  total: "Total",
  cantidad: "Cantidad",
  descripcion: "Descripcion",
  precio: "Precio unitario",
  subtotal: "Subtotal del renglon",
};
