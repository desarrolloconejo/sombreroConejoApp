/**
 * Autoriza la aplicacion contra Google Drive y comprueba que puede guardar.
 *
 *   npm run drive:probar
 *
 * Se ejecuta en el HOST, no en el contenedor: abre un puerto local para
 * recibir la respuesta de Google y hace falta el navegador de quien autoriza.
 *
 * Que hace, en orden:
 *   1. Si no hay DRIVE_REFRESH_TOKEN, pide la autorizacion en el navegador y
 *      lo guarda en el .env. Solo ocurre la primera vez.
 *   2. Crea ConejoApp/Comprobantes si no existe, y guarda su id en el .env.
 *   3. Sube un archivo de prueba, lo vuelve a leer y lo borra.
 *
 * No usa ninguna libreria: la API de Drive es HTTP y Node trae fetch.
 *
 * SOBRE EL PERMISO QUE SE PIDE
 * ----------------------------
 * El alcance es `drive.file`: la aplicacion solo ve los archivos y carpetas
 * que ELLA crea. No puede leer el resto del Drive de quien autoriza. Por eso
 * las carpetas las crea este script y no se hacen a mano: una carpeta creada
 * desde la web de Drive seria invisible para la aplicacion.
 */
import { randomBytes } from "node:crypto";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";

const RAIZ = join(import.meta.dirname, "..");
const ARCHIVO_ENV = join(RAIZ, ".env");

const PUERTO = 53682;
const REDIRECCION = `http://127.0.0.1:${PUERTO}`;
const ALCANCE = "https://www.googleapis.com/auth/drive.file";

const CARPETAS = ["ConejoApp", "Comprobantes"];
const TIPO_CARPETA = "application/vnd.google-apps.folder";

const API = "https://www.googleapis.com/drive/v3";
const API_SUBIDA = "https://www.googleapis.com/upload/drive/v3";

/** Escribe o reemplaza una variable del .env sin tocar las demas. */
async function guardarEnEnv(clave, valor) {
  const contenido = await readFile(ARCHIVO_ENV, "utf8");
  const linea = new RegExp(`^${clave}=.*$`, "m");

  if (linea.test(contenido)) {
    await writeFile(ARCHIVO_ENV, contenido.replace(linea, () => `${clave}=${valor}`));
  } else {
    await appendFile(ARCHIVO_ENV, `${contenido.endsWith("\n") ? "" : "\n"}${clave}=${valor}\n`);
  }
}

/** Una peticion a Google que falla con el mensaje que Google devuelve. */
async function pedir(url, opciones) {
  const respuesta = await fetch(url, opciones);
  const texto = await respuesta.text();

  if (!respuesta.ok) {
    throw new Error(`Google respondio ${respuesta.status}: ${texto}`);
  }

  return texto ? JSON.parse(texto) : null;
}

/** Espera a que Google devuelva el codigo de autorizacion al puerto local. */
function esperarCodigo(estado) {
  return new Promise((resolver, rechazar) => {
    const servidor = createServer((peticion, respuesta) => {
      const url = new URL(peticion.url ?? "/", REDIRECCION);
      const codigo = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      // El navegador pide tambien /favicon.ico: no es la respuesta de Google.
      if (!codigo && !error) {
        respuesta.writeHead(404).end();
        return;
      }

      const valido = url.searchParams.get("state") === estado;

      respuesta.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      respuesta.end(
        codigo && valido
          ? "<p>Autorizacion recibida. Ya puedes cerrar esta pestana.</p>"
          : "<p>La autorizacion no se completo. Vuelve a la terminal.</p>",
      );
      servidor.close();

      if (error) rechazar(new Error(`Google rechazo la autorizacion: ${error}`));
      else if (!valido) rechazar(new Error("El parametro state no coincide"));
      else resolver(codigo);
    });

    servidor.on("error", rechazar);
    servidor.listen(PUERTO, "127.0.0.1");
  });
}

/** El flujo de autorizacion, que solo hace falta una vez. */
async function autorizar(clientId, secreto) {
  const estado = randomBytes(16).toString("hex");

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", REDIRECCION);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", ALCANCE);
  url.searchParams.set("state", estado);
  // offline + consent es lo que hace que Google entregue un refresh token.
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");

  console.log("\nAbre este enlace en el navegador y autoriza con la cuenta");
  console.log("de Google en cuyo Drive se van a guardar los comprobantes:\n");
  console.log(url.toString());
  console.log("\nEsperando la respuesta de Google...");

  const codigo = await esperarCodigo(estado);

  const tokens = await pedir("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      code: codigo,
      client_id: clientId,
      client_secret: secreto,
      redirect_uri: REDIRECCION,
      grant_type: "authorization_code",
    }),
  });

  if (!tokens.refresh_token) {
    throw new Error("Google no devolvio un refresh token");
  }

  await guardarEnEnv("DRIVE_REFRESH_TOKEN", tokens.refresh_token);
  console.log("Autorizado. DRIVE_REFRESH_TOKEN guardado en el .env");

  return tokens.access_token;
}

/** Cambia el refresh token por un token de acceso de una hora. */
async function renovar(clientId, secreto, refreshToken) {
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

/** Devuelve el id de la carpeta, creandola dentro de `padre` si no existe. */
async function carpeta(token, nombre, padre) {
  const consulta = [
    `name = '${nombre}'`,
    `mimeType = '${TIPO_CARPETA}'`,
    `'${padre}' in parents`,
    "trashed = false",
  ].join(" and ");

  const url = new URL(`${API}/files`);
  url.searchParams.set("q", consulta);
  url.searchParams.set("fields", "files(id)");

  const cabeceras = { Authorization: `Bearer ${token}` };
  const { files } = await pedir(url, { headers: cabeceras });

  if (files.length > 0) return files[0].id;

  const creada = await pedir(`${API}/files?fields=id`, {
    method: "POST",
    headers: { ...cabeceras, "Content-Type": "application/json" },
    body: JSON.stringify({ name: nombre, mimeType: TIPO_CARPETA, parents: [padre] }),
  });

  console.log(`Carpeta creada: ${nombre}`);
  return creada.id;
}

/** Sube un archivo pequeno, lo lee de vuelta y lo borra. */
async function probarSubida(token, carpetaId) {
  const cabeceras = { Authorization: `Bearer ${token}` };
  const contenido = `Prueba de Conejo App, ${new Date().toISOString()}`;

  const cuerpo = new FormData();
  cuerpo.append(
    "metadata",
    new Blob([JSON.stringify({ name: "prueba-conexion.txt", parents: [carpetaId] })], {
      type: "application/json",
    }),
  );
  cuerpo.append("file", new Blob([contenido], { type: "text/plain" }));

  const subido = await pedir(`${API_SUBIDA}/files?uploadType=multipart&fields=id,name,size`, {
    method: "POST",
    headers: cabeceras,
    body: cuerpo,
  });
  console.log(`Subida correcta: ${subido.name} (${subido.size} bytes)`);

  const leido = await fetch(`${API}/files/${subido.id}?alt=media`, { headers: cabeceras });
  if ((await leido.text()) !== contenido) {
    throw new Error("Lo leido de Drive no coincide con lo subido");
  }
  console.log("Lectura correcta: el contenido coincide");

  await pedir(`${API}/files/${subido.id}`, { method: "DELETE", headers: cabeceras });
  console.log("Archivo de prueba borrado");
}

async function principal() {
  const clientId = process.env.DRIVE_CLIENT_ID;
  const secreto = process.env.SECRET_DRIVE_KEY1;

  if (!clientId || !secreto) {
    throw new Error("Faltan DRIVE_CLIENT_ID o SECRET_DRIVE_KEY1 en el .env");
  }

  const refreshToken = process.env.DRIVE_REFRESH_TOKEN;
  const token = refreshToken
    ? await renovar(clientId, secreto, refreshToken)
    : await autorizar(clientId, secreto);

  let carpetaId = "root";
  for (const nombre of CARPETAS) {
    carpetaId = await carpeta(token, nombre, carpetaId);
  }

  await guardarEnEnv("DRIVE_CARPETA_COMPROBANTES_ID", carpetaId);
  console.log(`Carpeta ${CARPETAS.join("/")} lista`);
  console.log(`https://drive.google.com/drive/folders/${carpetaId}`);

  await probarSubida(token, carpetaId);

  console.log("\nDrive funciona: la aplicacion puede guardar y leer comprobantes.");
}

principal().catch((error) => {
  console.error("\nFallo la prueba de Drive:", error instanceof Error ? error.message : error);
  process.exit(1);
});
