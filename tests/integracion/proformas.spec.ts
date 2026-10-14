import { expect, test, type Page } from "@playwright/test";
import { USUARIOS } from "../../db/datos/semilla.mts";

/**
 * Proformas, de punta a punta.
 *
 * Administracion envia un presupuesto, registra su aprobacion a nombre del
 * cliente y genera la proforma; la liga a un proyecto, la emite y la marca
 * como recurrente con la fecha de hoy. Prepara la siguiente, que nace en
 * borrador como copia, y la anula. El cliente ve la emitida en su
 * Administracion.
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

/** Hoy en Caracas, AAAA-MM-DD: la fecha que la base compara. */
function hoyEnCaracas(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

test("del presupuesto aprobado a la proforma emitida, recurrente y su copia", async ({ page }) => {
  test.setTimeout(300_000);
  const titulo = `Contrato de prueba ${Date.now()}`;

  await entrar(page, "finanzas@conejo.test");

  // ---- Un presupuesto enviado y aprobado a nombre del cliente.
  await page.goto("/dashboard/presupuestos?panel=nuevo", { waitUntil: "networkidle" });
  await page.getByLabel("Titulo").fill(titulo);
  await page.getByRole("button", { name: "Crear y anadir renglones" }).click();
  await expect(page).toHaveURL(/\/dashboard\/presupuestos\/\d+$/, { timeout: 60_000 });
  await page.getByLabel("Descripcion del renglon 1").fill("Gestion mensual");
  await page.getByLabel("Precio del renglon 1").fill("500");
  await page.getByRole("button", { name: "Guardar y enviar al cliente" }).click();
  await avisado(page, /Presupuesto enviado/);
  await page.getByRole("button", { name: "Registrar a nombre del cliente" }).click();
  await avisado(page, "Aprobacion registrada a nombre del cliente");

  // ---- La proforma nace en borrador, con sus renglones copiados.
  await page.getByRole("button", { name: "Generar la proforma" }).click();
  await expect(page).toHaveURL(/\/dashboard\/proformas\/\d+$/, { timeout: 60_000 });
  const urlProforma = page.url();
  await expect(page.getByLabel("Descripcion del renglon 1")).toHaveValue("Gestion mensual", {
    timeout: 60_000,
  });

  // Se liga a un proyecto de la empresa y se emite.
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Guardar y emitir" }).click();
  await avisado(page, "Proforma emitida");
  await expect(page.getByRole("heading", { name: "Recurrencia" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("button", { name: "Guardar y emitir" })).toHaveCount(0);

  // ---- Recurrente desde hoy: toca preparar la siguiente.
  await page.getByRole("checkbox", { name: /Se repite cada mes/ }).check();
  await page.getByLabel("Toca la siguiente el").fill(hoyEnCaracas());
  await page.getByRole("button", { name: "Guardar la recurrencia" }).click();
  await avisado(page, "Se repetira cada mes");

  // La portada de Proformas la pide.
  await page.goto("/dashboard/proformas", { waitUntil: "networkidle" });
  const pendientes = page.getByRole("region", { name: "Toca preparar la siguiente" });
  await expect(pendientes.getByText(titulo).first()).toBeVisible({ timeout: 60_000 });

  // Preparar la deja en borrador, como copia, y lleva a ella.
  await page.goto(urlProforma, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Preparar la siguiente/ }).first().click();
  await expect(page).not.toHaveURL(urlProforma, { timeout: 60_000 });
  await expect(page.getByText(/Copia de la recurrente/)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByLabel("Descripcion del renglon 1")).toHaveValue("Gestion mensual");

  // Y ya no la pide: la fecha avanzo un mes.
  await page.goto("/dashboard/proformas", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("region", { name: "Toca preparar la siguiente" }).getByText(titulo),
  ).toHaveCount(0);

  // ---- La copia se anula con su motivo.
  await page.goto("/dashboard/proformas?estado=borrador", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: /Abrir la proforma/ }).first().click();
  await expect(page.getByText(/Copia de la recurrente/)).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Anular la proforma" }).click();
  await page.getByRole("button", { name: "Anular", exact: true }).click();
  await avisado(page, "Escribe por que se anula");
  await page.getByLabel("Por que se anula").fill("Este mes no se factura");
  await page.getByRole("button", { name: "Anular", exact: true }).click();
  await avisado(page, "Proforma anulada");
  await expect(page.getByText("Este mes no se factura")).toBeVisible({ timeout: 60_000 });

  // ---- El cliente ve la emitida, con su proyecto.
  await entrar(page, "cliente@empresa.test");
  await page.goto("/dashboard/administracion", { waitUntil: "networkidle" });
  await page
    .getByRole("list", { name: "Proformas" })
    .getByRole("link", { name: new RegExp(titulo) })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Proyectos" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("$580,00").locator("visible=true").first()).toBeVisible();
});

test("quien no opera finanzas no entra en Proformas", async ({ page }) => {
  await entrar(page, "redes@conejo.test");
  await page.goto("/dashboard/proformas");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 60_000 });
});
