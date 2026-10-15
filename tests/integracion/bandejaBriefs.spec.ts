import { expect, test, type Page } from "@playwright/test";
import { avisado, dentroDe, entrar, enviarBrief } from "./ayudas/briefs";

/**
 * La bandeja de briefs, del lado del ejecutivo de cuentas.
 *
 * El cliente envia briefs; el ejecutivo propone otra fecha, acepta uno (nace
 * el proyecto y completar su fase 1 lo valida), pasa otro a presupuesto
 * (administracion lo arma) y descarta un tercero con su motivo, que el
 * cliente ve.
 */

test.describe.configure({ mode: "serial" });

/** Abre en la bandeja el brief de un codigo. */
async function abrirEnBandeja(page: Page, codigo: string) {
  await page.goto("/dashboard/briefs", { waitUntil: "networkidle" });
  await page.getByRole("region", { name: "Por decidir" }).getByRole("link", { name: new RegExp(codigo) }).click();
  await expect(page.getByRole("heading", { name: "Brief completo" })).toBeVisible({ timeout: 60_000 });
}

test("aceptar abre el proyecto, y completar su fase 1 valida el brief", async ({ page }) => {
  test.setTimeout(400_000);

  await entrar(page, "cliente@empresa.test");
  const codigo = await enviarBrief(page, `Aceptable ${Date.now()}`);

  await entrar(page, "cuentas@conejo.test");
  await abrirEnBandeja(page, codigo);

  // La fecha no es viable: se propone otra, con su motivo.
  await page.getByLabel("No, proponer otra fecha").check();
  await page.getByRole("button", { name: "Guardar la fecha" }).click();
  await avisado(page, "Indica la fecha que propones");
  await page.getByLabel("Fecha que propones").fill(dentroDe(45));
  await page.getByLabel("Por que").fill("Necesitamos dos semanas mas para la fotografia");
  await page.getByRole("button", { name: "Guardar la fecha" }).click();
  await avisado(page, "Fecha propuesta al cliente");

  // Aceptar: nace el proyecto con la fase 1 en curso.
  await page.getByRole("button", { name: "Aceptar y abrir proyecto" }).click();
  await avisado(page, /Proyecto abierto/);
  await expect(page.getByRole("button", { name: "Aceptar y abrir proyecto" })).toHaveCount(0);
  await page.getByRole("link", { name: "Abrir su proyecto" }).click();
  await expect(page).toHaveURL(/\/dashboard\/proyectos\/\d+$/, { timeout: 60_000 });

  // Completar la fase 1 (con sus tareas listas) valida el brief.
  await page.getByRole("link", { name: /Entregable/ }).first().click();
  await expect(page.getByRole("heading", { name: "Fases y tareas" })).toBeVisible({ timeout: 60_000 });
  for (const tarea of ["Revisar el brief con el cliente", "Definir alcance y fechas"]) {
    await page.getByRole("button", { name: `Marcar como lista la tarea ${tarea}` }).click();
    await avisado(page, "Tarea lista");
  }
  await page.getByRole("button", { name: "Completar fase" }).click();
  await expect(page.getByText("Validacion del brief: completada").first()).toBeVisible({ timeout: 60_000 });

  // El cliente lo ve validado, con la fecha que le propusieron.
  await entrar(page, "cliente@empresa.test");
  await page.goto("/dashboard/mis-briefs", { waitUntil: "networkidle" });
  const fila = page.getByRole("link", { name: new RegExp(codigo) });
  await expect(fila).toContainText("Validado", { timeout: 60_000 });
  await fila.click();
  await expect(page.getByText("Necesitamos dos semanas mas para la fotografia")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("link", { name: "ver su avance" })).toBeVisible();
});

test("presupuestar lo pasa a administracion, y descartar exige motivo", async ({ page }) => {
  test.setTimeout(400_000);
  const marca = Date.now();

  await entrar(page, "cliente@empresa.test");
  const aPresupuesto = await enviarBrief(page, `Presupuestable ${marca}`);
  const aDescartar = await enviarBrief(page, `Descartable ${marca}`);

  // ---- Convertir en presupuesto.
  await entrar(page, "cuentas@conejo.test");
  await abrirEnBandeja(page, aPresupuesto);
  await page.getByRole("button", { name: "Convertir en presupuesto" }).click();
  await avisado(page, "Pasado a administracion para su presupuesto");

  // ---- Descartar, primero sin motivo.
  await abrirEnBandeja(page, aDescartar);
  await page.getByRole("button", { name: "Descartar", exact: true }).click();
  await page.getByRole("button", { name: "Descartar el brief" }).click();
  await avisado(page, "Escribe el motivo: el cliente lo vera");
  await page.getByLabel("Por que no seguimos").fill("Por ahora no hacemos empaques de vidrio");
  await page.getByRole("button", { name: "Descartar el brief" }).click();
  await avisado(page, "Brief descartado");

  // ---- Administracion arma el presupuesto desde el brief.
  await entrar(page, "finanzas@conejo.test");
  await page.goto("/dashboard/presupuestos", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: `Armar el presupuesto del brief ${aPresupuesto}` }).click();
  await expect(page).toHaveURL(/\/dashboard\/presupuestos\/\d+$/, { timeout: 60_000 });
  await expect(page.getByRole("link", { name: aPresupuesto })).toBeVisible({ timeout: 60_000 });

  // ---- El cliente ve el descarte con su motivo.
  await entrar(page, "cliente@empresa.test");
  await page.goto("/dashboard/mis-briefs", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: new RegExp(aDescartar) }).click();
  await expect(page.getByText("Por ahora no hacemos empaques de vidrio")).toBeVisible({ timeout: 60_000 });
});

test("quien no es de cuentas ni de administracion no entra en Briefs", async ({ page }) => {
  await entrar(page, "redes@conejo.test");
  await page.goto("/dashboard/briefs");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 60_000 });
});
