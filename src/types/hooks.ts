/**
 * Tipos del modulo de Hooks.
 *
 * Los conjuntos cerrados (territorio, mecanismo, objetivo, plataforma, estado)
 * son uniones de literales y no tablas: la logica de la aplicacion depende de
 * que existan exactamente estos valores, igual que pasa con `SlugCargo`. Cada
 * uno tiene su CHECK espejo en db/schema.sql.
 */

/* ===========================================================================
   CONJUNTOS CERRADOS
   =========================================================================== */

/** La INTENCION del hook. Siete, de la A a la G. */
export type SlugTerritorio = "a" | "b" | "c" | "d" | "e" | "f" | "g";

/** COMO se demuestra. Ocho. */
export type SlugMecanismo =
  | "comparacion"
  | "numero"
  | "pregunta"
  | "dato"
  | "prueba_visual"
  | "antes_despues"
  | "coste"
  | "persona";

/** Que se busca con la pieza. Decide territorio, evidencia y metrica. */
export type SlugObjetivo =
  | "alcance"
  | "guardados"
  | "compartidos"
  | "comunidad"
  | "consideracion"
  | "accion";

export type SlugPlataforma = "reels" | "tiktok" | "shorts" | "anuncio";

/**
 * Donde esta la ficha dentro del recorrido.
 *
 * Son los tres hitos que dejan rastro, y de ellos sale el porcentaje que
 * muestra la raiz: 33, 66 y 100. El recorrido tiene seis pasos, pero tres de
 * ellos (manual, documentacion, historial) no cambian el estado de nada.
 */
export type EstadoFicha = "borrador" | "auditada" | "medida";

/* ===========================================================================
   CATALOGO
   =========================================================================== */

export type Territorio = {
  slug: SlugTerritorio;
  /** La letra que se muestra: "A", "B"... */
  letra: string;
  nombre: string;
};

export type Mecanismo = {
  slug: SlugMecanismo;
  nombre: string;
};

/**
 * Un objetivo y todo lo que arrastra.
 *
 * No es una etiqueta: decide con que intencion se escribe, que evidencia hace
 * falta y contra que numero se juzga la pieza despues.
 */
export type Objetivo = {
  slug: SlugObjetivo;
  nombre: string;
  /** Los territorios que pide, en orden de preferencia. */
  territorios: [SlugTerritorio, SlugTerritorio];
  metrica: string;
  evidencia: string;
  nota: string;
};

/** Una de las 42 aperturas. Vive en la base: la agencia las gestiona. */
export type Apertura = {
  id: number;
  numero: number;
  territorio: SlugTerritorio;
  mecanismos: SlugMecanismo[];
  /** Con [corchetes] donde hay que sustituir. */
  plantilla: string;
  ejemplo: string;
  insertTitulo: string;
  direccionEdicion: string;
  usalaCuando: string;
  activa: boolean;
  creadoEn: Date;
};

export type DatosNuevaApertura = Omit<Apertura, "id" | "creadoEn" | "activa">;

/* ===========================================================================
   REGLAS
   =========================================================================== */

/**
 * Los limites con los que audita una cuenta.
 *
 * Se resuelve buscando primero una regla del cliente, luego una de su sector,
 * y si no hay ninguna, el estandar de la casa. Nunca se suman: gana una sola.
 */
export type ReglaHook = {
  id: number;
  etiqueta: string;
  empresaId: number | null;
  sector: string | null;
  maxPalabrasVoz: number;
  maxPalabrasInsert: number;
  exigirPrueba: boolean;
  /** Terminos propios de la cuenta, que se SUMAN a los de la casa. */
  preambulos: string[];
  formulasGastadas: string[];
  terminosTension: string[];
  creadoPor: number;
  creadoEn: Date;
  actualizadoEn: Date;
};

export type DatosNuevaRegla = Omit<
  ReglaHook,
  "id" | "creadoEn" | "actualizadoEn"
>;

/**
 * Lo que el auditor necesita de una regla.
 *
 * Es un subconjunto a proposito: la funcion que audita no debe poder leer
 * quien creo la regla ni cuando, porque eso no entra en ninguna decision.
 */
export type LimitesAuditoria = Pick<
  ReglaHook,
  | "etiqueta"
  | "maxPalabrasVoz"
  | "maxPalabrasInsert"
  | "exigirPrueba"
  | "preambulos"
  | "formulasGastadas"
  | "terminosTension"
>;

/* ===========================================================================
   AUDITORIA
   =========================================================================== */

export type EstadoControl = "pasa" | "aviso" | "falla";

/** Uno de los nueve controles, ya resuelto. */
export type Control = {
  clave: string;
  titulo: string;
  estado: EstadoControl;
  mensaje: string;
  /**
   * Un fallo duro TAPA la nota, no la resta. Es lo que impide que una suma
   * alta apruebe un hook que empieza por «Hola chicos».
   */
  duro: boolean;
  puntos: number;
};

export type Veredicto =
  | "listo"
  | "aprobado_con_avisos"
  | "reescribir"
  | "descartar";

export type ResultadoAuditoria = {
  nota: number;
  aprobado: boolean;
  veredicto: Veredicto;
  controles: Control[];
  /** Suma antes de aplicar el tope de los fallos duros. Explica la nota. */
  suma: number;
  /** Si la regla activa amplia los limites de la casa (12/6). */
  limiteAmpliado: boolean;
};

/**
 * Lo que una auditoria devuelve al formulario que la pidio.
 *
 * Vive aqui y no junto a la action porque un archivo "use server" solo
 * puede exportar funciones asincronas: un tipo declarado alli obliga a
 * importarlo con acrobacias o directamente no compila.
 */
export type EstadoAuditoria = {
  ok: boolean;
  mensaje?: string;
  errores?: Record<string, string>;
  resultado?: ResultadoAuditoria;
  fichaId?: number;
};

/** El estado antes del primer envio. */
export const ESTADO_AUDITORIA: EstadoAuditoria = { ok: false };

/** Lo que entra al auditor. Nada mas: es una funcion pura. */
export type EntradaAuditoria = {
  hablado: string;
  insertTitulo?: string | null;
  prueba?: string | null;
  regla?: LimitesAuditoria | null;
};

/* ===========================================================================
   FICHAS Y RESULTADOS
   =========================================================================== */

export type FichaHook = {
  id: number;
  empresaId: number;
  empresaNombre: string | null;
  objetivo: SlugObjetivo;
  plataforma: SlugPlataforma;
  audiencia: string | null;
  tension: string | null;
  verdadMarca: string | null;
  prueba: string | null;
  hablado: string;
  insertTitulo: string | null;
  primerFotograma: string | null;
  pagoPromesa: string | null;
  cta: string | null;
  riesgoClaim: string | null;
  notaAuditor: number | null;
  metricaPrincipal: string | null;
  estado: EstadoFicha;
  creadoPor: number;
  creadoPorNombre: string | null;
  creadoEn: Date;
  actualizadoEn: Date;
};

export type ResultadoHook = {
  id: number;
  fichaId: number;
  impresiones: number;
  vistas3s: number;
  meGusta: number;
  compartidos: number;
  clics: number;
  guardados: number;
  aprendizaje: string | null;
  observadoEn: Date;
  actualizadoEn: Date;
};

/** Una ficha con su resultado, que es como la pinta el historial. */
export type FichaConResultado = FichaHook & {
  resultado: ResultadoHook | null;
  /** vistas3s / impresiones, en tanto por ciento. Null sin datos. */
  hookRate: number | null;
};

export type ReferenciaHook = {
  id: number;
  hablado: string;
  insertTitulo: string | null;
  plataforma: SlugPlataforma;
  territorio: SlugTerritorio;
  urlFuente: string | null;
  /** Por que funciona. Sin esto una referencia es un recorte suelto. */
  lectura: string;
  etiquetas: string[];

  /**
   * De que pieza propia salio, si salio de una.
   *
   * Null en las referencias de fuera, que son la mayoria. Cuando apunta a una
   * ficha, el historial deja de ofrecer "guardar como referencia" para ella.
   */
  fichaId: number | null;

  creadoPor: number;
  creadoEn: Date;
};

export type DatosNuevaReferencia = Omit<
  ReferenciaHook,
  "id" | "creadoEn"
>;
