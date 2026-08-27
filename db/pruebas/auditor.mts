/**
 * Bateria de casos del auditor.
 *
 *   docker compose exec app-dev npx tsx db/pruebas/auditor.mts
 *
 * El auditor es una funcion pura, asi que se puede fijar entera con una tabla
 * de casos antes de que exista una sola pantalla. Esta bateria no busca
 * cobertura: busca clavar las decisiones que se pueden romper sin darse
 * cuenta, sobre todo la regla de que un fallo duro TAPA la nota en vez de
 * restarla.
 *
 * Cada caso dice que espera y por que. Si uno falla, el mensaje explica cual
 * era la intencion, no solo que numero salio.
 */
import { auditar } from "@/lib/hooks/auditor";
import { UMBRAL } from "@/lib/hooks/listas";
import type { EntradaAuditoria, LimitesAuditoria } from "@/types";

type Caso = {
  nombre: string;
  porque: string;
  entrada: EntradaAuditoria;
  espera: (r: ReturnType<typeof auditar>) => boolean;
  describe: (r: ReturnType<typeof auditar>) => string;
};

const reglaAmpliada: LimitesAuditoria = {
  etiqueta: "Estandar hosteleria",
  maxPalabrasVoz: 16,
  maxPalabrasInsert: 8,
  exigirPrueba: true,
  preambulos: [],
  formulasGastadas: [],
  terminosTension: [],
};

const CASOS: Caso[] = [
  // ---------------------------------------------------------------- vacio
  {
    nombre: "Hablado vacio",
    porque: "Sin texto no hay nada que medir: un solo control y nota 0",
    entrada: { hablado: "" },
    espera: (r) => r.nota === 0 && r.controles.length === 1 && !r.aprobado,
    describe: (r) => `nota ${r.nota}, ${r.controles.length} control(es)`,
  },

  // ------------------------------------------------------------ muy corto
  {
    nombre: "Tres palabras",
    porque: "Por debajo de 4 la nota se tapa en 25, mas bajo que el 69 normal",
    entrada: { hablado: "No es levadura" },
    espera: (r) => r.nota <= 25 && !r.aprobado,
    describe: (r) => `nota ${r.nota} (suma ${r.suma})`,
  },
  {
    nombre: "Corto no duplica el control de longitud",
    porque: "Decir a la vez «por debajo de 4» y «dentro del rango» seria contradictorio",
    entrada: { hablado: "No es levadura" },
    espera: (r) =>
      r.controles.some((c) => c.clave === "corto") &&
      !r.controles.some((c) => c.clave === "longitud"),
    describe: (r) => r.controles.map((c) => c.clave).join(", "),
  },

  // ------------------------------------------------------- el caso central
  {
    nombre: "FALLO DURO tapa una suma alta",
    porque:
      "Es la regla que sostiene el sistema: con un preambulo no se puede aprobar " +
      "por muy alta que sea la suma. Si restara, un hook largo compraria el derecho a saludar",
    entrada: {
      hablado:
        "Hola chicos, hoy os traigo los 3 errores que nunca deberias cometer con tu cafe",
    },
    espera: (r) => r.suma >= 70 && r.nota === 69 && !r.aprobado,
    describe: (r) => `suma ${r.suma} -> nota ${r.nota}`,
  },
  {
    nombre: "Insert-Titulo identico al hablado",
    porque: "Es fallo duro: el Insert lleva el nucleo, la voz la frase",
    entrada: {
      hablado: "El detalle de esta etiqueta que cambia como eliges cafe",
      insertTitulo: "El detalle de esta etiqueta que cambia como eliges cafe",
    },
    espera: (r) => r.nota <= 69 && !r.aprobado,
    describe: (r) => `nota ${r.nota} (suma ${r.suma})`,
  },
  {
    nombre: "Formula del cementerio",
    porque: "«no vas a creer» es plantilla reconocible: fallo duro",
    entrada: { hablado: "No vas a creer lo que le pasa a este cafe en 3 dias" },
    espera: (r) => r.nota <= 69 && !r.aprobado,
    describe: (r) => `nota ${r.nota}`,
  },
  {
    nombre: "Sobrepromesa",
    porque: "«garantizado» promete lo que el video no puede cumplir: fallo duro",
    entrada: { hablado: "Resultado garantizado en tu cafe con estos 3 pasos" },
    espera: (r) => r.nota <= 69 && !r.aprobado,
    describe: (r) => `nota ${r.nota}`,
  },

  // -------------------------------------------------------------- aprueba
  {
    nombre: "Hook limpio con cifra y tension",
    porque: "Sin fallos duros y con todo a favor tiene que quedar en el tramo alto",
    entrada: {
      hablado: "Tu cafe no es el grano: son los 2 minutos finales",
      insertTitulo: "No es el grano",
    },
    espera: (r) => r.nota >= 85 && r.aprobado && r.veredicto === "listo",
    describe: (r) => `nota ${r.nota}, veredicto ${r.veredicto}`,
  },
  {
    nombre: "Sin Insert-Titulo solo avisa",
    porque: "Es un aviso, no un fallo: se puede aprobar sin el",
    entrada: {
      hablado: "Tu cafe no es el grano: son los 2 minutos finales",
    },
    espera: (r) =>
      r.aprobado &&
      r.controles.find((c) => c.clave === "insert")?.estado === "aviso",
    describe: (r) =>
      `nota ${r.nota}, insert ${r.controles.find((c) => c.clave === "insert")?.estado}`,
  },

  // ------------------------------------------------------------- longitud
  {
    nombre: "Trece palabras rozan el limite",
    porque: "Entre 13 y 16 es aviso, no fallo: todavia cabe en la ventana",
    entrada: {
      hablado:
        "Tu cafe no es el grano tostado: son los 2 minutos finales de reposo",
    },
    espera: (r) =>
      r.controles.find((c) => c.clave === "longitud")?.estado === "aviso",
    describe: (r) =>
      `longitud ${r.controles.find((c) => c.clave === "longitud")?.estado}`,
  },
  {
    nombre: "Un parrafo entero",
    porque: "Pasado max+10 no suma nada: eso ya no es un hook",
    entrada: {
      hablado:
        "Hoy quiero contarte con calma por que tu cafe no sabe como esperabas y " +
        "cuales son los 3 factores que de verdad influyen en la taza final que te tomas",
    },
    espera: (r) =>
      r.controles.find((c) => c.clave === "longitud")?.puntos === 0,
    describe: (r) =>
      `puntos de longitud: ${r.controles.find((c) => c.clave === "longitud")?.puntos}`,
  },

  // --------------------------------------------------------------- reglas
  {
    nombre: "Regla ampliada admite 14 palabras",
    porque: "Con voz <= 16 lo que pasaria de 12 sigue dentro del rango",
    entrada: {
      hablado:
        "Tu cafe no es el grano tostado: son los 2 minutos finales de reposo",
      insertTitulo: "No es el grano",
      prueba: "Dos tazas en macro",
      regla: reglaAmpliada,
    },
    espera: (r) =>
      r.controles.find((c) => c.clave === "longitud")?.estado === "pasa" &&
      r.limiteAmpliado,
    describe: (r) =>
      `longitud ${r.controles.find((c) => c.clave === "longitud")?.estado}, ampliado ${r.limiteAmpliado}`,
  },
  {
    nombre: "Prueba exigida y ausente",
    porque: "Si la regla la exige y no esta, es fallo duro aunque todo lo demas pase",
    entrada: {
      hablado: "Tu cafe no es el grano: son los 2 minutos finales",
      insertTitulo: "No es el grano",
      prueba: "",
      regla: reglaAmpliada,
    },
    espera: (r) => r.nota <= 69 && !r.aprobado,
    describe: (r) => `nota ${r.nota} (suma ${r.suma})`,
  },
  {
    nombre: "El estandar no marca limite ampliado",
    porque: "12/6 es la casa: solo se marca lo que la supera",
    entrada: { hablado: "Tu cafe no es el grano: son 2 minutos" },
    espera: (r) => !r.limiteAmpliado,
    describe: (r) => `ampliado ${r.limiteAmpliado}`,
  },

  // ------------------------------------------------------------ subcadena
  {
    nombre: "Raiz truncada: «hundi»",
    porque: "La comparacion es por subcadena; «hundiendo» tiene que dar tension",
    entrada: { hablado: "Publicar a diario esta hundiendo el alcance de tu cuenta" },
    espera: (r) =>
      r.controles.find((c) => c.clave === "tension")?.estado === "pasa",
    describe: (r) =>
      `tension ${r.controles.find((c) => c.clave === "tension")?.estado}`,
  },
  {
    nombre: "Sin tilde: «increible»",
    porque:
      "Las listas traen las dos formas porque NO se quitan las tildes. " +
      "Si alguien normalizara, esta entrada dejaria de tener sentido y el caso lo delata",
    entrada: { hablado: "Este metodo increible cambia como preparas tu cafe" },
    espera: (r) => r.nota <= 69,
    describe: (r) => `nota ${r.nota}`,
  },
  {
    nombre: "Con tilde: «increible» acentuado",
    porque: "La otra forma de la misma palabra tiene que saltar igual",
    entrada: { hablado: "Este metodo increíble cambia como preparas tu cafe" },
    espera: (r) => r.nota <= 69,
    describe: (r) => `nota ${r.nota}`,
  },

  // ---------------------------------------------------------------- topes
  {
    nombre: "La nota nunca pasa de 100",
    porque: "El tope esta declarado y conviene que no dependa de la suma real",
    entrada: {
      hablado: "Tu cafe no es el grano: son los 2 minutos finales",
      insertTitulo: "No es el grano",
    },
    espera: (r) => r.nota <= 100 && r.suma <= 100,
    describe: (r) => `nota ${r.nota}, suma ${r.suma}`,
  },
  {
    nombre: "Umbral de paso",
    porque: "Aprobar es exactamente nota >= 70, sin margen",
    entrada: {
      hablado: "Tu cafe no es el grano: son los 2 minutos finales",
      insertTitulo: "No es el grano",
    },
    espera: (r) => r.aprobado === r.nota >= UMBRAL,
    describe: (r) => `nota ${r.nota}, aprobado ${r.aprobado}`,
  },
];

let pasan = 0;
const fallan: string[] = [];

console.log(`\nAuditor de hooks - ${CASOS.length} casos\n`);

for (const caso of CASOS) {
  const resultado = auditar(caso.entrada);
  const ok = caso.espera(resultado);

  if (ok) {
    pasan++;
    console.log(`  OK    ${caso.nombre}  ->  ${caso.describe(resultado)}`);
  } else {
    fallan.push(caso.nombre);
    console.log(`  FALLA ${caso.nombre}  ->  ${caso.describe(resultado)}`);
    console.log(`        se esperaba: ${caso.porque}`);
  }
}

console.log(`\n${pasan}/${CASOS.length} casos correctos`);

if (fallan.length > 0) {
  console.error(`\nFallan: ${fallan.join(", ")}`);
  process.exit(1);
}
