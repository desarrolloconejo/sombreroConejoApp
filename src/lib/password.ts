import bcrypt from "bcryptjs";

/**
 * Hash y verificacion de contrasenas.
 *
 * Se usa bcrypt en su version de JavaScript puro. La alternativa nativa
 * compila con node-gyp y produce binarios distintos entre el host Windows y el
 * contenedor Linux, que es justo donde el proyecto monta el codigo.
 *
 * Este modulo solo se puede usar del lado del servidor. Nunca desde el proxy:
 * ahi no hay que comprobar contrasenas, solo verificar el token ya emitido.
 */

/**
 * Coste de bcrypt. Cada unidad duplica el trabajo.
 * Con 12 una comparacion ronda el medio segundo, que es lento a proposito:
 * encarece el ataque por fuerza bruta sin molestar a quien inicia sesion.
 */
const RONDAS = 12;

/**
 * Hash de una contrasena que nadie usa.
 *
 * Cuando el correo no existe hay que gastar el mismo tiempo que se gastaria
 * comprobando una contrasena real. Si no, la respuesta llega mucho antes y ese
 * intervalo revela que el correo no esta registrado, permitiendo enumerar
 * cuentas validas.
 */
const HASH_SENUELO =
  "$2b$12$J/Qv3RM/tWjHnf8VNsx0rezbGDhQQaWak6pkgRAxzUqh4/GMvg5wq";

/** Longitud maxima que bcrypt tiene en cuenta: ignora lo que pase de 72 bytes. */
export const LONGITUD_MAXIMA_PASSWORD = 72;

/** Calcula el hash de una contrasena. */
export async function hashear(password: string): Promise<string> {
  return bcrypt.hash(password, RONDAS);
}

/** Comprueba si una contrasena corresponde a un hash. */
export async function verificar(
  password: string,
  hash: string,
): Promise<boolean> {
  // Un hash con formato invalido haria que bcrypt lance en lugar de devolver
  // false, y eso convertiria un dato corrupto en un error 500.
  if (!hash.startsWith("$2")) {
    return false;
  }

  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

/**
 * Gasta el mismo tiempo que una verificacion real, sin verificar nada.
 *
 * Se llama cuando el correo no existe, para que la respuesta tarde lo mismo
 * que cuando si existe y la contrasena es incorrecta.
 */
export async function gastarTiempoEquivalente(password: string): Promise<void> {
  await bcrypt.compare(password, HASH_SENUELO);
}
