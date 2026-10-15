import { randomInt } from "node:crypto";

/**
 * La contrasena provisional de una cuenta recien creada, que se entrega en
 * mano.
 *
 * Va en su propio modulo, solo de servidor: necesita `node:crypto`, y
 * lib/password.ts lo importa lib/validaciones.ts, que llega al navegador.
 */

// Alfabetos sin caracteres que se confunden al dictarlos: ni ele minuscula ni
// i mayuscula ni uno, ni o mayuscula ni cero. La contrasena provisional se
// comunica de viva voz, asi que cada ambiguedad cuesta un intento fallido.
const MINUSCULAS = "abcdefghijkmnopqrstuvwxyz";
const MAYUSCULAS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const NUMEROS = "23456789";

const LONGITUD_PROVISIONAL = 14;

/**
 * Un caracter al azar del alfabeto.
 *
 * `randomInt` da un entero uniforme dentro del rango. `Math.random()` no es
 * criptografico, y un modulo sobre bytes crudos sesgaria las primeras letras
 * del alfabeto, que son las que mas se repetirian en las contrasenas.
 */
function elegir(alfabeto: string): string {
  return alfabeto.charAt(randomInt(alfabeto.length));
}

/**
 * Contrasena provisional que cumple las reglas de `validarPassword`: al menos
 * una minuscula, una mayuscula y un numero.
 */
export function generarPasswordProvisional(): string {
  const todos = MINUSCULAS + MAYUSCULAS + NUMEROS;

  const caracteres = [elegir(MINUSCULAS), elegir(MAYUSCULAS), elegir(NUMEROS)];
  while (caracteres.length < LONGITUD_PROVISIONAL) {
    caracteres.push(elegir(todos));
  }

  // Sin barajar, las tres primeras posiciones tendrian siempre el mismo tipo
  // de caracter, y quien lo supiera se ahorraria parte de la busqueda.
  for (let posicion = caracteres.length - 1; posicion > 0; posicion -= 1) {
    const otra = randomInt(posicion + 1);
    const guardado = caracteres[posicion];
    caracteres[posicion] = caracteres[otra];
    caracteres[otra] = guardado;
  }

  return caracteres.join("");
}
