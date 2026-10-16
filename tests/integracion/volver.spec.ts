import { expect, test } from "@playwright/test";
import { entrar } from "./ayudas/briefs";

/**
 * El boton «Volver» de cada modulo: vuelve a la pagina anterior dentro de la
 * app y, si se entro directo, sube al nivel de arriba sin salir de ella.
 */

test("volver lleva a la pagina anterior y, entrando directo, al nivel de arriba", async ({ page }) => {
  test.setTimeout(240_000);
  await entrar(page, "cuentas@conejo.test");

  await page.goto("/dashboard/proyectos", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: /^Abrir el proyecto/ }).first().click();
  await expect(page).toHaveURL(/\/dashboard\/proyectos\/\d+$/, { timeout: 60_000 });
  const proyecto = page.url();

  await page.locator('a[href*="/piezas/"]').first().click();
  await expect(page).toHaveURL(/\/piezas\/\d+$/, { timeout: 60_000 });
  const pieza = page.url();

  // Dentro de la app: atras, y atras otra vez.
  await page.getByRole("button", { name: "Volver" }).click();
  await expect(page).toHaveURL(proyecto, { timeout: 60_000 });
  await page.getByRole("button", { name: "Volver" }).click();
  await expect(page).toHaveURL(/\/dashboard\/proyectos$/, { timeout: 60_000 });

  // Entrando directo, sin rastro: sube a la miga de arriba, el proyecto.
  await page.evaluate(() => window.sessionStorage.clear());
  await page.goto(pieza, { waitUntil: "networkidle" });
  await page.evaluate(() => window.sessionStorage.clear());
  await page.getByRole("button", { name: "Volver" }).click();
  await expect(page).toHaveURL(proyecto, { timeout: 60_000 });
});
