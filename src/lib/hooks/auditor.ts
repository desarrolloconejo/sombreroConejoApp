import {
  CIFRA,
  ESTANDAR_INSERT,
  ESTANDAR_VOZ,
  FORMULAS_QUEMADAS,
  MINIMO_PALABRAS,
  PALABRAS_VAGAS,
  PREAMBULOS,
  SEGUNDA_PERSONA,
  SOBREPROMESA,
  TERMINOS_TENSION,
  UMBRAL,
} from "./listas";
import type {
  Control,
  EntradaAuditoria,
  EstadoControl,
  LimitesAuditoria,
  ResultadoAuditoria,
  Veredicto,
} from "@/types";

/**
 * El auditor de hooks. Nueve controles, tope 100, umbral de paso 70.
 *
 * Es una FUNCION PURA y eso no es casualidad: no toca la base, no lee la
 * sesion y no depende de la hora. Por eso corre en los dos lados sin duplicar
 * nada — en el cliente para la nota en vivo del Canvas y en el servidor al
 * guardar la ficha — y por eso se puede probar con una tabla de casos.
 *
 * NO HAY NINGUN MODELO DE LENGUAJE AQUI. La nota sale de nueve comprobaciones
 * sobre listas de expresiones, y esa es justamente la propiedad que la hace
 * reproducible y explicable: la misma frase da siempre la misma nota, y cada
 * punto se puede senalar con el dedo.
 *
 * LOS FALLOS DUROS TAPAN, NO RESTAN
 * ---------------------------------
 * Es la regla que sostiene el sistema. Un hook que sume 90 pero empiece por
 * «Hola chicos» sale 69, no 87: con un fallo duro no puede aprobar por muy
 * alta que sea la suma. Si restaran, un hook largo y bien escrito compraria
 * el derecho a saludar, que es exactamente lo que hay que impedir.
 */

/** El estandar de la casa, cuando la cuenta no tiene regla propia. */
const ESTANDAR: LimitesAuditoria = {
  etiqueta: "Estandar de agencia",
  maxPalabrasVoz: ESTANDAR_VOZ,
  maxPalabrasInsert: ESTANDAR_INSERT,
  exigirPrueba: false,
  preambulos: [],
  formulasGastadas: [],
  terminosTension: [],
};

/** Cuenta palabras de verdad: los espacios de mas no suman. */
export function contarPalabras(texto: string): number {
  const limpio = texto.trim();
  return limpio.length === 0 ? 0 : limpio.split(/\s+/).length;
}

/**
 * Busca cualquiera de los terminos dentro del texto.
 *
 * En minusculas y por subcadena, tal como lo define el documento. NO se quitan
 * las tildes a proposito: las listas ya traen las dos formas de cada palabra,
 * y normalizar aqui cambiaria en silencio lo que casa con los terminos
 * propios que anada cada cuenta.
 */
function encontrar(texto: string, terminos: readonly string[]): string | null {
  const minusculas = texto.toLowerCase();

  for (const termino of terminos) {
    if (termino && minusculas.includes(termino.toLowerCase())) return termino;
  }

  return null;
}

/** Los terminos de la casa mas los que anada la regla de la cuenta. */
function unir(casa: readonly string[], propios: readonly string[]): string[] {
  return [...casa, ...propios.map((t) => t.trim()).filter(Boolean)];
}

function control(
  clave: string,
  titulo: string,
  estado: EstadoControl,
  mensaje: string,
  puntos: number,
  duro = false,
): Control {
  return { clave, titulo, estado, mensaje, puntos, duro };
}

function veredictoDe(nota: number): Veredicto {
  if (nota >= 85) return "listo";
  if (nota >= UMBRAL) return "aprobado_con_avisos";
  if (nota >= 50) return "reescribir";
  return "descartar";
}

export function auditar(entrada: EntradaAuditoria): ResultadoAuditoria {
  const hablado = (entrada.hablado ?? "").trim();
  const insertTitulo = (entrada.insertTitulo ?? "").trim();
  const prueba = (entrada.prueba ?? "").trim();
  const regla = entrada.regla ?? ESTANDAR;

  const limiteAmpliado =
    regla.maxPalabrasVoz > ESTANDAR_VOZ ||
    regla.maxPalabrasInsert > ESTANDAR_INSERT;

  /*
   * Cortocircuito. Sin hablado no hay nada que medir, y devolver nueve
   * controles en gris solo daria la impresion de que se evaluo algo.
   */
  if (hablado.length === 0) {
    return {
      nota: 0,
      suma: 0,
      aprobado: false,
      veredicto: "descartar",
      limiteAmpliado,
      controles: [
        control(
          "vacio",
          "Campo vacio",
          "falla",
          "Escribe el hook hablado antes de auditar.",
          0,
          true,
        ),
      ],
    };
  }

  const palabras = contarPalabras(hablado);
  const palabrasInsert = contarPalabras(insertTitulo);
  const maxVoz = regla.maxPalabrasVoz;
  const maxInsert = regla.maxPalabrasInsert;

  const controles: Control[] = [];
  const demasiadoCorto = palabras < MINIMO_PALABRAS;

  /* --- 0 · Demasiado corto ------------------------------------------------
     Sustituye al control de longitud en vez de sumarse: decir a la vez
     «3 palabras, por debajo de 4» y «3 palabras, dentro del rango» seria
     contradictorio en la misma lista. */
  if (demasiadoCorto) {
    controles.push(
      control(
        "corto",
        "Demasiado corto",
        "falla",
        `${palabras} ${palabras === 1 ? "palabra" : "palabras"}. Por debajo de ${MINIMO_PALABRAS} no hay promesa que evaluar, solo un fragmento.`,
        0,
        true,
      ),
    );
  } else {
    /* --- 1 · Longitud del hablado --------------------------------------- */
    if (palabras <= maxVoz) {
      controles.push(
        control(
          "longitud",
          "Longitud del hablado",
          "pasa",
          `${palabras} palabras. Dentro del rango de 7 a ${maxVoz} calibrado para castellano.`,
          16,
        ),
      );
    } else if (palabras <= maxVoz + 4) {
      controles.push(
        control(
          "longitud",
          "Longitud del hablado",
          "aviso",
          `${palabras} palabras. En el limite. Intenta bajar de ${maxVoz}.`,
          10,
        ),
      );
    } else if (palabras <= maxVoz + 10) {
      controles.push(
        control(
          "longitud",
          "Longitud del hablado",
          "falla",
          `${palabras} palabras. Se sale de la ventana. Corta la subordinada y quedate con la afirmacion.`,
          4,
        ),
      );
    } else {
      controles.push(
        control(
          "longitud",
          "Longitud del hablado",
          "falla",
          `${palabras} palabras. Esto es el primer parrafo del guion, no un hook. Recorta a la mitad.`,
          0,
        ),
      );
    }
  }

  /* --- 2 · Insert-Titulo -------------------------------------------------- */
  if (insertTitulo.length === 0) {
    controles.push(
      control(
        "insert",
        "Insert-Titulo",
        "aviso",
        "No has escrito Insert-Titulo. En Reels buena parte del consumo es en silencio: sin Insert-Titulo dependes del audio.",
        4,
      ),
    );
  } else if (insertTitulo.toLowerCase() === hablado.toLowerCase()) {
    controles.push(
      control(
        "insert",
        "Insert-Titulo",
        "falla",
        "El Insert-Titulo es identico al hablado. Escribe solo el nucleo.",
        0,
        true,
      ),
    );
  } else if (palabrasInsert <= maxInsert) {
    controles.push(
      control(
        "insert",
        "Insert-Titulo",
        "pasa",
        `${palabrasInsert} palabras. Entra completo en el fotograma uno y funciona en mudo.`,
        12,
      ),
    );
  } else {
    controles.push(
      control(
        "insert",
        "Insert-Titulo",
        "falla",
        `${palabrasInsert} palabras. Pasa de ${maxInsert} y ocupara dos lineas. Reduce al nucleo.`,
        4,
      ),
    );
  }

  /* --- 3 · Preambulo ------------------------------------------------------ */
  const preambulo = encontrar(hablado, unir(PREAMBULOS, regla.preambulos));
  controles.push(
    preambulo
      ? control(
          "preambulo",
          "Preambulo",
          "falla",
          `Empiezas con «${preambulo}». Borra la primera frase entera y avisalo antes de rodar.`,
          0,
          true,
        )
      : control(
          "preambulo",
          "Preambulo",
          "pasa",
          "La primera palabra ya trabaja.",
          14,
          true,
        ),
  );

  /* --- 4 · Formula del cementerio ----------------------------------------- */
  const quemada = encontrar(
    hablado,
    unir(FORMULAS_QUEMADAS, regla.formulasGastadas),
  );
  controles.push(
    quemada
      ? control(
          "cementerio",
          "Formula del cementerio",
          "falla",
          `Contiene «${quemada}». La audiencia lo reconoce como plantilla y acelera el scroll.`,
          0,
          true,
        )
      : control(
          "cementerio",
          "Formula del cementerio",
          "pasa",
          "No detecto recursos del cementerio.",
          12,
          true,
        ),
  );

  /* --- 5 · Especificidad --------------------------------------------------- */
  const hayCifra = CIFRA.test(hablado);
  const vaga = encontrar(hablado, PALABRAS_VAGAS);

  if (hayCifra && !vaga) {
    controles.push(
      control(
        "especificidad",
        "Especificidad",
        "pasa",
        "Hay cifra concreta y ninguna palabra vacia. Esto da credibilidad.",
        14,
      ),
    );
  } else if (hayCifra && vaga) {
    controles.push(
      control(
        "especificidad",
        "Especificidad",
        "aviso",
        `Tienes cifra, pero tambien «${vaga}». Sustituyela por el sustantivo real.`,
        8,
      ),
    );
  } else if (vaga) {
    controles.push(
      control(
        "especificidad",
        "Especificidad",
        "falla",
        `«${vaga}» no dice nada. Cambialo por el sustantivo exacto o por un numero.`,
        0,
      ),
    );
  } else {
    controles.push(
      control(
        "especificidad",
        "Especificidad",
        "aviso",
        "No hay cifra. No es obligatorio, pero una cifra concreta sube la credibilidad.",
        6,
      ),
    );
  }

  /* --- 6 · Tension --------------------------------------------------------- */
  const tension = encontrar(hablado, unir(TERMINOS_TENSION, regla.terminosTension));
  controles.push(
    tension
      ? control(
          "tension",
          "Tension",
          "pasa",
          "Hay conflicto, negacion o hueco de informacion. El espectador tiene algo que resolver.",
          13,
        )
      : control(
          "tension",
          "Tension",
          "falla",
          "No detecto contradiccion, hueco ni coste. Prueba el territorio G.",
          0,
        ),
  );

  /* --- 7 · Direccion -------------------------------------------------------- */
  controles.push(
    encontrar(hablado, SEGUNDA_PERSONA)
      ? control(
          "direccion",
          "Direccion",
          "pasa",
          "Hablas a alguien concreto. Filtrar audiencia sube la retencion media.",
          9,
        )
      : control(
          "direccion",
          "Direccion",
          "aviso",
          "No apelas al espectador. Vale si el territorio es demostracion o historia; en el resto, senalalo.",
          3,
        ),
  );

  /* --- 8 · Promesa ---------------------------------------------------------- */
  controles.push(
    SOBREPROMESA.test(hablado.toLowerCase())
      ? control(
          "promesa",
          "Promesa",
          "falla",
          "Suena a sobrepromesa. Si el video no la cumple, la salida temprana cuenta como senal negativa y es un riesgo de cliente.",
          0,
          true,
        )
      : control(
          "promesa",
          "Promesa",
          "pasa",
          "No detecto exageracion. La promesa parece cumplible en el cuerpo del video.",
          10,
          true,
        ),
  );

  /* --- 9 · Prueba declarada -------------------------------------------------
     Solo existe si la regla de la cuenta la exige. No suma puntos: su unico
     efecto es tapar la nota cuando falta. */
  if (regla.exigirPrueba && prueba.length === 0) {
    controles.push(
      control(
        "prueba",
        "Prueba declarada",
        "falla",
        "La regla activa exige una prueba visible antes de producir. Declarala en el Canvas o desactiva la exigencia en Reglas.",
        0,
        true,
      ),
    );
  } else if (regla.exigirPrueba) {
    controles.push(
      control(
        "prueba",
        "Prueba declarada",
        "pasa",
        "La regla activa exige prueba visible y la ficha la declara.",
        0,
        true,
      ),
    );
  }

  const suma = Math.min(
    100,
    controles.reduce((total, c) => total + c.puntos, 0),
  );

  /*
   * El tope de los fallos duros. Aqui es donde la nota deja de ser una suma.
   */
  const hayDuro = controles.some((c) => c.duro && c.estado === "falla");

  let nota = suma;
  if (hayDuro) nota = Math.min(nota, 69);
  if (demasiadoCorto) nota = Math.min(nota, 25);

  return {
    nota,
    suma,
    aprobado: nota >= UMBRAL,
    veredicto: veredictoDe(nota),
    limiteAmpliado,
    controles,
  };
}

/**
 * El estandar de la casa, para quien lo necesite fuera de aqui.
 * Se devuelve una copia: nadie debe poder modificarlo por accidente.
 */
export function limitesPorDefecto(): LimitesAuditoria {
  return { ...ESTANDAR, preambulos: [], formulasGastadas: [], terminosTension: [] };
}
