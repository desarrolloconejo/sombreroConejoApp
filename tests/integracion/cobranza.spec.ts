import { expect, test } from "@playwright/test";
import { entrar } from "./ayudas/briefs";

/**
 * La cobranza de administracion y el estado de cuenta del cliente. La semilla
 * deja una factura con saldo de la empresa de ejemplo.
 */

const CAPTURAS = process.env.CAPTURAS_DIR;

test("administracion ve lo que debe cada empresa y llega a sus facturas", async ({ page }) => {
  test.setTimeout(200_000);

  await entrar(page, "finanzas@conejo.test");
  await page.goto("/dashboard/cobranza", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Cobranza", level: 1 })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Por cobrar")).toBeVisible();
  if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/cobranza-escritorio.png`, fullPage: true });

  const tabla = page.getByRole("table", { name: "Deuda por empresa y antiguedad" });
  // Se comprueba a donde lleva y se abre: el servidor de desarrollo, al
  // compilar Facturas la primera vez, a veces recarga y corta el clic.
  const destino = await tabla.getByRole("link", { name: "Distribuidora Ejemplo, C.A." }).getAttribute("href");
  expect(destino).toMatch(/^\/dashboard\/facturas\?empresa=\d+&cobro=pendiente&cobro=parcial$/);
  await page.goto(destino ?? "/", { waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: /Abrir la factura/ }).first()).toBeVisible({ timeout: 60_000 });
});

test("el cliente ve su estado de cuenta en Facturacion", async ({ page }) => {
  test.setTimeout(200_000);

  await entrar(page, "cliente@empresa.test");
  await page.goto("/dashboard/facturacion", { waitUntil: "networkidle" });
  const cuenta = page.getByRole("region", { name: "Estado de cuenta" });
  await expect(cuenta).toContainText("Por pagar", { timeout: 60_000 });
  await expect(cuenta).toContainText("Bs.");
  if (CAPTURAS) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${CAPTURAS}/facturacion-movil.png` });
    await page.getByRole("list", { name: "Facturas" }).screenshot({ path: `${CAPTURAS}/facturas-movil.png` });
  }
});

test("quien no opera finanzas no entra en Cobranza", async ({ page }) => {
  await entrar(page, "cuentas@conejo.test");
  await page.goto("/dashboard/cobranza");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 60_000 });
});
