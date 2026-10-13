import { SignJWT, jwtVerify } from "jose";
import type { NombreRol, Sesion, SlugCargo, TipoUsuario } from "@/types";

/**
 * Emision y verificacion del token de sesion.
 *
 * Este modulo lo usan tanto las actions como el proxy, asi que no puede tocar
 * la base de datos ni depender de nada del ciclo de peticion: solo firma y
 * verifica.
 */

const ALGORITMO = "HS256";
const EMISOR = "conejo-app";
const AUDIENCIA = "conejo-app";

const LONGITUD_MINIMA_SECRETO = 32;

/**
 * El secreto de ejemplo de `.env.example`.
 *
 * Mide mas de 32 caracteres, asi que pasaria la comprobacion de longitud, y
 * esta publicado en el repositorio: un despliegue que olvidara cambiarlo
 * firmaria con una clave que conoce cualquiera. En produccion se rechaza.
 */
const SECRETO_DE_EJEMPLO = "cambiar-este-secreto-antes-de-produccion-min-32-chars";

/**
 * La clave se lee en cada llamada, no al cargar el modulo.
 *
 * Durante el build de Next los modulos se evaluan sin las variables de entorno
 * de ejecucion; leerla arriba haria fallar la compilacion.
 */
function claveSecreta(): Uint8Array {
  const secreto = process.env.JWT_SECRET;

  if (!secreto) {
    throw new Error("Falta la variable de entorno JWT_SECRET");
  }

  if (secreto.length < LONGITUD_MINIMA_SECRETO) {
    throw new Error(
      `JWT_SECRET debe tener al menos ${LONGITUD_MINIMA_SECRETO} caracteres`,
    );
  }

  if (secreto === SECRETO_DE_EJEMPLO && process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET sigue siendo el de ejemplo de .env.example. Genera uno propio",
    );
  }

  return new TextEncoder().encode(secreto);
}

/** Cuanto dura la sesion. Formato admitido por jose: "8h", "30m", "7d". */
function duracion(): string {
  return process.env.JWT_EXPIRACION ?? "8h";
}

const TIPOS_VALIDOS: readonly TipoUsuario[] = ["trabajador", "cliente"];
const ROLES_VALIDOS: readonly NombreRol[] = ["admin", "trabajador", "cliente"];

const CARGOS_VALIDOS: readonly SlugCargo[] = [
  "direccion",
  "cuentas",
  "redes",
  "diseno",
  "produccion",
  "tecnologia",
  "administracion",
];

/**
 * Convierte el contenido del token en una Sesion, o devuelve null.
 *
 * La firma garantiza que el token no fue alterado, pero no que su contenido
 * tenga la forma esperada: un token viejo, emitido antes de un cambio en la
 * estructura, sigue teniendo una firma valida. Por eso se comprueba campo a
 * campo en lugar de confiar en el tipo.
 */
function comoSesion(contenido: unknown, sub: string | undefined): Sesion | null {
  if (typeof contenido !== "object" || contenido === null) return null;

  const datos = contenido as Record<string, unknown>;
  const usuarioId = Number(sub);

  if (!Number.isInteger(usuarioId) || usuarioId <= 0) return null;
  if (typeof datos.email !== "string" || datos.email.length === 0) return null;
  if (typeof datos.nombre !== "string") return null;
  if (!TIPOS_VALIDOS.includes(datos.tipo as TipoUsuario)) return null;
  if (!ROLES_VALIDOS.includes(datos.rol as NombreRol)) return null;

  // El ambito puede faltar (un trabajador no tiene empresa y un cliente no
  // tiene cargo), pero si viene tiene que ser un valor conocido. Un cargo
  // inventado se rechaza aunque la firma sea correcta.
  const cargo =
    datos.cargo === null || datos.cargo === undefined
      ? null
      : CARGOS_VALIDOS.includes(datos.cargo as SlugCargo)
        ? (datos.cargo as SlugCargo)
        : undefined;
  if (cargo === undefined) return null;

  const empresaId =
    datos.empresaId === null || datos.empresaId === undefined
      ? null
      : Number.isInteger(datos.empresaId) && (datos.empresaId as number) > 0
        ? (datos.empresaId as number)
        : undefined;
  if (empresaId === undefined) return null;

  return {
    usuarioId,
    email: datos.email,
    nombre: datos.nombre,
    tipo: datos.tipo as TipoUsuario,
    rol: datos.rol as NombreRol,
    cargo,
    empresaId,
  };
}

/** Emite un token firmado para una sesion. */
export async function firmarSesion(sesion: Sesion): Promise<string> {
  return new SignJWT({
    email: sesion.email,
    nombre: sesion.nombre,
    tipo: sesion.tipo,
    rol: sesion.rol,
    cargo: sesion.cargo,
    empresaId: sesion.empresaId,
  })
    .setProtectedHeader({ alg: ALGORITMO })
    .setSubject(String(sesion.usuarioId))
    .setIssuedAt()
    .setIssuer(EMISOR)
    .setAudience(AUDIENCIA)
    .setExpirationTime(duracion())
    .sign(claveSecreta());
}

/**
 * Verifica un token y devuelve la sesion, o null si no es valido.
 *
 * Se fija el algoritmo de forma explicita. Sin eso, un atacante podria
 * presentar un token que declare otro algoritmo en su cabecera y forzar a la
 * libreria a verificarlo de una manera que no es la prevista.
 */
export async function verificarSesion(token: string): Promise<Sesion | null> {
  try {
    const { payload } = await jwtVerify(token, claveSecreta(), {
      algorithms: [ALGORITMO],
      issuer: EMISOR,
      audience: AUDIENCIA,
    });

    return comoSesion(payload, payload.sub);
  } catch {
    // Token alterado, caducado, firmado con otra clave o mal formado.
    // En todos los casos la respuesta es la misma: no hay sesion.
    return null;
  }
}
