/**
 * Lo que comparten los scripts de Drive: la peticion a Google, la renovacion
 * del acceso, las carpetas y la escritura del .env.
 *
 * DESARROLLO Y PRODUCCION, EN CARPETAS DISTINTAS
 * ----------------------------------------------
 * Las dos usan la misma cuenta de Google (decidido el 2026-10-26), asi que lo
 * unico que las separa es la carpeta raiz:
 *
 *   ConejoApp/               produccion: sus ids van en Vercel
 *   ConejoApp-Desarrollo/    desarrollo: sus ids van en el .env local
 *
 * Cada una con Piezas, Comprobantes y Perfiles dentro. La de desarrollo se
 * puede llamar de otra forma con DRIVE_RAIZ en el .env, pero nunca como la de
 * produccion: los scripts lo rechazan.
 */
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const ARCHIVO_ENV = join(import.meta.dirname, "..", ".env");

export const API = "https://www.googleapis.com/drive/v3";
export const API_SUBIDA = "https://www.googleapis.com/upload/drive/v3";
export const TIPO_CARPETA = "application/vnd.google-apps.folder";

export const RAIZ_PRODUCCION = "ConejoApp";

/** Cada subcarpeta y la variable que guarda su id. */
export const SUBCARPETAS = [
  { nombre: "Piezas", variable: "DRIVE_CARPETA_PIEZAS_ID" },
  { nombre: "Comprobantes", variable: "DRIVE_CARPETA_COMPROBANTES_ID" },
  { nombre: "Perfiles", variable: "DRIVE_CARPETA_PERFILES_ID" },
];

/** La raiz de desarrollo. Lanza si coincide con la de produccion. */
export function raizDesarrollo() {
  const raiz = process.env.DRIVE_RAIZ?.trim() || "ConejoApp-Desarrollo";

  if (raiz === RAIZ_PRODUCCION) {
    throw new Error(
      `DRIVE_RAIZ no puede ser «${RAIZ_PRODUCCION}»: es la carpeta de produccion`,
    );
  }

  return raiz;
}

/** Escribe o reemplaza una variable del .env sin tocar las demas. */
export async function guardarEnEnv(clave, valor) {
  const contenido = await readFile(ARCHIVO_ENV, "utf8");
  const linea = new RegExp(`^${clave}=.*$`, "m");

  if (linea.test(contenido)) {
    await writeFile(ARCHIVO_ENV, contenido.replace(linea, () => `${clave}=${valor}`));
  } else {
    await appendFile(ARCHIVO_ENV, `${contenido.endsWith("\n") ? "" : "\n"}${clave}=${valor}\n`);
  }
}

/** Una peticion a Google que falla con el mensaje que Google devuelve. */
export async function pedir(url, opciones) {
  const respuesta = await fetch(url, opciones);
  const texto = await respuesta.text();

  if (!respuesta.ok) {
    throw new Error(`Google respondio ${respuesta.status}: ${texto}`);
  }

  return texto ? JSON.parse(texto) : null;
}

/** Cambia el refresh token por un token de acceso de una hora. */
export async function renovar(clientId, secreto, refreshToken) {
  const tokens = await pedir("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: secreto,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  return tokens.access_token;
}

/** El token de acceso con la autorizacion que ya hay en el .env. */
export async function accesoDelEnv() {
  const clientId = process.env.DRIVE_CLIENT_ID;
  const secreto = process.env.SECRET_DRIVE_KEY1;
  const refreshToken = process.env.DRIVE_REFRESH_TOKEN;

  if (!clientId || !secreto || !refreshToken) {
    throw new Error(
      "Faltan DRIVE_CLIENT_ID, SECRET_DRIVE_KEY1 o DRIVE_REFRESH_TOKEN: ejecuta antes npm run google:autorizar",
    );
  }

  return renovar(clientId, secreto, refreshToken);
}

/** Lista lo que hay dentro de `padre` (sin la papelera), pagina a pagina. */
export async function listar(token, padre, campos = "id,name,mimeType,size,createdTime") {
  const encontrados = [];
  let pagina;

  do {
    const url = new URL(`${API}/files`);
    url.searchParams.set("q", `'${padre}' in parents and trashed = false`);
    url.searchParams.set("fields", `nextPageToken,files(${campos})`);
    url.searchParams.set("pageSize", "1000");
    if (pagina) url.searchParams.set("pageToken", pagina);

    const respuesta = await pedir(url, { headers: { Authorization: `Bearer ${token}` } });
    encontrados.push(...respuesta.files);
    pagina = respuesta.nextPageToken;
  } while (pagina);

  return encontrados;
}

/** El id de la carpeta `nombre` dentro de `padre`, o null si no existe. */
export async function buscarCarpeta(token, nombre, padre) {
  const url = new URL(`${API}/files`);
  url.searchParams.set(
    "q",
    [
      `name = '${nombre.replace(/'/g, "\\'")}'`,
      `mimeType = '${TIPO_CARPETA}'`,
      `'${padre}' in parents`,
      "trashed = false",
    ].join(" and "),
  );
  url.searchParams.set("fields", "files(id)");

  const { files } = await pedir(url, { headers: { Authorization: `Bearer ${token}` } });
  return files[0]?.id ?? null;
}

/** Devuelve el id de la carpeta, creandola dentro de `padre` si no existe. */
export async function carpeta(token, nombre, padre) {
  const existente = await buscarCarpeta(token, nombre, padre);
  if (existente) return existente;

  const creada = await pedir(`${API}/files?fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: nombre, mimeType: TIPO_CARPETA, parents: [padre] }),
  });

  console.log(`Carpeta creada: ${nombre}`);
  return creada.id;
}

/** Crea (si faltan) la raiz y sus tres subcarpetas. Devuelve sus ids. */
export async function arbol(token, raiz) {
  const raizId = await carpeta(token, raiz, "root");
  const ids = {};

  for (const { nombre, variable } of SUBCARPETAS) {
    ids[variable] = await carpeta(token, nombre, raizId);
  }

  return { raizId, ids };
}
