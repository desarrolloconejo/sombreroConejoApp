import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { avisado, entrar } from "./ayudas/briefs";
import { proformaEmitida } from "./ayudas/finanzas";

/**
 * Las facturas de punta a punta, del lado de administracion: emitir desde la
 * proforma, el PDF para el talonario y la hoja de calibracion, marcarla
 * impresa y anularla. El cliente no puede pedir el PDF.
 */

test.describe.configure({ mode: "serial" });

let facturaUrl = "";
const CAPTURAS = process.env.CAPTURAS_DIR;

test("administracion emite, imprime y anula una factura", async ({ page }) => {
  test.setTimeout(300_000);

  await entrar(page, "finanzas@conejo.test");
  const proformaUrl = await proformaEmitida(page, `Factura de prueba ${Date.now()}`);

  // ---- Emitir lleva a la factura, pendiente de cobro.
  await page.getByRole("button", { name: /Emitir la factura de PRF-/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/facturas\/\d+$/, { timeout: 60_000 });
  facturaUrl = page.url();
  await expect(page.getByRole("heading", { name: /^Factura [A-Z]+-\d{6}$/, level: 1 })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Pendiente").first()).toBeVisible();
  await expect(page.getByText(/Tasa BCV/)).toBeVisible();

  // ---- El PDF del talonario y la hoja de calibracion.
  const id = facturaUrl.match(/(\d+)$/)?.[1];
  const pdf = await page.request.get(`/api/facturas/${id}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
  if (CAPTURAS) writeFileSync(`${CAPTURAS}/factura.pdf`, await pdf.body());

  await page.getByRole("button", { name: "Marcar como impresa" }).click();
  await avisado(page, "Marcada como impresa");
  await expect(page.getByText(/Impresa el/)).toBeVisible({ timeout: 60_000 });

  await page.goto("/dashboard/ajustes-finanzas", { waitUntil: "networkidle" });
  const enlace = await page.getByRole("link", { name: /^Carta \(ejemplo\)/ }).getAttribute("href");
  const formato = enlace?.match(/(\d+)$/)?.[1];
  const calibracion = await page.request.get(`/api/formatos/${formato}/calibracion`);
  expect(calibracion.status()).toBe(200);
  expect((await calibracion.body()).subarray(0, 4).toString()).toBe("%PDF");
  if (CAPTURAS) writeFileSync(`${CAPTURAS}/calibracion.pdf`, await calibracion.body());

  // ---- Anular pide el motivo, y la proforma vuelve a poder facturarse.
  await page.goto(facturaUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Anular la factura" }).click();
  await page.getByRole("button", { name: "Anular", exact: true }).click();
  await avisado(page, "Escribe el motivo de la anulacion");
  await page.getByLabel("Motivo de la anulacion").fill("Error en el titulo");
  await page.getByRole("button", { name: "Anular", exact: true }).click();
  await avisado(page, /Factura anulada/);
  await expect(page.getByText("Error en el titulo")).toBeVisible({ timeout: 60_000 });

  await page.goto(proformaUrl, { waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: /Emitir la factura de PRF-/ })).toBeVisible({ timeout: 60_000 });
});

test("el cliente no pide el PDF del talonario ni entra a Facturas", async ({ page }) => {
  await entrar(page, "cliente@empresa.test");
  const id = facturaUrl.match(/(\d+)$/)?.[1] ?? "1";
  const pdf = await page.request.get(`/api/facturas/${id}/pdf`);
  expect(pdf.status()).toBe(404);
  await page.goto("/dashboard/facturas");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 60_000 });
});
