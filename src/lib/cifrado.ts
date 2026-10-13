import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifrado de los secretos que la aplicacion tiene que poder volver a leer.
 *
 * Una contrasena se guarda como hash, porque solo hay que compararla. El
 * secreto de la verificacion en dos pasos no: el servidor lo necesita en claro
 * cada vez que calcula un codigo. Por eso se cifra, con una clave que NO esta
 * en la base: vive en una variable de entorno. Quien se lleve una copia de la
 * base no puede generar codigos de nadie.
 *
 * AES-256-GCM: ademas de ocultar el dato, detecta si alguien lo altero.
 */

const ALGORITMO = "aes-256-gcm";

/** La clave de desarrollo de `.env.example`. En produccion se rechaza. */
const CLAVE_DE_EJEMPLO = "Y2xhdmUtZGVzYXJyb2xsby1uby11c2FyLWVuLXByb2Q";

/**
 * La clave, leida en cada llamada y no al cargar el modulo: durante el build
 * no hay variables de entorno de ejecucion.
 *
 * Son 32 bytes en base64url, que es lo que pide AES-256.
 */
function clave(): Buffer {
  const texto = process.env.TOTP_CLAVE;

  if (!texto) {
    throw new Error("Falta la variable de entorno TOTP_CLAVE");
  }

  if (texto === CLAVE_DE_EJEMPLO && process.env.NODE_ENV === "production") {
    throw new Error(
      "TOTP_CLAVE sigue siendo la de ejemplo de .env.example. Genera una propia",
    );
  }

  const bytes = Buffer.from(texto, "base64url");

  if (bytes.length !== 32) {
    throw new Error("TOTP_CLAVE tiene que ser de 32 bytes, en base64url");
  }

  return bytes;
}

/**
 * Cifra un texto. El resultado lleva dentro todo lo que hace falta para
 * descifrarlo salvo la clave: `v1.<vector>.<marca>.<datos>`.
 *
 * El vector es nuevo en cada llamada, asi que cifrar dos veces lo mismo da dos
 * resultados distintos. El prefijo de version deja cambiar el esquema algun
 * dia sin romper lo ya guardado.
 */
export function cifrar(texto: string): string {
  const vector = randomBytes(12);
  const cifrador = createCipheriv(ALGORITMO, clave(), vector);
  const datos = Buffer.concat([cifrador.update(texto, "utf8"), cifrador.final()]);

  return [
    "v1",
    vector.toString("base64url"),
    cifrador.getAuthTag().toString("base64url"),
    datos.toString("base64url"),
  ].join(".");
}

/**
 * Descifra lo que produjo `cifrar`. Devuelve null si el texto no tiene la
 * forma esperada, si se altero o si la clave no es la que lo cifro.
 *
 * No lanza por un dato corrupto: quien llama decide que hacer, y casi siempre
 * es tratarlo como «no tiene los dos pasos bien configurados».
 */
export function descifrar(cifrado: string): string | null {
  const [version, vector, marca, datos] = cifrado.split(".");

  if (version !== "v1" || !vector || !marca || datos === undefined) return null;

  try {
    const descifrador = createDecipheriv(
      ALGORITMO,
      clave(),
      Buffer.from(vector, "base64url"),
    );
    descifrador.setAuthTag(Buffer.from(marca, "base64url"));

    return Buffer.concat([
      descifrador.update(Buffer.from(datos, "base64url")),
      descifrador.final(),
    ]).toString("utf8");
  } catch (error) {
    // Una clave ausente o mal formada SI es un fallo de configuracion, y tiene
    // que verse: no se disfraza de «dato corrupto».
    if (error instanceof Error && error.message.includes("TOTP_CLAVE")) throw error;

    return null;
  }
}
