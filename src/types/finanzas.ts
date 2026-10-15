/**
 * Presupuestos y proformas (etapa 5 del plan del portal, seccion 7).
 *
 * Los importes son TEXTO decimal, nunca `number`: `pg` devuelve NUMERIC como
 * texto y asi se queda. Un `number` redondearia centimos, y con dinero eso no
 * se perdona. Las cuentas las hace la base; en el navegador solo hay una
 * vista previa (src/lib/finanzas/calculo.ts).
 *
 * Los conjuntos cerrados son espejo de los CHECK de db/schema.sql: si se
 * anade un valor hay que tocar los dos sitios.
 */

/** Espejo de `presupuestos_estado_valido`. */
export type EstadoPresupuesto = "borrador" | "enviado" | "aprobado" | "rechazado";

/**
 * Lo que se muestra de un presupuesto. «Vencido» no se guarda: es un enviado
 * cuya validez ya paso, y sale de la fecha.
 */
export type SituacionPresupuesto = EstadoPresupuesto | "vencido";

/** Espejo de `proformas_estado_valido`. */
export type EstadoProforma = "borrador" | "emitida" | "facturada" | "anulada";

/** Los documentos que tienen renglones. */
export type TipoDocumento = "presupuesto" | "proforma";

/** Los importes de un documento, en dolares, como texto decimal. */
export type Importes = {
  baseImponible: string;
  montoExento: string;
  ivaPct: string;
  ivaMonto: string;
  total: string;
};

/** Un renglon guardado. */
export type Renglon = {
  id: number;
  orden: number;
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
  exento: boolean;
  subtotal: string;
};

/** Un renglon tal como sale del editor, antes de que la base lo calcule. */
export type RenglonNuevo = {
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
  exento: boolean;
};

export type Presupuesto = Importes & {
  id: number;
  numero: number;
  empresaId: number;
  empresaNombre: string;
  proyectoId: number | null;
  proyectoNombre: string | null;
  titulo: string;
  estado: EstadoPresupuesto;

  /** Enviado y con la validez ya pasada. */
  vencido: boolean;
  validoHasta: string;
  notas: string | null;
  creadoPorNombre: string;
  creadoEn: Date;
  enviadoEn: Date | null;
  resueltoEn: Date | null;
  resueltoPorNombre: string | null;

  /** Lo registro un operador porque la empresa no tiene a nadie con cuenta. */
  aNombreDelCliente: boolean;
  motivoRechazo: string | null;

  /** El brief del que nace, si nace de uno. */
  briefId: number | null;
  briefCodigo: string | null;

  /** La proforma que salio de el, si ya se genero. */
  proformaId: number | null;
  proformaNumero: number | null;
};

export type Proforma = Importes & {
  id: number;
  numero: number;
  empresaId: number;
  empresaNombre: string;
  presupuestoId: number | null;
  presupuestoNumero: number | null;

  /** La recurrente de la que es copia. */
  origenId: number | null;
  origenNumero: number | null;
  titulo: string;
  estado: EstadoProforma;
  recurrente: boolean;
  proximaEmision: string | null;
  notas: string | null;
  creadoPorNombre: string;
  creadoEn: Date;
  emitidaEn: Date | null;
  anuladaEn: Date | null;
  motivoAnulacion: string | null;
};

/** Un proyecto ligado a una proforma, o que se le puede ligar. */
export type ProyectoDeProforma = {
  id: number;
  nombre: string;
  estado: string;
};

export type DatosNuevoPresupuesto = {
  empresaId: number;
  briefId?: number | null;
  proyectoId: number | null;
  titulo: string;
  validoHasta: string;
  notas: string | null;
};

export type FiltrosPresupuestos = {
  busqueda?: string;
  situacion?: SituacionPresupuesto[];
  empresaId?: number[];
  orden: "numero" | "creadoEn" | "total";
  direccion: "asc" | "desc";
  pagina: number;
  porPagina: number;
};

export type FiltrosProformas = {
  busqueda?: string;
  estado?: EstadoProforma[];
  empresaId?: number[];
  soloRecurrentes?: boolean;
  orden: "numero" | "creadoEn" | "total";
  direccion: "asc" | "desc";
  pagina: number;
  porPagina: number;
};

export const NOMBRES_DE_SITUACION: Record<SituacionPresupuesto, string> = {
  borrador: "Borrador",
  enviado: "Por aprobar",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  vencido: "Vencido",
};

export const NOMBRES_DE_ESTADO_PROFORMA: Record<EstadoProforma, string> = {
  borrador: "Borrador",
  emitida: "Emitida",
  facturada: "Facturada",
  anulada: "Anulada",
};
