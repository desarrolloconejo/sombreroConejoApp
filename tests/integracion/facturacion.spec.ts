import { expect, test, type Page } from "@playwright/test";
import { USUARIOS } from "../../db/datos/semilla.mts";

/**
 * Facturacion, del lado del cliente: aprobar y rechazar presupuestos.
 *
 * Administracion (`finanzas@conejo.test`) prepara y envia dos presupuestos; el
 * cliente de la semilla, que ve las finanzas de su empresa, rechaza uno con su
 * motivo y aprueba el otro. Al final, administracion ve el aprobado listo para
 * su proforma, y el cliente no puede abrir un borrador.
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

/** Crea y envia un presupuesto de un renglon. Devuelve su URL. */
async function enviarPresupuesto(page: Page, titulo: string): Promise<string> {
  await page.goto("/dashboard/presupuestos?panel=nuevo", { waitUntil: "networkidle" });
  await page.getByLabel("Titulo").fill(titulo);
  await page.getByRole("button", { name: "Crear y anadir renglones" }).click();
  await expect(page).toHaveURL(/\/dashboard\/presupuestos\/\d+$/, { timeout: 60_000 });

  await page.getByLabel("Descripcion del renglon 1").fill("Plan mensual");
  await page.getByLabel("Precio del renglon 1").fill("250");
  await page.getByRole("button", { name: "Guardar y enviar al cliente" }).click();
  await avisado(page, /Presupuesto enviado/);

  return page.url();
}

test("el cliente rechaza un presupuesto con su motivo y aprueba otro", async ({ page }) => {
  test.setTimeout(300_000);
  const marca = Date.now();
  const rechazable = `Para rechazar ${marca}`;
  const aprobable = `Para aprobar ${marca}`;

  await entrar(page, "finanzas@conejo.test");
  await enviarPresupuesto(page, rechazable);
  const urlAprobable = await enviarPresupuesto(page, aprobable);

  // ---- El cliente: el inicio le avisa, y Facturacion los lista.
  await entrar(page, "cliente@empresa.test");
  await avisado(page, /presupuestos? esperan? tu aprobacion/);

  await page.goto("/dashboard/facturacion", { waitUntil: "networkidle" });
  const porAprobar = page.getByRole("list", { name: "Presupuestos por aprobar" });
  await expect(porAprobar.getByText(rechazable)).toBeVisible({ timeout: 60_000 });

  // Rechazar pide el motivo.
  await porAprobar.getByRole("link", { name: new RegExp(rechazable) }).click();
  await expect(page.getByRole("heading", { name: "Tu decision" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("$290,00").locator("visible=true").first()).toBeVisible();
  await page.getByRole("button", { name: "Rechazar", exact: true }).click();
  await page.getByRole("button", { name: "Rechazar el presupuesto" }).click();
  await avisado(page, "Cuentanos por que lo rechazas");
  await page.getByLabel("¿Por que lo rechazas?").fill("Necesitamos menos publicaciones");
  await page.getByRole("button", { name: "Rechazar el presupuesto" }).click();
  await avisado(page, "Presupuesto rechazado. Lo revisaremos");
  await expect(page.getByRole("heading", { name: "Estado" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Necesitamos menos publicaciones")).toBeVisible();

  // Aprobar el otro.
  await page.goto("/dashboard/facturacion", { waitUntil: "networkidle" });
  await page
    .getByRole("list", { name: "Presupuestos por aprobar" })
    .getByRole("link", { name: new RegExp(aprobable) })
    .click();
  await page.getByRole("button", { name: "Aprobar el presupuesto" }).click();
  await avisado(page, "Presupuesto aprobado. Gracias");
  await expect(page.getByRole("button", { name: "Aprobar el presupuesto" })).toHaveCount(0);

  // ---- Administracion lo ve aprobado, listo para su proforma.
  await entrar(page, "finanzas@conejo.test");
  await page.goto(urlAprobable, { waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "Generar la proforma" })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText(/^Por Maria/)).toBeVisible();
});

test("el cliente no abre un borrador, ni lo ve en su lista", async ({ page }) => {
  test.setTimeout(180_000);

  await entrar(page, "finanzas@conejo.test");
  await page.goto("/dashboard/presupuestos?situacion=borrador", { waitUntil: "networkidle" });
  const enlace = page.getByRole("link", { name: /Abrir el presupuesto/ }).first();
  await expect(enlace).toBeVisible({ timeout: 60_000 });
  const id = ((await enlace.getAttribute("href")) ?? "").split("/").pop();

  await entrar(page, "cliente@empresa.test");
  await page.goto(`/dashboard/facturacion/presupuestos/${id}`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Esta pagina no existe" })).toBeVisible({
    timeout: 60_000,
  });
});

test("quien no es cliente no entra en Facturacion", async ({ page }) => {
  await entrar(page, "finanzas@conejo.test");
  await page.goto("/dashboard/facturacion");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 60_000 });
});
