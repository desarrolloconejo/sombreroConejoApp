import { expect, test } from "@playwright/test";
import { USUARIOS } from "../../db/datos/semilla.mts";

/**
 * La matriz de acceso, recorrida de verdad en un navegador.
 *
 * Las credenciales salen de la semilla y no se escriben aqui: son las cuentas
 * de prueba que crea `npm run seed`, y si la semilla cambia, la prueba la sigue.
 */

function cuenta(email: string) {
  const usuario = USUARIOS.find((u) => u.email === email);
  if (!usuario) throw new Error(`La semilla no trae la cuenta ${email}`);
  return usuario;
}

test("sin sesion, la raiz manda al login", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
});

test("sin sesion, una ruta protegida recuerda a donde se queria ir", async ({ page }) => {
  await page.goto("/dashboard/perfil");

  await expect(page).toHaveURL(/\/login\?volverA=%2Fdashboard%2Fperfil$/);
});

test("un trabajador de redes entra, ve Hooks y no entra a Usuarios", async ({ page }) => {
  const redes = cuenta("redes@conejo.test");

  // El formulario es de cliente: hasta que hidrata, lo escrito se pierde.
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByPlaceholder("tucorreo@conejo.test").fill(redes.email);
  await page.getByPlaceholder("Tu contrasena").fill(redes.password);
  await page.getByPlaceholder("Tu contrasena").press("Enter");

  // Con margen: en desarrollo el primer inicio de sesion tras arrancar el
  // servidor compila la action, y eso solo ya pasa de los cinco segundos.
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 90_000 });
  await expect(page.getByRole("link", { name: "Hooks" }).first()).toBeVisible();

  // Su sesion es valida; lo que le falta es el rol. Vuelve al panel, no al login.
  await page.goto("/dashboard/usuarios");
  await expect(page).toHaveURL(/\/dashboard$/);
});
