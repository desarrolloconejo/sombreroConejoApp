import { expect, test, type Page } from "@playwright/test";
import { EMAIL_EJECUTIVO, USUARIOS } from "../../db/datos/semilla.mts";

/**
 * Proyectos, de punta a punta, como ejecutivo de cuentas.
 *
 * Crea un proyecto de redes con una pieza, marca la tarea de redaccion,
 * completa la fase y comprueba que la bateria suma. Al final cancela el
 * proyecto: queda en la base, pero fuera del tablero.
 */

function ejecutivo() {
  const persona = USUARIOS.find((u) => u.email === EMAIL_EJECUTIVO);
  if (!persona) throw new Error("La semilla no trae al ejecutivo de cuentas");
  return persona;
}

async function entrar(page: Page, email: string, password: string) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByPlaceholder("tucorreo@conejo.test").fill(email);
  await page.getByPlaceholder("Tu contrasena").fill(password);
  await page.getByPlaceholder("Tu contrasena").press("Enter");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 90_000 });
}

test("el ejecutivo crea un proyecto, cumple una tarea y completa la fase", async ({ page }) => {
  const persona = ejecutivo();
  const nombre = `Prueba de integracion ${Date.now()}`;

  await entrar(page, persona.email, persona.password);

  await page.goto("/dashboard/proyectos?panel=nuevo", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Abrir un proyecto" })).toBeVisible({
    timeout: 60_000,
  });

  await page.getByLabel("Nombre", { exact: true }).fill(nombre);
  await page.getByLabel("Titulo de la pieza 1").fill("Pieza de la prueba");
  await page.getByRole("button", { name: "Crear proyecto" }).click();

  // Al crearlo, se abre su pagina.
  await expect(page).toHaveURL(/\/dashboard\/proyectos\/\d+$/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: nombre })).toBeVisible();
  await expect(page.getByRole("img", { name: "Avance del proyecto: 0 por ciento" })).toBeVisible();

  // La ficha de la pieza.
  await page.getByRole("link", { name: /Pieza de la prueba/ }).click();
  await expect(page.getByRole("heading", { name: "Fases y tareas" })).toBeVisible({
    timeout: 60_000,
  });

  // Con la tarea pendiente, la fase no se puede completar.
  const completar = page.getByRole("button", { name: "Completar fase" });
  await expect(completar).toBeDisabled();

  await page.getByRole("button", { name: "Marcar como lista la tarea Redactar el copy" }).click();
  await expect(page.getByText("Tarea lista").first()).toBeVisible({ timeout: 30_000 });

  await expect(completar).toBeEnabled({ timeout: 30_000 });
  await completar.click();
  await expect(page.getByText("Redaccion de contenido: completada").first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("img", { name: "Avance de la pieza: 20 por ciento" })).toBeVisible();

  // Fuera del tablero: se cancela.
  await page.getByRole("link", { name: nombre }).click();
  await page.getByRole("link", { name: "Estado" }).click();
  await page.getByRole("button", { name: "Cancelar el proyecto" }).click();
  await expect(page.getByText("El estado del proyecto cambio").first()).toBeVisible({
    timeout: 30_000,
  });
});

test("quien no es de cuentas no entra en Proyectos", async ({ page }) => {
  const redes = USUARIOS.find((u) => u.email === "redes@conejo.test");
  if (!redes) throw new Error("La semilla no trae a redes");

  await entrar(page, redes.email, redes.password);
  await page.goto("/dashboard/proyectos");

  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 60_000 });
});
