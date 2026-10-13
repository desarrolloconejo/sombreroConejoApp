/**
 * Las listas con las que el auditor detecta.
 *
 * Copiadas literales de la especificacion original de la herramienta, seccion
 * 11.4 (retirada del repositorio; sigue en su historial). No se "mejoran":
 * cada entrada esta calibrada contra como se habla de verdad en castellano, y
 * tocarla cambia lo que el auditor encuentra.
 *
 * TRES DETALLES QUE PARECEN ERRATAS Y NO LO SON
 * ---------------------------------------------
 * 1. La comparacion es por SUBCADENA, no por palabra completa. Por eso hay
 *    raices truncadas: `equivoc` cubre equivoco, equivocada y equivocarse;
 *    `hundi` cubre hundiendo y hundido. Pasarlo a palabra completa rompe
 *    media deteccion.
 *
 * 2. NO se quitan las tildes. Por eso aparecen las dos formas de la misma
 *    palabra (`increible` e `increíble`, `razon` y `razón`): la gente escribe
 *    de las dos maneras y las dos tienen que saltar. Normalizar aqui haria
 *    redundantes la mitad de las entradas y, peor, cambiaria en silencio lo
 *    que casa con las listas propias que anada cada cuenta.
 *
 * 3. Algunas entradas llevan un ESPACIO significativo: `"sin "` con espacio
 *    final no es lo mismo que `sin`, que casaria dentro de "asinado". Igual
 *    con `"tu "`, `"te "` y `"pero "`. No se recorten.
 */

/**
 * Empezar por aqui retrasa el valor. Es fallo duro: la primera palabra tiene
 * que ser la primera idea.
 */
export const PREAMBULOS: readonly string[] = [
  "hola",
  "holaa",
  "buenas",
  "chicos",
  "chicas",
  "gente",
  "bienvenid",
  "muy buenas",
  "hoy os voy",
  "hoy te voy",
  "hoy vamos",
  "en este video",
  "en este vídeo",
  "antes de empezar",
  "como estan",
  "cómo estáis",
  "qué tal",
  "que tal",
  "os habla",
  "os traigo",
  "en el vídeo de hoy",
];

/**
 * El cementerio. La audiencia las reconoce como plantilla y acelera el scroll,
 * asi que tambien es fallo duro.
 */
export const FORMULAS_QUEMADAS: readonly string[] = [
  "espera al final",
  "espérate al final",
  "no vas a creer",
  "no te vas a creer",
  "te va a volar la cabeza",
  "esto lo cambia todo",
  "parte 1",
  "storytime",
  "story time",
  "sigue leyendo",
  "mira hasta el final",
  "increíble",
  "increible",
  "impresionante",
  "esto es oro",
  "el secreto que nadie",
];

/** No dicen nada. Penalizan la especificidad, pero no tumban la nota. */
export const PALABRAS_VAGAS: readonly string[] = [
  "cosas",
  "algo",
  "mucho",
  "muchos",
  "muchas",
  "varias",
  "varios",
  "mejores",
  "tips",
  "trucos",
  "consejos",
];

/**
 * Conflicto, negacion o hueco de informacion: le dan al espectador algo que
 * resolver, que es lo que hace que se quede.
 */
export const TERMINOS_TENSION: readonly string[] = [
  "por qué",
  "porque",
  "porqué",
  "razón",
  "razon",
  "error",
  "equivoc",
  "deja de",
  "dejamos de",
  "dejé de",
  "antes de",
  "nadie",
  "nunca",
  "ningún",
  "ninguna",
  "esto es lo que",
  "en realidad",
  "sin ",
  "no es",
  "no son",
  "no depende",
  "no funciona",
  "ya no",
  "falla",
  "fall",
  "perdí",
  "perdi",
  "cuesta",
  "cost",
  "frena",
  "fren",
  "hundi",
  "hunde",
  "arruin",
  "mata",
  "empeor",
  "en vez de",
  "en lugar de",
  "pero ",
  "aunque",
];

/** Apelar a alguien concreto filtra audiencia y sube la retencion media. */
export const SEGUNDA_PERSONA: readonly string[] = [
  "tu ",
  "tus ",
  "te ",
  "ti ",
  "tú",
  "contigo",
  "vos",
  "usted",
  "tuyo",
  "tuya",
  "si eres",
  "si tienes",
  "si llevas",
  "si haces",
  "si estás",
];

/**
 * Sobrepromesa. Es lo unico que se detecta con expresion regular y no con
 * lista, porque `100 %` admite el espacio o no.
 *
 * Es fallo duro y el motivo no es de estilo: si el video no cumple lo que
 * promete, la salida temprana cuenta como senal negativa y ademas es un
 * riesgo con el cliente.
 */
export const SOBREPROMESA =
  /(garantizad|100 ?%|siempre funciona|nunca falla|en 24 horas|de la noche a la mañana|millonari|resultados asegurados)/;

/** Una cifra concreta sube la credibilidad. Se busca sobre el texto original. */
export const CIFRA = /\d/;

/**
 * El estandar de la agencia, cuando la cuenta no tiene regla propia.
 * Una regla que suba de aqui queda marcada como limite ampliado.
 */
export const ESTANDAR_VOZ = 12;
export const ESTANDAR_INSERT = 6;

/** Por debajo de esto no hay promesa que evaluar, solo un fragmento. */
export const MINIMO_PALABRAS = 4;

/** La nota que hay que alcanzar para poder grabar. */
export const UMBRAL = 70;
