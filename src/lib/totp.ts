import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Codigos de un solo uso basados en la hora (TOTP, RFC 6238).
 *
 * Es el estandar que implementan Google Authenticator, Microsoft
 * Authenticator y Authy. El servidor y el telefono comparten un secreto, y los
 * dos calculan el mismo codigo de seis digitos a partir de la hora. No hay
 * llamada a ningun servicio, ni de Google ni de nadie: por eso no hace falta
 * libreria, basta el HMAC que trae Node.
 *
 * Todo aqui son funciones puras. Guardar el secreto, cifrarlo y decidir quien
 * entra es cosa de quien las llama.
 */

/** Cada cuanto cambia el codigo. Es lo que esperan todas las apps. */
export const SEGUNDOS_POR_PASO = 30;

const DIGITOS = 6;

/**
 * Cuantos pasos de desfase se toleran, hacia atras y hacia delante.
 *
 * El reloj de un telefono no va al segundo con el del servidor, y entre leer
 * el codigo y enviarlo pasa un rato. Con uno, un codigo vale como mucho minuto
 * y medio: suficiente para teclearlo, corto para quien lo vea por encima del
 * hombro.
 */
const TOLERANCIA = 1;

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Codifica bytes en Base32, que es como las apps esperan recibir el secreto. */
export function aBase32(bytes: Uint8Array): string {
  let bits = 0;
  let valor = 0;
  let texto = "";

  for (const byte of bytes) {
    valor = (valor << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      texto += BASE32[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) texto += BASE32[(valor << (5 - bits)) & 31];

  return texto;
}

/** Decodifica Base32. Devuelve null si el texto trae algo que no lo es. */
export function deBase32(texto: string): Buffer | null {
  const limpio = texto.replace(/[\s=-]/g, "").toUpperCase();

  if (limpio.length === 0 || !/^[A-Z2-7]+$/.test(limpio)) return null;

  const bytes: number[] = [];
  let bits = 0;
  let valor = 0;

  for (const letra of limpio) {
    valor = (valor << 5) | BASE32.indexOf(letra);
    bits += 5;

    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/** Un secreto nuevo: 20 bytes al azar, en Base32. */
export function generarSecreto(): string {
  return aBase32(randomBytes(20));
}

/** En que intervalo de 30 segundos cae un instante. */
export function pasoDe(instanteMs: number): number {
  return Math.floor(instanteMs / 1000 / SEGUNDOS_POR_PASO);
}

/** El codigo que corresponde a un secreto en un paso concreto. */
export function codigoDelPaso(secreto: string, paso: number): string | null {
  const clave = deBase32(secreto);

  if (!clave) return null;

  // El paso va como entero de 64 bits, el mas significativo primero.
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(paso));

  const resumen = createHmac("sha1", clave).update(contador).digest();

  // «Truncado dinamico»: los cuatro bits bajos del ultimo byte dicen de donde
  // se toman los 31 bits que forman el numero.
  const desde = resumen[resumen.length - 1] & 15;
  const numero = resumen.readUInt32BE(desde) & 0x7fffffff;

  return String(numero % 10 ** DIGITOS).padStart(DIGITOS, "0");
}

/** El codigo vigente ahora mismo. Lo usan las pruebas, no el login. */
export function codigoEn(secreto: string, instanteMs: number): string | null {
  return codigoDelPaso(secreto, pasoDe(instanteMs));
}

/**
 * Comprueba un codigo y devuelve el paso al que corresponde, o null.
 *
 * `ultimoPaso` es el del ultimo codigo que se acepto. Un codigo de ese paso o
 * de uno anterior se RECHAZA aunque sea correcto: es lo que impide usar dos
 * veces el mismo, que es justo lo que haria quien lo hubiera visto o
 * capturado. Quien llama guarda el paso devuelto para la proxima vez.
 *
 * La comparacion es en tiempo constante.
 */
export function verificarCodigo(
  secreto: string,
  codigo: string,
  instanteMs: number,
  ultimoPaso: number | null = null,
): number | null {
  const limpio = codigo.replace(/\s/g, "");

  if (!/^\d{6}$/.test(limpio)) return null;

  const recibido = Buffer.from(limpio);
  const ahora = pasoDe(instanteMs);

  for (let desfase = -TOLERANCIA; desfase <= TOLERANCIA; desfase++) {
    const paso = ahora + desfase;

    if (ultimoPaso !== null && paso <= ultimoPaso) continue;

    const esperado = codigoDelPaso(secreto, paso);

    if (esperado && timingSafeEqual(recibido, Buffer.from(esperado))) return paso;
  }

  return null;
}

/**
 * El enlace que una app de codigos entiende.
 *
 * Abierto desde el telefono, registra la cuenta sin teclear nada. Es tambien
 * lo que codificaria un QR.
 */
export function enlaceDeRegistro(secreto: string, cuenta: string, emisor: string): string {
  const etiqueta = encodeURIComponent(`${emisor}:${cuenta}`);
  const parametros = new URLSearchParams({
    secret: secreto,
    issuer: emisor,
    algorithm: "SHA1",
    digits: String(DIGITOS),
    period: String(SEGUNDOS_POR_PASO),
  });

  return `otpauth://totp/${etiqueta}?${parametros.toString()}`;
}

/** El secreto en grupos de cuatro, para quien lo teclea a mano. */
export function enGrupos(secreto: string): string {
  return secreto.match(/.{1,4}/g)?.join(" ") ?? secreto;
}

// Sin letras ni numeros que se confunden al copiarlos a mano.
const ALFABETO_RESPALDO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Cuantos codigos de respaldo recibe cada persona. */
export const CODIGOS_DE_RESPALDO = 10;

/** Un codigo de respaldo: diez caracteres al azar, como XXXXX-XXXXX. */
export function generarCodigoDeRespaldo(): string {
  let codigo = "";

  for (let posicion = 0; posicion < 10; posicion++) {
    codigo += ALFABETO_RESPALDO.charAt(randomInt(ALFABETO_RESPALDO.length));
  }

  return `${codigo.slice(0, 5)}-${codigo.slice(5)}`;
}

/**
 * Deja un codigo de respaldo como se guardo, lo escriban como lo escriban:
 * con o sin guion, con espacios, en minusculas.
 */
export function normalizarCodigoDeRespaldo(texto: string): string | null {
  const limpio = texto.replace(/[\s-]/g, "").toUpperCase();

  if (limpio.length !== 10) return null;
  if (![...limpio].every((letra) => ALFABETO_RESPALDO.includes(letra))) return null;

  return `${limpio.slice(0, 5)}-${limpio.slice(5)}`;
}
