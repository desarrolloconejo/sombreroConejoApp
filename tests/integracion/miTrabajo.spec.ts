import { expect, test, type Page } from "@playwright/test";
import { USUARIOS } from "../../db/datos/semilla.mts";

/**
 * Mi trabajo, con la creadora de contenido de la semilla: tiene pendiente
 * «Definir alcance y fechas» en la fase en curso del proyecto especial. La
 * prueba la marca y la vuelve a abrir, asi que todo queda como estaba.
 */

const TAREA = "Definir alcance y fechas";

async function entrar(page: Page, email: string, password: string) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByPlaceholder("tucorreo@conejo.test").fill(email);
  await page.getByPlaceholder("Tu contrasena").fill(password);
  await page.getByPlaceholder("Tu contrasena").press("Enter");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 90_000 });
}

test("quien tiene una tarea la ve, la marca como lista y la reabre", async ({ page }) => {
  const redes = USUARIOS.find((u) => u.email === "redes@conejo.test");
  if (!redes) throw new Error("La semilla no trae a redes");

  await entrar(page, redes.email, redes.password);
  await page.goto("/dashboard/mi-trabajo");

  const ahora = page.getByRole("region", { name: /Para hacer ahora/ });
  await expect(ahora.getByText(TAREA)).toBeVisible({ timeout: 60_000 });

  // La tarea tambien sale en «Fases a tu cargo» (redes lleva la fase 1): se
  // marca desde su grupo.
  await ahora.getByRole("button", { name: `Marcar como lista la tarea ${TAREA}` }).click();
  await expect(page.getByText("Tarea lista").first()).toBeVisible({ timeout: 30_000 });

  const hechas = page.getByRole("region", { name: /Hechas/ });
  await expect(hechas.getByText(TAREA)).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: `Reabrir la tarea ${TAREA}` }).click();
  await expect(page.getByText("La tarea vuelve a estar pendiente").first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(ahora.getByText(TAREA)).toBeVisible({ timeout: 30_000 });

  // Desde la tarea se llega a la ficha de su pieza.
  await page.getByRole("link", { name: "Ver la pieza" }).first().click();
  await expect(page.getByRole("heading", { name: "Fases y tareas" })).toBeVisible({
    timeout: 60_000,
  });
});

test("quien es responsable de una fase la ve con su fecha y sus tareas pendientes", async ({ page }) => {
  // La semilla pone a diseno al frente de la fase 3 de las piezas de redes.
  const diseno = USUARIOS.find((u) => u.email === "diseno@conejo.test");
  if (!diseno) throw new Error("La semilla no trae a diseno");

  await entrar(page, diseno.email, diseno.password);
  await page.goto("/dashboard/mi-trabajo");

  const fases = page.getByRole("region", { name: /Fases a tu cargo/ });
  await expect(fases).toBeVisible({ timeout: 60_000 });
  const primera = fases.getByRole("listitem").filter({ has: page.getByRole("link", { name: "Abrir la pieza" }) }).first();
  await expect(primera).toContainText(/Para el|Vencio el|Sin fecha/);

  // Desde la fase se llega a su pieza.
  await primera.getByRole("link", { name: "Abrir la pieza" }).click();
  await expect(page.getByRole("heading", { name: "Fases y tareas" })).toBeVisible({ timeout: 60_000 });
});
