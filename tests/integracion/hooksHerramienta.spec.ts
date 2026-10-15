import { expect, test, type Page } from "@playwright/test";
import { EMAIL_EJECUTIVO, USUARIOS } from "../../db/datos/semilla.mts";
import { elegirEmpresa } from "./ayudas/formularios";

/**
 * Hooks como herramienta, de punta a punta.
 *
 * El ejecutivo crea un reel; su tarea «Escribir el hook» se la asigna a
 * diseno, que no es de redes. Diseno la abre desde Mi trabajo, escribe un
 * hook que aprueba la auditoria y la tarea queda lista sola. Al final el
 * ejecutivo cancela el proyecto para que no quede en el tablero.
 */

test.describe.configure({ mode: "serial" });

function cuenta(email: string) {
  const persona = USUARIOS.find((u) => u.email === email);
  if (!persona) throw new Error(`La semilla no trae ${email}`);
  return persona;
}

async function entrar(page: Page, email: string) {
  const persona = cuenta(email);
  await page.context().clearCookies();
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByPlaceholder("tucorreo@conejo.test").fill(persona.email);
  await page.getByPlaceholder("Tu contrasena").fill(persona.password);
  await page.getByPlaceholder("Tu contrasena").press("Enter");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 90_000 });
}

test("una tarea de hook la cumple quien la tiene, aunque no sea de redes", async ({ page }) => {
  const nombre = `Herramienta ${Date.now()}`;

  // ---- El ejecutivo crea el reel y asigna la tarea de hook a diseno.
  await entrar(page, EMAIL_EJECUTIVO);
  await page.goto("/dashboard/proyectos?panel=nuevo", { waitUntil: "networkidle" });
  await elegirEmpresa(page);
  await page.getByLabel("Nombre", { exact: true }).fill(nombre);
  await page.getByLabel("Tipo de la pieza 1").selectOption("reel");
  await page.getByLabel("Titulo de la pieza 1").fill("Reel de la herramienta");
  await page.getByRole("button", { name: "Crear proyecto" }).click();
  await expect(page).toHaveURL(/\/dashboard\/proyectos\/\d+$/, { timeout: 60_000 });
  const urlProyecto = page.url();

  await page.getByRole("link", { name: /Reel de la herramienta/ }).click();
  await page.getByRole("button", { name: "Editar la tarea Escribir el hook" }).click({
    timeout: 60_000,
  });
  // La tarea en edicion: el unico formulario de tarea con un selector dentro.
  const edicion = page
    .locator("form")
    .filter({ has: page.locator("input[name=tareaId]") })
    .filter({ has: page.locator("select[name=responsableId]") });
  await edicion.locator("select[name=responsableId]").selectOption({ label: "Luis Perez · Diseno" });
  await edicion.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Tarea actualizada").first()).toBeVisible({ timeout: 30_000 });

  // ---- Diseno la abre desde Mi trabajo.
  await entrar(page, "diseno@conejo.test");
  await page.goto("/dashboard/mi-trabajo");
  await page.getByRole("link", { name: "Abrir Hooks" }).first().click();
  await expect(page).toHaveURL(/\/dashboard\/hooks\/nuevo\?tarea=\d+/, { timeout: 60_000 });
  await expect(page.getByText(/Esta ficha cumple la tarea/)).toBeVisible({ timeout: 60_000 });

  await page.getByRole("combobox", { name: "Objetivo de la pieza" }).click();
  await page.getByRole("option").first().click();
  await page.getByRole("combobox", { name: "Plataforma" }).click();
  await page.getByRole("option").first().click();
  await page.getByLabel("Prueba disponible").fill("Se ve la taza antes y despues");
  await page.getByLabel("Hook hablado").fill("Tu cafe no es el grano: son los 2 minutos finales");
  await page.getByLabel("Insert-Titulo").fill("No es el grano");
  await page.getByRole("button", { name: "Auditar este hook" }).click();

  await expect(page).toHaveURL(/\/dashboard\/hooks\/auditor\?ficha=\d+&tarea=\d+/, {
    timeout: 60_000,
  });
  await expect(page.getByText("Aprobo la auditoria: la tarea quedo lista.")).toBeVisible({
    timeout: 60_000,
  });

  // Y en Mi trabajo, la tarea esta hecha.
  await page.goto("/dashboard/mi-trabajo");
  const hechas = page.getByRole("region", { name: /Hechas/ });
  await expect(hechas.getByText("Escribir el hook").first()).toBeVisible({ timeout: 60_000 });

  // Sin tarea, diseno sigue sin entrar al modulo de hooks.
  await page.goto("/dashboard/hooks/nuevo");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 60_000 });

  // ---- El ejecutivo cancela el proyecto.
  await entrar(page, EMAIL_EJECUTIVO);
  await page.goto(urlProyecto);
  await page.getByRole("link", { name: "Estado" }).click();
  await page.getByRole("button", { name: "Cancelar el proyecto" }).click();
  await expect(page.getByText("El estado del proyecto cambio").first()).toBeVisible({
    timeout: 30_000,
  });
});
