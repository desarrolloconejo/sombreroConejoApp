import { expect, test } from "@playwright/test";
import { avisado, entrar } from "./ayudas/briefs";
import { proformaEmitida } from "./ayudas/finanzas";
import { elegirOpcion } from "./ayudas/formularios";

/**
 * Pagos de punta a punta: el cliente reporta un pago con su comprobante;
 * administracion lo confirma y baja el saldo; registra otro a nombre del
 * cliente y lo rechaza con motivo, que el cliente ve.
 */

test.describe.configure({ mode: "serial" });

/** Un PNG de 1x1: lo minimo que pasa la comprobacion por firma. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

test("el cliente reporta, administracion confirma y rechaza", async ({ page }) => {
  test.setTimeout(400_000);

  // ---- Una factura nueva.
  await entrar(page, "finanzas@conejo.test");
  await proformaEmitida(page, `Pagos de prueba ${Date.now()}`);
  await page.getByRole("button", { name: /Emitir la factura de PRF-/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/facturas\/\d+$/, { timeout: 60_000 });
  const id = page.url().match(/(\d+)$/)?.[1];
  const numero = (await page.getByRole("heading", { level: 1 }).textContent())?.replace("Factura ", "");

  // ---- El cliente la ve en su Facturacion y reporta un pago.
  await entrar(page, "cliente@empresa.test");
  await page.goto("/dashboard/facturacion", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: new RegExp(numero ?? "sin-numero") }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/facturacion/facturas/${id}$`), { timeout: 60_000 });

  await elegirOpcion(page, "Como pagaste", "Transferencia bancaria");
  await elegirOpcion(page, "Moneda", /bolivares/i);
  await page.getByLabel(/^Monto/).fill("1000");
  await page.getByLabel("Numero de referencia").fill("000999");
  await page.getByRole("button", { name: "Reportar" }).click();
  await avisado(page, "Adjunta el comprobante");

  await page.locator("input[name=comprobante]").setInputFiles({ name: "pago.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Reportar" }).click();
  await avisado(page, /Recibido/);
  const lista = page.getByRole("list", { name: "Pagos y retenciones" });
  await expect(lista).toContainText("Por confirmar", { timeout: 60_000 });

  // El comprobante se ve con su sesion.
  const enlace = await lista.getByRole("link", { name: "Ver el comprobante" }).getAttribute("href");
  expect((await page.request.get(enlace ?? "/")).status()).toBe(200);

  // ---- Administracion lo ve por confirmar y lo confirma.
  await entrar(page, "finanzas@conejo.test");
  await page.goto("/dashboard/facturas", { waitUntil: "networkidle" });
  await expect(page.getByRole("region", { name: "Pagos por confirmar" })).toContainText(numero ?? "", { timeout: 60_000 });
  await page.goto(`/dashboard/facturas/${id}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /^Confirmar el pago/ }).first().click();
  await expect(page.getByLabel("Monto que se aplica (Bs)")).toHaveValue("1000.00");
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await avisado(page, "Pago confirmado");
  await expect(page.getByText("Pago parcial").first()).toBeVisible({ timeout: 60_000 });

  // ---- Registra otro a nombre del cliente, en dolares, y lo rechaza.
  await page.getByText("Registrar un pago a nombre del cliente").click();
  await elegirOpcion(page, "Como pagaste", "Zelle");
  await page.getByLabel(/^Monto/).fill("10");
  await page.getByLabel("Numero de referencia").fill("ZL-1");
  await page.getByRole("button", { name: "Registrar a nombre del cliente" }).click();
  await avisado(page, "Pago registrado: falta confirmarlo");

  await page.getByRole("button", { name: /^Rechazar el pago/ }).first().click();
  await page.getByRole("button", { name: "Rechazar", exact: true }).click();
  await avisado(page, "Escribe por que se rechaza: el cliente lo vera");
  await page.getByLabel("Por que se rechaza").fill("No aparece en la cuenta");
  await page.getByRole("button", { name: "Rechazar", exact: true }).click();
  await avisado(page, "Pago rechazado");

  // ---- El cliente ve lo confirmado y el motivo del rechazo.
  await entrar(page, "cliente@empresa.test");
  await page.goto(`/dashboard/facturacion/facturas/${id}`, { waitUntil: "networkidle" });
  await expect(page.getByText("Confirmado").first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("No aparece en la cuenta")).toBeVisible();
});
