import { expect, test } from "@playwright/test";
import { EMAIL_ADMIN_PRUEBAS } from "../../db/datos/semilla.mts";
import { avisado, entrar } from "./ayudas/briefs";
import { EMPRESA_SEMILLA, elegirOpcion } from "./ayudas/formularios";

/**
 * La nomenclatura de archivos: el modulo «Nombres de archivo» del equipo y la
 * sigla de las empresas, que es el bloque CLIENTE de todos sus archivos.
 */

test("el equipo arma un nombre con la sigla de la empresa", async ({ page }) => {
  await entrar(page, "diseno@conejo.test");
  await page.goto("/dashboard/nombres-archivo", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Nombres de archivo", level: 1 })).toBeVisible({
    timeout: 60_000,
  });

  // Sin datos, dice que falta y no deja copiar.
  await expect(page.getByText("Falta el cliente, el proyecto, el tipo, la extension.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copiar nombre" })).toBeDisabled();

  await elegirOpcion(page, "Cliente", EMPRESA_SEMILLA);
  await page.getByLabel(/proyecto o campana/i).fill("Lanzamiento Prado");
  await elegirOpcion(page, "Tipo de archivo", /Key visual/);
  await elegirOpcion(page, "Version", /Version 03/);
  await page.getByRole("button", { name: ".ai", exact: true }).click();

  const nombre = page.locator("section[aria-labelledby=titulo-nombre] p[aria-live]");
  await expect(nombre).toHaveText(/^DIST-EJEMPLO_LANZAMIENTO-PRADO_KV_\d{4}_v03\.ai$/);
  await expect(page.getByText(/^Cumple la nomenclatura/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Copiar nombre" })).toBeEnabled();

  // La version final es APROBADO-CLIENTE.
  await elegirOpcion(page, "Version", /Aprobado por el cliente/);
  await expect(nombre).toHaveText(/_KV_\d{4}_APROBADO-CLIENTE\.ai$/);

  await page.screenshot({ path: "test-results/nombres-archivo.png", fullPage: true });
});

test("un cliente no entra en Nombres de archivo", async ({ page }) => {
  await entrar(page, "cliente@empresa.test");
  await page.goto("/dashboard/nombres-archivo", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Nombres de archivo", level: 1 })).toHaveCount(0);
});

test("la sigla de una empresa se propone del nombre y no se repite", async ({ page }) => {
  await entrar(page, EMAIL_ADMIN_PRUEBAS);
  await page.goto("/dashboard/empresas?panel=nuevo", { waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "Registrar empresa" })).toBeVisible({ timeout: 60_000 });

  const marca = Date.now().toString().slice(-6);
  await page.getByLabel("Nombre", { exact: true }).fill(`Cafe Sendero ${marca}, C.A.`);

  // Se propone sola mientras se escribe el nombre.
  const sigla = page.getByLabel("Sigla");
  await expect(sigla).toHaveValue(`CAFE-SENDERO-${marca}`);

  // La de otra empresa no vale.
  await sigla.fill("dist ejemplo");
  await expect(page.getByText("En los archivos: DIST-EJEMPLO")).toBeVisible();
  await page.getByRole("button", { name: "Registrar empresa" }).click();
  await avisado(page, "Otra empresa ya usa esa sigla");

  await sigla.fill(`Sendero ${marca}`);
  await page.getByRole("button", { name: "Registrar empresa" }).click();
  await avisado(page, /Empresa "Cafe Sendero .*" registrada/);
});
