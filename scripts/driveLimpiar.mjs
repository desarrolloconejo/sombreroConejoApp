/**
 * Manda a la papelera de Drive los archivos de la carpeta de DESARROLLO.
 *
 *   npm run drive:limpiar                 solo lista lo que hay
 *   npm run drive:limpiar -- --confirmar  lo manda a la papelera
 *
 * Son los archivos de las pruebas: versiones de piezas, comprobantes y fotos
 * subidos con ARCHIVOS_MODO=real en local. Las carpetas se quedan, vacias.
 *
 * NUNCA toca la carpeta de produccion: trabaja sobre ConejoApp-Desarrollo (o
 * DRIVE_RAIZ), y DRIVE_RAIZ no puede valer ConejoApp.
 *
 * No borra para siempre: los archivos quedan en la papelera de la cuenta, de
 * donde se pueden recuperar hasta que Google la vacie (30 dias) o se vacie a
 * mano. Las filas de la base local que los apuntaban se quedan sin archivo:
 * la app lo dira al abrirlos. Son datos de prueba.
 *
 * Con el permiso drive.file solo se ven los archivos que creo la aplicacion:
 * nada mas del Drive de la cuenta aparece aqui ni se puede tocar.
 */
import {
  API,
  TIPO_CARPETA,
  accesoDelEnv,
  buscarCarpeta,
  listar,
  pedir,
  raizDesarrollo,
} from "./driveComun.mjs";

const CONFIRMAR = process.argv.includes("--confirmar");

/** Todos los archivos (no carpetas) bajo `carpetaId`, con su ruta. */
async function archivosBajo(token, carpetaId, ruta) {
  const encontrados = [];

  for (const elemento of await listar(token, carpetaId)) {
    const suRuta = `${ruta}/${elemento.name}`;

    if (elemento.mimeType === TIPO_CARPETA) {
      encontrados.push(...(await archivosBajo(token, elemento.id, suRuta)));
    } else {
      encontrados.push({ ...elemento, ruta: suRuta });
    }
  }

  return encontrados;
}

function tamano(bytes) {
  const n = Number(bytes ?? 0);
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} kB`;
}

async function principal() {
  const raiz = raizDesarrollo();
  const token = await accesoDelEnv();

  const raizId = await buscarCarpeta(token, raiz, "root");
  if (!raizId) {
    console.log(`No hay carpeta ${raiz}/ en Drive. Si aun se llama ConejoApp/, ejecuta antes npm run drive:separar.`);
    return;
  }

  const archivos = await archivosBajo(token, raizId, raiz);

  if (archivos.length === 0) {
    console.log(`${raiz}/ no tiene archivos. Nada que limpiar.`);
    return;
  }

  const total = archivos.reduce((suma, a) => suma + Number(a.size ?? 0), 0);
  console.log(`${archivos.length} archivos en ${raiz}/ (${tamano(total)}):\n`);
  for (const a of archivos.sort((x, y) => x.ruta.localeCompare(y.ruta))) {
    console.log(`  ${a.createdTime.slice(0, 10)}  ${tamano(a.size).padStart(8)}  ${a.ruta}`);
  }

  if (!CONFIRMAR) {
    console.log("\nNo se ha tocado nada. Para mandarlos a la papelera:");
    console.log("  npm run drive:limpiar -- --confirmar");
    return;
  }

  for (const a of archivos) {
    await pedir(`${API}/files/${a.id}?fields=id`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ trashed: true }),
    });
  }

  console.log(`\n${archivos.length} archivos enviados a la papelera de Drive.`);
  console.log("Se pueden recuperar desde la papelera mientras no se vacie.");
}

principal().catch((error) => {
  console.error("\nNo se pudo limpiar Drive:", error instanceof Error ? error.message : error);
  process.exit(1);
});
