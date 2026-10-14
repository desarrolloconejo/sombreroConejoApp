import { expect, test, type Page } from "@playwright/test";
import { EMAIL_EJECUTIVO, USUARIOS } from "../../db/datos/semilla.mts";
import { PROYECTO_ESPECIAL, PROYECTO_REDES } from "../../db/datos/proyectos.mts";

/**
 * El tablero, con los proyectos de ejemplo de la semilla: la parrilla de
 * redes tiene una pieza atrasada, y el proyecto especial no.
 */

function cuenta(email: string) {
  const persona = USUARIOS.find((u) => u.email === email);
  if (!persona) throw new Error(`La semilla no trae ${email}`);
  return persona;
}

async function entrar(page: Page, email: string, password: string) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByPlaceholder("tucorreo@conejo.test").fill(email);
  await page.getByPlaceholder("Tu contrasena").fill(password);
  await page.getByPlaceholder("Tu contrasena").press("Enter");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 90_000 });
}

test("el ejecutivo ve sus proyectos en curso y filtra por una alerta", async ({ page }) => {
  const ejecutivo = cuenta(EMAIL_EJECUTIVO);
  await entrar(page, ejecutivo.email, ejecutivo.password);

  await page.goto("/dashboard/tablero");
  await expect(page.getByRole("heading", { name: "Tablero de control" })).toBeVisible({
    timeout: 60_000,
  });

  await expect(page.getByText(PROYECTO_REDES)).toBeVisible();
  await expect(page.getByText(PROYECTO_ESPECIAL)).toBeVisible();

  // Solo la parrilla tiene una pieza atrasada.
  await page.getByRole("link", { name: /^Atrasada: \d+ piezas?\. Ver solo esos proyectos/ }).click();
  await expect(page).toHaveURL(/alerta=atrasada/);
  await expect(page.getByText(PROYECTO_REDES)).toBeVisible();
  await expect(page.getByText(PROYECTO_ESPECIAL)).toHaveCount(0);

  // Y la fila lleva al proyecto.
  await page.getByRole("link", { name: new RegExp(PROYECTO_REDES) }).click();
  await expect(page.getByRole("heading", { name: PROYECTO_REDES })).toBeVisible({ timeout: 60_000 });
});

test("quien no es de cuentas no entra al tablero", async ({ page }) => {
  const redes = cuenta("redes@conejo.test");
  await entrar(page, redes.email, redes.password);

  await page.goto("/dashboard/tablero");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 60_000 });
});
