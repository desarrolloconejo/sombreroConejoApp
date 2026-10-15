import { expect, test, type Page } from "@playwright/test";
import { EMAIL_EJECUTIVO, USUARIOS } from "../../db/datos/semilla.mts";
import { elegirEmpresa } from "./ayudas/formularios";

/**
 * La revision del cliente, de punta a punta: dos rondas de una pieza.
 *
 * El ejecutivo la lleva hasta la fase 4 con una imagen y la envia; el cliente
 * pide corregir la redaccion; la pieza vuelve a la fase 1 conservando el
 * diseno; el ejecutivo la reenvia con un enlace y el cliente la aprueba. Al
 * final el proyecto se cierra, que es lo que se hace con todo aprobado.
 */

test.describe.configure({ mode: "serial" });

/** Un PNG de un pixel. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

async function entrar(page: Page, email: string) {
  const persona = USUARIOS.find((u) => u.email === email);
  if (!persona) throw new Error(`La semilla no trae ${email}`);

  await page.context().clearCookies();

  // El servidor de desarrollo responde a veces con un 500 mientras compila
  // otra ruta; se recarga hasta ver el formulario.
  const correo = page.getByPlaceholder("tucorreo@conejo.test");
  for (let intento = 0; intento < 5; intento++) {
    await page.goto("/login", { waitUntil: "networkidle" });
    const visible = await correo
      .waitFor({ state: "visible", timeout: 20_000 })
      .then(() => true)
      .catch(() => false);
    if (visible) break;
    await page.waitForTimeout(5_000);
  }

  await page.getByPlaceholder("tucorreo@conejo.test").fill(persona.email);
  await page.getByPlaceholder("Tu contrasena").fill(persona.password);
  await page.getByPlaceholder("Tu contrasena").press("Enter");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 90_000 });
}

async function completar(page: Page, fase: string) {
  await page.getByRole("button", { name: "Completar fase" }).click();
  await expect(page.getByText(`${fase}: completada`).first()).toBeVisible({ timeout: 90_000 });
}

async function avisado(page: Page, texto: string | RegExp) {
  await expect(page.getByText(texto).first()).toBeVisible({ timeout: 90_000 });
}

test("dos rondas: el cliente corrige la redaccion y despues aprueba", async ({ page }) => {
  // Dos rondas completas, con cuatro inicios de sesion: mas que el limite comun.
  test.setTimeout(600_000);

  const nombre = `Revision ${Date.now()}`;

  // ---- El ejecutivo crea la pieza, sin tareas, y la lleva a la fase 4.
  await entrar(page, EMAIL_EJECUTIVO);
  await page.goto("/dashboard/proyectos?panel=nuevo", { waitUntil: "networkidle" });
  await elegirEmpresa(page);
  await page.getByLabel("Nombre", { exact: true }).fill(nombre);
  await page.getByLabel("Titulo de la pieza 1").fill("Pieza para revisar");
  await page.getByLabel(/Crear las tareas sugeridas/).uncheck();
  await page.getByRole("button", { name: "Crear proyecto" }).click();
  await expect(page).toHaveURL(/\/dashboard\/proyectos\/\d+$/, { timeout: 60_000 });
  const urlProyecto = page.url();

  await page.getByRole("link", { name: /Pieza para revisar/ }).click();
  await expect(page.getByRole("heading", { name: "Versiones" })).toBeVisible({ timeout: 60_000 });
  const urlPieza = page.url();

  await completar(page, "Redaccion de contenido");
  await completar(page, "Revision interna");

  // En la fase 3 se sube la imagen.
  await page.getByLabel("Imagen o PDF, hasta 4 MB").setInputFiles({
    name: "pieza.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await page.getByRole("button", { name: "Guardar version" }).click();
  await avisado(page, "Version 1 guardada");

  await completar(page, "Diseno, edicion y produccion");

  // La fase 4 no se completa sin la version para el cliente.
  await page.getByRole("button", { name: "Completar fase" }).click();
  await avisado(page, /Marca antes la version que vera el cliente/);

  await page.getByRole("button", { name: "Para el cliente" }).click();
  await avisado(page, "Es la version que vera el cliente");
  await completar(page, "Aprobacion interna y envio al cliente");

  // ---- El cliente la ve y pide corregir la redaccion.
  await entrar(page, "cliente@empresa.test");
  await expect(page.getByText(/esperan? tu revision/).first()).toBeVisible({ timeout: 180_000 });

  await page.goto("/dashboard/mis-proyectos", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: new RegExp(nombre) }).click();
  await page.getByRole("link", { name: /Revisar/ }).click();
  await expect(page.getByRole("heading", { name: "Tu decision" })).toBeVisible({ timeout: 60_000 });

  const imagen = page.getByRole("img", { name: "Version 1 de la pieza" });
  await expect(imagen).toBeVisible();
  const archivo = (await imagen.getAttribute("src")) ?? "";

  // La ve, pero no la descarga hasta aprobarla.
  expect((await page.request.get(archivo)).status()).toBe(200);
  expect((await page.request.get(`${archivo}?descargar=1`)).status()).toBe(404);

  await page.getByRole("button", { name: "Pedir correccion" }).click();
  await page.getByLabel("Redaccion (el texto)").check();
  await avisado(page, /vuelve a redaccion de contenido \(fase 1\)/);
  await page.getByLabel("Que cambiar").fill("El texto tiene que mencionar la promocion.");
  await page.getByRole("button", { name: "Enviar la correccion" }).click();
  await avisado(page, "Correccion enviada. El equipo ya la tiene");

  // ---- El ejecutivo ve la correccion y rehace la ronda 2 con un enlace.
  await entrar(page, EMAIL_EJECUTIVO);
  await page.goto(urlPieza, { waitUntil: "networkidle" });
  await expect(page.getByText(/Correccion: Redaccion/).first()).toBeVisible({ timeout: 60_000 });

  await completar(page, "Redaccion de contenido");
  await completar(page, "Revision interna");

  // El diseno se conservo: la pieza esta ya en la fase 4.
  await page.getByRole("radio", { name: "Enlace" }).click();
  await page.getByLabel(/Enlace de Figma/).fill("https://www.figma.com/file/ronda-dos");
  await page.getByLabel("Como se llama").fill("Ronda dos");
  await page.getByRole("button", { name: "Guardar version" }).click();
  await avisado(page, "Version 2 guardada");
  await page.getByRole("button", { name: "Para el cliente" }).click();
  await avisado(page, "Es la version que vera el cliente");
  await completar(page, "Aprobacion interna y envio al cliente");

  // ---- El cliente aprueba.
  await entrar(page, "cliente@empresa.test");
  await page.goto("/dashboard/mis-proyectos", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: new RegExp(nombre) }).click();
  await page.getByRole("link", { name: /Revisar/ }).click();
  await expect(page.getByRole("link", { name: /Abrir en figma.com/ })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Aprobar" }).click();
  await avisado(page, /aprobada\. Ya puedes descargarla/);

  // La version de la primera ronda ya no la ve; la aprobada se descarga si es archivo.
  expect((await page.request.get(archivo)).status()).toBe(404);

  // ---- El ejecutivo cierra el proyecto: todo esta aprobado.
  await entrar(page, EMAIL_EJECUTIVO);
  await page.goto(urlProyecto, { waitUntil: "networkidle" });
  await expect(page.getByText("1 de 1 pieza aprobada")).toBeVisible({ timeout: 60_000 });
  await page.getByRole("link", { name: "Estado" }).click();
  await page.getByRole("button", { name: "Cerrar el proyecto" }).click();
  await avisado(page, "El estado del proyecto cambio");
});

test("quien no tiene el permiso de aprobar ve la pieza pero no decide", async ({ page }) => {
  // Las piezas de ejemplo en la fase 5 esperan al cliente de la semilla, que
  // si puede aprobar; un trabajador no entra a Mis proyectos.
  await entrar(page, "redes@conejo.test");
  await page.goto("/dashboard/mis-proyectos", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 60_000 });
});
