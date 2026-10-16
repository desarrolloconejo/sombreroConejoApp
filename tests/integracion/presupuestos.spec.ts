import { expect, test, type Page } from "@playwright/test";
import { USUARIOS } from "../../db/datos/semilla.mts";
import { elegirEmpresa, elegirOpcion } from "./ayudas/formularios";

/**
 * Presupuestos, del lado de administracion, de punta a punta.
 *
 * Con `finanzas@conejo.test`, que opera finanzas sin ser administrador: crea
 * un presupuesto, escribe sus renglones, comprueba que la base guarda los
 * mismos importes que la vista previa, lo envia y registra el rechazo a
 * nombre del cliente. La parte del cliente esta en administracion.spec.ts.
 */

test.describe.configure({ mode: "serial" });

async function entrar(page: Page, email: string) {
  const persona = USUARIOS.find((u) => u.email === email);
  if (!persona) throw new Error(`La semilla no trae ${email}`);

  await page.context().clearCookies();
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByPlaceholder("tucorreo@conejo.test").fill(persona.email);
  await page.getByPlaceholder("Tu contrasena").fill(persona.password);
  await page.getByPlaceholder("Tu contrasena").press("Enter");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 90_000 });
}

async function avisado(page: Page, texto: string | RegExp) {
  await expect(page.getByText(texto).first()).toBeVisible({ timeout: 60_000 });
}

test("administracion crea un presupuesto, lo envia y registra la respuesta del cliente", async ({ page }) => {
  test.setTimeout(300_000);
  const titulo = `Presupuesto de prueba ${Date.now()}`;

  await entrar(page, "finanzas@conejo.test");

  // Ve Finanzas en el menu, y nada de Trabajo.
  const menu = page.getByRole("navigation", { name: "Modulos" }).first();
  await expect(menu.getByRole("link", { name: /Presupuestos/ }).first()).toBeVisible();

  await page.goto("/dashboard/presupuestos?panel=nuevo", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Abrir un presupuesto" })).toBeVisible({
    timeout: 60_000,
  });

  await elegirEmpresa(page);
  await page.getByLabel("Titulo").fill(titulo);
  await page.getByRole("button", { name: "Crear y anadir renglones" }).click();

  // Al crearlo, se abre su editor.
  await expect(page).toHaveURL(/\/dashboard\/presupuestos\/\d+$/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: titulo })).toBeVisible();

  // Dos renglones: uno gravado y uno exento. La vista previa calcula sola.
  await page.getByLabel("Descripcion del renglon 1").fill("Diseno de piezas");
  await page.getByLabel("Cantidad del renglon 1").fill("3");
  await page.getByLabel("Precio del renglon 1").fill("33,33");
  await page.getByRole("button", { name: "Anadir renglon" }).click();
  await page.getByLabel("Descripcion del renglon 2").fill("Pauta (gestion)");
  await page.getByLabel("Cantidad del renglon 2").fill("2,5");
  await page.getByLabel("Precio del renglon 2").fill("19.99");
  await elegirOpcion(page, "IVA del renglon 2", "Exento");

  const previa = page.getByLabel("Vista previa de los importes");
  // 3 x 33,33 = 99,99; IVA 16 % = 16,00 (15,9984); exento 2,5 x 19,99 = 49,98.
  await expect(previa).toContainText("$99,99");
  await expect(previa).toContainText("$49,98");
  await expect(previa).toContainText("$16,00");
  await expect(previa).toContainText("$165,97");

  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await avisado(page, "Presupuesto guardado");

  // Enviar sin cambiar nada: guarda y envia en el mismo paso.
  await page.getByRole("button", { name: "Guardar y enviar al cliente" }).click();
  await avisado(page, /Presupuesto enviado/);

  // Ya no es un borrador: se ve como documento, con los importes de la base.
  await expect(page.getByRole("heading", { name: "Esperando al cliente" })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByRole("button", { name: "Guardar borrador" })).toHaveCount(0);
  const total = page.getByRole("definition").filter({ hasText: "$165,97" });
  await expect(total.first()).toBeVisible();

  // Rechazar a nombre del cliente pide el motivo.
  await page.getByLabel("Lo rechazo").check();
  await page.getByRole("button", { name: "Registrar a nombre del cliente" }).click();
  await avisado(page, "Escribe por que lo rechazo el cliente");
  await page.getByLabel("Por que lo rechazo").fill("Prefiere esperar al proximo trimestre");
  await page.getByRole("button", { name: "Registrar a nombre del cliente" }).click();
  await avisado(page, "Rechazo registrado a nombre del cliente");

  await expect(page.getByText(/a nombre del cliente/).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Prefiere esperar al proximo trimestre")).toBeVisible();
});

test("quien no opera finanzas no entra en Presupuestos", async ({ page }) => {
  await entrar(page, "cuentas@conejo.test");
  await page.goto("/dashboard/presupuestos");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 60_000 });
});
