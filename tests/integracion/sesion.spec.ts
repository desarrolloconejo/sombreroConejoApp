import { expect, test, type Page } from "@playwright/test";
import { USUARIOS } from "../../db/datos/semilla.mts";

/**
 * El ciclo de vida de una sesion, recorrido en un navegador.
 *
 * Lo que aqui se comprueba es que la autoridad vive en el servidor: unas
 * cookies que eran buenas dejan de servir en cuanto la sesion se cierra,
 * aunque el token de acceso que llevan dentro todavia no haya caducado.
 */

function cuenta(email: string) {
  const usuario = USUARIOS.find((u) => u.email === email);
  if (!usuario) throw new Error(`La semilla no trae la cuenta ${email}`);
  return usuario;
}

async function entrar(page: Page, email: string) {
  const persona = cuenta(email);

  // El formulario es de cliente: hasta que hidrata, lo escrito se pierde.
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByPlaceholder("tucorreo@conejo.test").fill(persona.email);
  await page.getByPlaceholder("Tu contrasena").fill(persona.password);
  await page.getByPlaceholder("Tu contrasena").press("Enter");

  // Con margen: en desarrollo el primer inicio de sesion compila la action.
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 90_000 });
}

test("al entrar quedan las dos cookies, y ninguna la puede leer la pagina", async ({ page, context }) => {
  await entrar(page, "redes@conejo.test");

  const cookies = await context.cookies();
  const acceso = cookies.find((c) => c.name === "conejo_sesion");
  const renovacion = cookies.find((c) => c.name === "conejo_sesion_renovacion");

  expect(acceso?.httpOnly).toBe(true);
  expect(renovacion?.httpOnly).toBe(true);
  expect(acceso?.sameSite).toBe("Lax");

  const visibles = await page.evaluate(() => document.cookie);
  expect(visibles).not.toContain("conejo_sesion");
});

test("Mi perfil lista la sesion desde la que se mira", async ({ page }) => {
  await entrar(page, "redes@conejo.test");
  await page.goto("/dashboard/perfil");

  const tarjeta = page.getByRole("region", { name: "Sesiones abiertas" });
  await expect(tarjeta.getByText("Esta sesion")).toBeVisible();
});

test("cerrar sesion deja inservibles las cookies que se tenian", async ({ page, context }) => {
  await entrar(page, "redes@conejo.test");

  // Lo que se llevaria quien copiara las cookies con la sesion abierta.
  const copiadas = await context.cookies();

  await page.goto("/dashboard/perfil");
  await page
    .getByRole("region", { name: "Cerrar sesion" })
    .getByRole("button", { name: "Cerrar sesion" })
    .click();
  await expect(page).toHaveURL(/\/login$/);

  // Se vuelven a poner tal cual estaban. El token de acceso sigue verificando
  // durante media hora; lo que ya no existe es la sesion.
  await context.addCookies(copiadas);
  await page.goto("/dashboard/perfil");

  await expect(page).toHaveURL(/\/login\?motivo=caducada$/);
  await expect(page.getByText("Tu sesion termino")).toBeVisible();

  // Y el login se quedo con las cookies: no hay bucle ni segunda oportunidad.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?volverA=%2Fdashboard$/);
});

test("con el acceso perdido y la renovacion puesta, se vuelve a la misma ruta", async ({ page, context }) => {
  await entrar(page, "redes@conejo.test");

  // Quitar la cookie de acceso deja al navegador igual que cuando el acceso
  // caduca: sin token que verifique, pero con el de renovacion.
  await context.clearCookies({ name: "conejo_sesion" });

  await page.goto("/dashboard/hooks/historial?pagina=1");

  await expect(page).toHaveURL(/\/dashboard\/hooks\/historial\?pagina=1$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("sin ninguna cookie, la parada de renovar manda al login", async ({ page }) => {
  await page.goto("/renovar?volverA=/dashboard");

  await expect(page).toHaveURL(/\/login$/);
});
