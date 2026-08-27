import type { ErroresCampo, Tema } from "@/types";
import { LONGITUD_MAXIMA_PASSWORD } from "./password";

/**
 * Validacion de la entrada que llega desde los formularios.
 *
 * Escrita a mano, sin libreria, tal como pide el contrato del proyecto.
 *
 * Estas comprobaciones NO son la defensa contra inyeccion SQL: de eso se
 * encarga la parametrizacion en `lib/db`. Aqui se validan forma y reglas de
 * negocio, y se recorta lo que llega para que no entren cadenas
 * desproporcionadas ni caracteres de control.
 */

export const LIMITES = {
  nombre: 60,
  apellido: 60,
  email: 254,
  telefono: 30,
  cargo: 80,
  empresa: 120,
  rif: 20,
  sector: 120,
  direccion: 200,
  passwordMinima: 8,
} as const;

/**
 * Caracteres de control C0 y DEL.
 *
 * Se construye desde una cadena en lugar de escribirse como literal para
 * que el archivo fuente no contenga bytes de control de verdad.
 */
const CARACTERES_CONTROL = new RegExp("[\\u0000-\\u001F\\u007F]", "g");

/**
 * Normaliza un valor recibido de un formulario.
 *
 * FormData entrega `string | File | null`, asi que lo primero es descartar
 * todo lo que no sea texto. Despues se quitan los caracteres de control, que
 * no aportan nada y ensucian los registros, y se recorta la longitud.
 */
export function limpiarTexto(valor: unknown, maximo: number): string {
  if (typeof valor !== "string") return "";

  return valor
    .replace(CARACTERES_CONTROL, "")
    .trim()
    .slice(0, maximo);
}

/** Igual que limpiarTexto, pero devuelve null cuando queda vacio. */
export function limpiarOpcional(valor: unknown, maximo: number): string | null {
  const texto = limpiarTexto(valor, maximo);
  return texto.length > 0 ? texto : null;
}

/**
 * Comprueba la forma de un correo.
 *
 * Deliberadamente sencilla. Validar correos con una expresion exhaustiva es
 * una fuente conocida de falsos negativos; lo unico que hace falta aqui es
 * descartar lo que evidentemente no es una direccion.
 */
export function esEmail(valor: string): boolean {
  if (valor.length > LIMITES.email) return false;

  const partes = valor.split("@");
  if (partes.length !== 2) return false;

  const [local, dominio] = partes;
  if (!local || !dominio) return false;
  if (/\s/.test(valor)) return false;
  if (!dominio.includes(".")) return false;
  if (dominio.startsWith(".") || dominio.endsWith(".")) return false;
  if (dominio.includes("..")) return false;

  return true;
}

/**
 * Reglas de la contrasena. Devuelve el mensaje de error, o null si es valida.
 *
 * El limite superior no es un capricho: bcrypt ignora todo lo que pase de 72
 * bytes, asi que aceptar mas daria una falsa sensacion de seguridad.
 */
export function validarPassword(valor: string): string | null {
  if (valor.length < LIMITES.passwordMinima) {
    return `La contrasena debe tener al menos ${LIMITES.passwordMinima} caracteres`;
  }

  if (valor.length > LONGITUD_MAXIMA_PASSWORD) {
    return `La contrasena no puede pasar de ${LONGITUD_MAXIMA_PASSWORD} caracteres`;
  }

  if (!/[a-z]/.test(valor)) return "La contrasena debe incluir una minuscula";
  if (!/[A-Z]/.test(valor)) return "La contrasena debe incluir una mayuscula";
  if (!/[0-9]/.test(valor)) return "La contrasena debe incluir un numero";

  return null;
}

const TEMAS: readonly Tema[] = ["sistema", "claro", "oscuro"];

/** Convierte un valor cualquiera en un tema valido, o null. */
export function comoTema(valor: unknown): Tema | null {
  return TEMAS.includes(valor as Tema) ? (valor as Tema) : null;
}

/**
 * Convierte un valor cualquiera en un entero positivo, o null.
 * Util para los identificadores que llegan de un formulario o de la URL.
 */
export function comoIdentificador(valor: unknown): number | null {
  if (typeof valor !== "string" && typeof valor !== "number") return null;

  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

// ---------------------------------------------------------------------------
// Validadores por formulario. Cada uno devuelve los valores ya limpios junto
// con los errores encontrados, para que la action decida si continuar.
// ---------------------------------------------------------------------------

export type Validacion<T> = {
  valores: T;
  errores: ErroresCampo;
  valido: boolean;
};

function resultado<T>(valores: T, errores: ErroresCampo): Validacion<T> {
  return { valores, errores, valido: Object.keys(errores).length === 0 };
}

/** Credenciales de inicio de sesion. */
export function validarCredenciales(
  datos: FormData,
): Validacion<{ email: string; password: string }> {
  const email = limpiarTexto(datos.get("email"), LIMITES.email).toLowerCase();
  const password = typeof datos.get("password") === "string"
    ? (datos.get("password") as string)
    : "";

  const errores: ErroresCampo = {};

  if (!email) {
    errores.email = "Escribe tu correo";
  } else if (!esEmail(email)) {
    errores.email = "El correo no tiene un formato valido";
  }

  if (!password) {
    errores.password = "Escribe tu contrasena";
  }

  return resultado({ email, password }, errores);
}

/** Datos personales que cada quien puede cambiar de su propio perfil. */
export function validarPerfil(
  datos: FormData,
): Validacion<{ nombre: string; apellido: string; telefono: string | null }> {
  const nombre = limpiarTexto(datos.get("nombre"), LIMITES.nombre);
  const apellido = limpiarTexto(datos.get("apellido"), LIMITES.apellido);
  const telefono = limpiarOpcional(datos.get("telefono"), LIMITES.telefono);

  const errores: ErroresCampo = {};

  if (!nombre) errores.nombre = "Escribe tu nombre";
  if (!apellido) errores.apellido = "Escribe tu apellido";
  if (telefono && !/^[\d\s+()-]{7,}$/.test(telefono)) {
    errores.telefono = "El telefono solo puede tener numeros, espacios y + ( ) -";
  }

  return resultado({ nombre, apellido, telefono }, errores);
}

/**
 * Alta de una empresa cliente.
 *
 * Solo el nombre es obligatorio, y eso viene de la base: es la unica columna
 * con NOT NULL y con un CHECK que exige que no quede en blanco. El resto se
 * puede completar despues.
 *
 * El SECTOR merece una nota, porque parece un dato administrativo y no lo es:
 * de el sale el escalon del medio de la resolucion de regla del auditor
 * —cliente, luego sector, luego el estandar de la casa—. Una empresa sin
 * sector se queda sin ese escalon.
 */
export function validarEmpresa(datos: FormData): Validacion<{
  nombre: string;
  rif: string | null;
  sector: string | null;
  telefono: string | null;
  direccion: string | null;
}> {
  const nombre = limpiarTexto(datos.get("nombre"), LIMITES.empresa);
  const rif = limpiarOpcional(datos.get("rif"), LIMITES.rif);
  const sector = limpiarOpcional(datos.get("sector"), LIMITES.sector);
  const telefono = limpiarOpcional(datos.get("telefono"), LIMITES.telefono);
  const direccion = limpiarOpcional(datos.get("direccion"), LIMITES.direccion);

  const errores: ErroresCampo = {};

  if (!nombre) errores.nombre = "Escribe el nombre de la empresa";

  if (telefono && !/^[\d\s+()-]{7,}$/.test(telefono)) {
    errores.telefono = "El telefono solo puede tener numeros, espacios y + ( ) -";
  }

  return resultado({ nombre, rif, sector, telefono, direccion }, errores);
}

/** Cambio de contrasena desde el perfil. */
export function validarCambioPassword(
  datos: FormData,
): Validacion<{ actual: string; nueva: string; confirmacion: string }> {
  const leer = (campo: string): string => {
    const valor = datos.get(campo);
    return typeof valor === "string" ? valor : "";
  };

  const actual = leer("passwordActual");
  const nueva = leer("passwordNueva");
  const confirmacion = leer("passwordConfirmacion");

  const errores: ErroresCampo = {};

  if (!actual) errores.passwordActual = "Escribe tu contrasena actual";

  const problema = validarPassword(nueva);
  if (problema) errores.passwordNueva = problema;

  if (nueva !== confirmacion) {
    errores.passwordConfirmacion = "Las contrasenas no coinciden";
  }

  if (!problema && nueva === actual) {
    errores.passwordNueva = "La contrasena nueva debe ser distinta de la actual";
  }

  return resultado({ actual, nueva, confirmacion }, errores);
}
