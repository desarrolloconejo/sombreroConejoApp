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

  // El calendario propio: se abre, se maneja con el teclado y escribe la fecha.
  await page.getByRole("button", { name: "Abrir el calendario" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("PageDown");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Fecha que propones")).toHaveValue(/^\d{2}\/\d{2}\/\d{4}$/);

  // Y tambien se puede escribir.
  await page.getByLabel("Fecha que propones").fill(dentroDe(45));
  await page.getByLabel("Por que").fill("Necesitamos dos semanas mas para la fotografia");
  await page.getByRole("button", { name: "Guardar la fecha" }).click();
  await avisado(page, "Fecha propuesta al cliente");

  // Aceptar: la ventana dice que va a pasar; al confirmar, nace el proyecto
  // con la fase 1 en curso y el resultado sale en la misma ventana.
  await page.getByRole("link", { name: "Aceptar y abrir proyecto" }).click();
  const ventana = page.getByRole("dialog", { name: "Aceptar y abrir proyecto" });
  await expect(ventana.getByText(/Nace el proyecto/)).toBeVisible({ timeout: 60_000 });
  await ventana.getByRole("button", { name: "Aceptar y abrir proyecto" }).click();
  await expect(ventana.getByText(/Proyecto abierto/)).toBeVisible({ timeout: 60_000 });
  await expect(ventana.getByRole("link", { name: "Abrir el proyecto" })).toBeVisible();
  await ventana.getByRole("link", { name: "Listo" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Aceptar y abrir proyecto" })).toHaveCount(0);
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
  await page.getByRole("link", { name: "Convertir en presupuesto" }).click();
  const presupuestar = page.getByRole("dialog", { name: "Convertir en presupuesto" });
  await presupuestar.getByRole("button", { name: "Convertir en presupuesto" }).click();
  await expect(presupuestar.getByText("Pasado a administracion para su presupuesto")).toBeVisible({ timeout: 60_000 });
  await presupuestar.getByRole("link", { name: "Listo" }).click();

  // ---- Descartar: sin motivo no se puede; con el, queda archivado.
  await abrirEnBandeja(page, aDescartar);
  await page.getByRole("link", { name: "Descartar", exact: true }).click();
  const descartar = page.getByRole("dialog", { name: "Descartar el brief" });
  await expect(descartar.getByRole("button", { name: "Descartar el brief" })).toBeDisabled({ timeout: 60_000 });
  await descartar.getByLabel("Por que no seguimos").fill("Por ahora no hacemos empaques de vidrio");
  await descartar.getByRole("button", { name: "Descartar el brief" }).click();
  await expect(descartar.getByText("Brief descartado")).toBeVisible({ timeout: 60_000 });
  await descartar.getByRole("link", { name: "Listo" }).click();

  // ---- Cada uno queda en su pestana de la bandeja.
  await page.goto("/dashboard/briefs?ver=curso", { waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: "En curso", exact: false }).first()).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("region", { name: "En curso" }).getByRole("link", { name: new RegExp(aPresupuesto) }),
  ).toBeVisible({ timeout: 60_000 });
  await page.goto("/dashboard/briefs?ver=cerrados", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("region", { name: "Cerrados" }).getByRole("link", { name: new RegExp(aDescartar) }),
  ).toBeVisible({ timeout: 60_000 });

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
