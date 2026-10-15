import { expect, test, type Page } from "@playwright/test";
import { avisado, entrar, enviarAbierto, responderBrief } from "./ayudas/briefs";

/**
 * El enlace privado de un prospecto, de punta a punta.
 *
 * El ejecutivo genera el enlace y lo ve una vez; el prospecto, sin cuenta,
 * llena y envia su brief por el; el brief llega a la bandeja y aceptarlo
 * convierte al prospecto en cliente, con su contrasena provisional. Un enlace
 * revocado, o uno que no existe, solo dice que ya no es valido.
 */

test.describe.configure({ mode: "serial" });

/** Genera un enlace desde la bandeja, con la sesion en curso. Devuelve su ruta. */
async function generarEnlace(page: Page, empresa: string, email: string): Promise<string> {
  await page.goto("/dashboard/briefs", { waitUntil: "networkidle" });
  await page.getByLabel("Empresa", { exact: true }).fill(empresa);
  await page.getByLabel("Persona de contacto").fill("Ana Prospecto");
  await page.getByLabel("Correo").fill(email);
  await page.getByRole("button", { name: "Generar enlace" }).click();
  await avisado(page, /Enlace creado para/);

  const url = await page.getByLabel("Enlace generado").textContent();
  const ruta = url?.match(/\/brief\/[A-Za-z0-9_-]{43}$/)?.[0];
  if (!ruta) throw new Error("No se mostro el enlace generado");
  return ruta;
}

test("el prospecto llena su brief por el enlace, y aceptarlo lo hace cliente", async ({ page }) => {
  test.setTimeout(400_000);
  const marca = Date.now();
  const empresa = `Prospecto ${marca}`;
  const email = `prospecto${marca}@ejemplo.test`;

  await entrar(page, "cuentas@conejo.test");
  const ruta = await generarEnlace(page, empresa, email);

  // ---- El prospecto, sin sesion.
  await page.context().clearCookies();
  await page.goto(ruta, { waitUntil: "networkidle" });
  await expect(page.getByText("Hola, Ana Prospecto")).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Empezar el brief" }).click();
  await expect(page.getByLabel(/Empresa \/ fabricante/)).toHaveValue(empresa, { timeout: 60_000 });

  await responderBrief(page, `Granola ${marca}`);
  const codigo = await enviarAbierto(page);

  // Vuelve con el mismo enlace y ve lo que envio; el panel sigue cerrado.
  await page.goto(ruta, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Lo que enviaste" })).toBeVisible({ timeout: 60_000 });
  await page.goto("/dashboard/briefs");
  await expect(page).toHaveURL(/\/login/, { timeout: 60_000 });

  // ---- El ejecutivo lo encuentra en la bandeja y lo acepta.
  await entrar(page, "cuentas@conejo.test");
  await page.goto("/dashboard/briefs", { waitUntil: "networkidle" });
  const fila = page.getByRole("region", { name: "Por decidir" }).getByRole("link", { name: new RegExp(codigo) });
  await expect(fila).toContainText("prospecto");
  await fila.click();
  await expect(page.getByRole("heading", { name: "Brief completo" })).toBeVisible({ timeout: 60_000 });

  await page.getByRole("button", { name: "Aceptar y abrir proyecto" }).click();
  await expect(page.getByRole("heading", { name: "Cuenta creada para el prospecto" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(email).first()).toBeVisible();
});

test("un enlace revocado o inexistente solo dice que ya no es valido", async ({ page }) => {
  test.setTimeout(200_000);
  const marca = Date.now();
  const empresa = `Revocable ${marca}`;

  await entrar(page, "cuentas@conejo.test");
  const ruta = await generarEnlace(page, empresa, `revocable${marca}@ejemplo.test`);

  await page.getByRole("button", { name: `Revocar el enlace de ${empresa}` }).click();
  await avisado(page, "Enlace revocado");

  await page.context().clearCookies();
  for (const destino of [ruta, "/brief/no-existe", `/brief/${"A".repeat(43)}`]) {
    await page.goto(destino, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Este enlace ya no es valido" })).toBeVisible({ timeout: 60_000 });
  }
});
