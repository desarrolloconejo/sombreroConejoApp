import { expect, type Page } from "@playwright/test";
import { avisado } from "./briefs";
import { elegirEmpresa } from "./formularios";

/**
 * Lo que comparten las pruebas de finanzas: llegar, con la sesion de
 * administracion ya abierta, a una proforma emitida de la empresa de la
 * semilla. Pasa por el presupuesto aprobado a nombre del cliente. Devuelve la
 * URL de la proforma.
 */
export async function proformaEmitida(page: Page, titulo: string, precio = "500"): Promise<string> {
  await page.goto("/dashboard/presupuestos?panel=nuevo", { waitUntil: "networkidle" });
  await elegirEmpresa(page);
  await page.getByLabel("Titulo").fill(titulo);
  await page.getByRole("button", { name: "Crear y anadir renglones" }).click();
  await expect(page).toHaveURL(/\/dashboard\/presupuestos\/\d+$/, { timeout: 60_000 });
  await page.getByLabel("Descripcion del renglon 1").fill("Gestion mensual");
  await page.getByLabel("Precio del renglon 1").fill(precio);
  await page.getByRole("button", { name: "Guardar y enviar al cliente" }).click();
  await avisado(page, /Presupuesto enviado/);
  await page.getByRole("button", { name: "Registrar a nombre del cliente" }).click();
  await avisado(page, "Aprobacion registrada a nombre del cliente");

  await page.getByRole("button", { name: "Generar la proforma" }).click();
  await expect(page).toHaveURL(/\/dashboard\/proformas\/\d+$/, { timeout: 60_000 });
  const url = page.url();
  await expect(page.getByLabel("Descripcion del renglon 1")).toHaveValue("Gestion mensual", { timeout: 60_000 });
  await page.getByRole("button", { name: "Guardar y emitir" }).click();
  await avisado(page, "Proforma emitida");
  return url;
}
