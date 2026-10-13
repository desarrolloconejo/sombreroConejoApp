import { expect, test, type Page } from "@playwright/test";
import { USUARIOS } from "../../db/datos/semilla.mts";

/**
 * El menu por secciones, tal como lo ve cada quien.
 *
 * El reparto en si se prueba en tests/unitarias/navegacion.spec.ts. Aqui se
 * comprueba que llega a la pantalla: que el sidebar pinta un grupo por
 * seccion y que cada grupo tiene dentro lo que debe.
 */

async function entrar(page: Page, email: string) {
  const persona = USUARIOS.find((u) => u.email === email);
  if (!persona) throw new Error(`La semilla no trae la cuenta ${email}`);

  // El formulario es de cliente: hasta que hidrata, lo escrito se pierde.
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByPlaceholder("tucorreo@conejo.test").fill(persona.email);
  await page.getByPlaceholder("Tu contrasena").fill(persona.password);
  await page.getByPlaceholder("Tu contrasena").press("Enter");

  // Con margen: en desarrollo el primer inicio de sesion compila la action.
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
}

function administrador() {
  const admin = USUARIOS.find(
    (u) => u.perfil.tipo === "trabajador" && u.perfil.rol === "admin",
  );
  if (!admin) throw new Error("La semilla no trae ningun administrador");
  return admin.email;
}

test("el administrador ve el menu agrupado en General, Herramientas y Sistema", async ({ page }) => {
  await entrar(page, administrador());

  const menu = page.getByRole("navigation", { name: "Modulos" }).first();

  await expect(menu.getByRole("group", { name: "General" })).toBeVisible();
  await expect(
    menu.getByRole("group", { name: "Herramientas" }).getByRole("link", { name: "Hooks" }).first(),
  ).toBeVisible();

  const sistema = menu.getByRole("group", { name: "Sistema" });
  await expect(sistema.getByRole("link", { name: "Usuarios" })).toBeVisible();
  await expect(sistema.getByRole("link", { name: "Empresas" })).toBeVisible();
  await expect(sistema.getByRole("link", { name: "Auditoria" })).toBeVisible();
});

test("redes no ve la seccion Sistema, ni su rotulo", async ({ page }) => {
  await entrar(page, "redes@conejo.test");

  const menu = page.getByRole("navigation", { name: "Modulos" }).first();

  await expect(menu.getByRole("group", { name: "Herramientas" })).toBeVisible();
  await expect(menu.getByRole("group", { name: "Sistema" })).toHaveCount(0);
  await expect(menu.getByText("Sistema")).toHaveCount(0);
});
