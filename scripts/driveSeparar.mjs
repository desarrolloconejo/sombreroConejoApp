/**
 * Separa en Drive las carpetas de desarrollo y de produccion.
 *
 *   npm run drive:separar
 *
 * Hasta el 2026-10-27 desarrollo guardaba en ConejoApp/, el nombre que toca a
 * produccion, y ahi quedaron los archivos de las pruebas. Este script:
 *
 *   1. Si existe ConejoApp/ y no la de desarrollo, RENOMBRA ConejoApp/ a la de
 *      desarrollo (ConejoApp-Desarrollo, o DRIVE_RAIZ). Los ids no cambian,
 *      asi que el .env y la base local siguen valiendo, y los archivos de
 *      prueba se quedan en desarrollo: se limpian con npm run drive:limpiar.
 *   2. Crea la de produccion, ConejoApp/, con Piezas, Comprobantes y
 *      Perfiles, si no existe.
 *   3. Escribe DRIVE_RAIZ en el .env e IMPRIME los tres ids de produccion,
 *      que van en Vercel. No los escribe en el .env: alli van los de
 *      desarrollo.
 *
 * Usa la autorizacion del .env (npm run google:autorizar). Produccion usa la
 * misma cuenta y el mismo DRIVE_REFRESH_TOKEN.
 *
 * Se puede ejecutar mas de una vez: lo que ya existe lo deja como esta.
 */
import {
  API,
  RAIZ_PRODUCCION,
  SUBCARPETAS,
  accesoDelEnv,
  arbol,
  buscarCarpeta,
  guardarEnEnv,
  listar,
  pedir,
  raizDesarrollo,
} from "./driveComun.mjs";

/** Si la carpeta de piezas del .env cuelga de `raizId`. */
async function esDelEnv(token, raizId) {
  const piezas = process.env.DRIVE_CARPETA_PIEZAS_ID;
  if (!piezas) return false;

  const { parents = [] } = await pedir(`${API}/files/${piezas}?fields=parents`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parents.includes(raizId);
}

async function principal() {
  const token = await accesoDelEnv();
  const desarrollo = raizDesarrollo();

  const vieja = await buscarCarpeta(token, RAIZ_PRODUCCION, "root");
  const deDesarrollo = await buscarCarpeta(token, desarrollo, "root");

  if (vieja && !deDesarrollo) {
    // Solo se renombra si es la que usa este .env. Si no, podria ser ya la
    // de produccion, con archivos reales: mejor parar y decidir a mano.
    if (!(await esDelEnv(token, vieja))) {
      throw new Error(
        `${RAIZ_PRODUCCION}/ existe pero no es la del .env (DRIVE_CARPETA_PIEZAS_ID no esta dentro). ` +
          "Puede ser ya la de produccion: no se renombra. Revisalo en Drive.",
      );
    }

    const dentro = await listar(token, vieja, "id");
    await pedir(`${API}/files/${vieja}?fields=id`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: desarrollo }),
    });
    console.log(
      `${RAIZ_PRODUCCION}/ pasa a llamarse ${desarrollo}/ (${dentro.length} elementos dentro). ` +
        "Sus ids no cambian: el .env sigue valiendo.",
    );
  } else if (vieja && deDesarrollo) {
    console.log(`${desarrollo}/ y ${RAIZ_PRODUCCION}/ ya existen: no se renombra nada.`);
  } else {
    console.log(`No habia ${RAIZ_PRODUCCION}/ que renombrar.`);
  }

  await guardarEnEnv("DRIVE_RAIZ", desarrollo);
  console.log(`DRIVE_RAIZ=${desarrollo} guardado en el .env`);

  const { raizId, ids } = await arbol(token, RAIZ_PRODUCCION);

  console.log(`\nCarpeta de produccion: https://drive.google.com/drive/folders/${raizId}`);
  console.log("Pon estas tres en Vercel (Production, Sensitive):\n");
  for (const { variable } of SUBCARPETAS) {
    console.log(`  ${variable}=${ids[variable]}`);
  }
}

principal().catch((error) => {
  console.error("\nNo se pudo separar Drive:", error instanceof Error ? error.message : error);
  process.exit(1);
});
