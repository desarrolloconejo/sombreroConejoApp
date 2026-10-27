import { expect, test } from "@playwright/test";
import { entrar } from "./ayudas/briefs";

/**
 * La foto de perfil: se sube desde Mi perfil, se entrega por /api/fotos con
 * sesion (sin ella, 404) y se puede quitar. En desarrollo va al almacen
 * simulado; con ARCHIVOS_MODO=real, a Drive.
 */

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

test("sube la foto, se ve con sesion y no sin ella, y se quita", async ({ page }) => {
  await entrar(page, "sintareas@conejo.test");
  await page.goto("/dashboard/perfil", { waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: /foto de perfil/ })).toBeVisible({ timeout: 60_000 });

  // Lo que no es imagen no entra, aunque se llame .png.
  await page.locator("input#foto").setInputFiles({ name: "falsa.png", mimeType: "image/png", buffer: Buffer.from("no soy una imagen") });
  await page.getByRole("button", { name: "Subir", exact: true }).click();
  await expect(page.getByText("El archivo no es una imagen JPG, PNG o WEBP")).toBeVisible({ timeout: 30_000 });

  await page.locator("input#foto").setInputFiles({ name: "yo.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByAltText("Vista previa de la foto elegida")).toBeVisible();
  await page.getByRole("button", { name: "Subir", exact: true }).click();
  await expect(page.getByText("Tu foto quedo actualizada").first()).toBeVisible({ timeout: 30_000 });

  const foto = page.getByRole("img", { name: /^Foto de / }).first();
  await expect(foto).toBeVisible();
  const ruta = (await foto.getAttribute("src")) ?? "";
  expect(ruta).toMatch(/^\/api\/fotos\/\d+\?v=[a-z0-9]+\.png$/);

  const conSesion = await page.request.get(ruta);
  expect(conSesion.status()).toBe(200);
  expect(conSesion.headers()["content-type"]).toBe("image/png");

  // Sin sesion no llega la imagen: el proxy manda al login.
  const anonimo = await page.context().browser()!.newContext();
  const sinSesion = await anonimo.request.get(new URL(ruta, page.url()).toString(), { maxRedirects: 0 });
  expect(sinSesion.status()).not.toBe(200);
  expect(sinSesion.headers()["content-type"] ?? "").not.toMatch(/^image\//);
  await anonimo.close();

  await page.getByRole("button", { name: "Quitar foto" }).click();
  await expect(page.getByText("Quitaste tu foto").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("img", { name: /^Foto de / })).toHaveCount(0);
});
