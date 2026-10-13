/** De donde sale una tasa. Espejo del CHECK `tasas_cambio_fuente_valida`. */
export type FuenteTasa = "bcv";

/** Como llego una tasa: la leyo la aplicacion, o la escribio una persona. */
export type OrigenTasa = "automatica" | "manual";

/**
 * Una tasa tal como se lee de la fuente.
 *
 * El valor es TEXTO, no numero: son bolivares por unidad de moneda con ocho
 * decimales, y un `number` de JavaScript los redondearia. Viaja como texto
 * hasta la base, que lo guarda en NUMERIC, y con ella se hacen las cuentas.
 */
export type TasaLeida = {
  /** Codigo ISO de tres letras: USD, EUR. */
  moneda: string;

  /** Decimal con punto, sin separador de miles: "876.79760000". */
  valor: string;
};

/** Lo que devuelve una lectura de la fuente. */
export type LecturaDeTasas = {
  fuente: FuenteTasa;

  /** El dia para el que rigen, como AAAA-MM-DD. No es el dia en que se leyo. */
  fechaValor: string;
  tasas: TasaLeida[];
};

/** Una tasa guardada. */
export type TasaDeCambio = {
  id: number;
  fuente: FuenteTasa;
  moneda: string;
  fechaValor: string;
  valor: string;
  origen: OrigenTasa;
  obtenidaEn: Date;
};

/** En que acabo un intento de actualizar las tasas. */
export type ResultadoDeTasas =
  | { ok: true; fechaValor: string; nuevas: number; leidas: number }
  | { ok: false; motivo: string };
