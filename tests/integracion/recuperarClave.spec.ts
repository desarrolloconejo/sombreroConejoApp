import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { USUARIOS } from "../../db/datos/semilla.mts";

/**
 * «Olvide mi contrasena», de punta a punta, con el correo simulado.
 *
 * En desarrollo el correo no sale: el enlace privado se escribe en la consola
 * del servidor (y nunca en la bandeja de salida). La prueba lo lee de los
 * registros del contenedor. La contrasena nueva es la misma de la semilla,
 * para no cambiarle la cuenta a las demas pruebas.
 */

test.describe.configure({ mode: "serial" });

const PERSONA = USUARIOS.find((u) => u.email === "sintareas@conejo.test");
if (!PERSONA) throw new Error("La semilla no trae sintareas@conejo.test");

/** El ultimo enlace privado que escribio el servidor despues de `desde`. */
async function enlaceDesde(desde: string): Promise<string> {
  for (let intento = 0; intento < 30; intento++) {
    const registros = execSync(`docker compose logs app-dev --since ${desde} --no-color`, {
      encoding: "utf8",
    });
    const enlaces = [...registros.matchAll(/enlace privado: (\S+)/g)];
    if (enlaces.length > 0) return enlaces[enlaces.length - 1][1];
    await new Promise((resolver) => setTimeout(resolver, 1000));
  }
  throw new Error("El servidor no escribio ningun enlace");
}

async function pedirEnlace(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "¿Olvidaste tu contrasena?" }).click();
  await expect(page.getByRole("heading", { name: "Elige una nueva" })).toBeVisible({ timeout: 60_000 });
  await page.getByLabel("Correo").fill(email);
  await page.getByRole("button", { name: "Enviarme el enlace" }).click();
  await expect(page.getByText(/Si hay una cuenta con ese correo/)).toBeVisible({ timeout: 30_000 });
}

let enlace = "";

test("pide el enlace, elige la contrasena y entra con ella", async ({ page }) => {
  const desde = new Date(Date.now() - 2000).toISOString();
  await pedirEnlace(page, PERSONA!.email);

  enlace = await enlaceDesde(desde);
  expect(enlace).toMatch(/\/recuperar\/nueva\?token=[A-Za-z0-9_-]{43}$/);

  await page.goto(new URL(enlace).pathname + new URL(enlace).search, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Elige tu contrasena" })).toBeVisible({ timeout: 60_000 });

  // Las dos tienen que coincidir.
  await page.getByLabel("Contrasena nueva").fill(PERSONA!.password);
  await page.getByLabel("Repitela").fill("otra-distinta-123");
  await page.getByRole("button", { name: "Guardar la contrasena" }).click();
  await expect(page.getByText("Las contrasenas no coinciden")).toBeVisible({ timeout: 30_000 });

  await page.getByLabel("Repitela").fill(PERSONA!.password);
  await page.getByRole("button", { name: "Guardar la contrasena" }).click();

  await expect(page).toHaveURL(/\/login\?motivo=clave-nueva/, { timeout: 60_000 });
  await expect(page.getByText("Listo: tu contrasena cambio. Entra con la nueva")).toBeVisible();

  await page.getByPlaceholder("tucorreo@conejo.test").fill(PERSONA!.email);
  await page.getByPlaceholder("Tu contrasena").fill(PERSONA!.password);
  await page.getByPlaceholder("Tu contrasena").press("Enter");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 90_000 });
});

test("un enlace usado ya no sirve", async ({ page }) => {
  expect(enlace).not.toBe("");
  await page.goto(new URL(enlace).pathname + new URL(enlace).search, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Este enlace ya no sirve" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("link", { name: "Pedir otro enlace" })).toBeVisible();
});

test("un correo sin cuenta recibe la misma respuesta y ningun enlace", async ({ page }) => {
  const desde = new Date().toISOString();
  await pedirEnlace(page, `nadie-${Date.now()}@ejemplo.test`);

  await new Promise((resolver) => setTimeout(resolver, 3000));
  const registros = execSync(`docker compose logs app-dev --since ${desde} --no-color`, { encoding: "utf8" });
  expect(registros).not.toMatch(/enlace privado/);
});
