import { expect, test, type Locator, type Page } from "@playwright/test";
import { USUARIOS } from "../../db/datos/semilla.mts";

/**
 * La auditoria, vista desde el navegador.
 *
 * Lo que se comprueba es el recorrido completo: que hacer algo deja una linea,
 * que la linea se puede leer, y que solo la lee quien debe.
 */

function cuenta(email: string) {
  const usuario = USUARIOS.find((u) => u.email === email);
  if (!usuario) throw new Error(`La semilla no trae la cuenta ${email}`);
  return usuario;
}

/** El administrador es la cuenta de la semilla con ese rol, sea cual sea. */
function administrador() {
  const admin = USUARIOS.find(
    (u) => u.perfil.tipo === "trabajador" && u.perfil.rol === "admin",
  );
  if (!admin) throw new Error("La semilla no trae ningun administrador");
  return admin;
}

/**
 * El primero de los que se ven.
 *
 * El listado pinta cada fila dos veces, como tabla y como tarjeta, y oculta
 * una de las dos segun el ancho. Sin esto se elegiria a veces la oculta.
 */
function visible(localizador: Locator): Locator {
  return localizador.locator("visible=true").first();
}

async function entrar(page: Page, email: string, password: string) {
  // El formulario es de cliente: hasta que hidrata, lo escrito se pierde.
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByPlaceholder("tucorreo@conejo.test").fill(email);
  await page.getByPlaceholder("Tu contrasena").fill(password);
  await page.getByPlaceholder("Tu contrasena").press("Enter");

  // Con margen: en desarrollo el primer inicio de sesion compila la action.
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
}

test("iniciar sesion deja una linea, y el administrador la puede abrir", async ({ page }) => {
  const admin = administrador();
  await entrar(page, admin.email, admin.password);

  await page.goto("/dashboard/auditoria?modulo=sesion");

  await expect(visible(page.getByText("Inicio de sesion"))).toBeVisible();

  // La primera linea es la mas reciente: el inicio de sesion de esta prueba.
  await visible(
    page.getByRole("link", { name: /^Ver el detalle: Inicio de sesion/ }),
  ).click();

  // El panel lateral es una region con nombre, no un dialogo.
  const detalle = page.getByRole("complementary", { name: "Inicio de sesion" });
  // Con margen: en desarrollo la primera apertura del panel compila la ruta.
  await expect(detalle).toBeVisible({ timeout: 30_000 });
  await expect(detalle.getByText(admin.email)).toBeVisible();
  await expect(detalle.getByText("Era entonces")).toBeVisible();
});

test("una contrasena equivocada tambien queda anotada", async ({ page }) => {
  const admin = administrador();
  const redes = cuenta("redes@conejo.test");

  // Un solo fallo: muy lejos de los cinco que bloquean la cuenta.
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByPlaceholder("tucorreo@conejo.test").fill(redes.email);
  await page.getByPlaceholder("Tu contrasena").fill("no-es-la-contrasena-1A");
  await page.getByPlaceholder("Tu contrasena").press("Enter");
  await expect(page.getByText("no son correctos")).toBeVisible({ timeout: 30_000 });

  await entrar(page, admin.email, admin.password);
  await page.goto("/dashboard/auditoria?modulo=sesion&busqueda=redes");

  await expect(visible(page.getByText("Intento de acceso fallido"))).toBeVisible();
});

test("desactivar y reactivar una cuenta deja las dos lineas, con su antes y su despues", async ({ page }) => {
  const admin = administrador();
  await entrar(page, admin.email, admin.password);

  // La cuenta de diseno no la usa ninguna otra prueba, y se deja como estaba.
  await page.goto("/dashboard/usuarios?busqueda=diseno%40conejo.test");
  await visible(page.getByRole("link", { name: /^Desactivar la cuenta de/ })).click();
  await page.getByRole("button", { name: "Desactivar cuenta" }).click({ timeout: 30_000 });
  await expect(page.getByText("quedo desactivada").first()).toBeVisible({ timeout: 30_000 });

  await page.goto("/dashboard/usuarios?busqueda=diseno%40conejo.test");
  await visible(page.getByRole("link", { name: /^Reactivar la cuenta de/ })).click();
  await page.getByRole("button", { name: "Reactivar cuenta" }).click({ timeout: 30_000 });
  await expect(page.getByText("vuelve a estar activa").first()).toBeVisible({ timeout: 30_000 });

  await page.goto("/dashboard/auditoria?modulo=usuario");
  await expect(visible(page.getByText("Usuario reactivado"))).toBeVisible();
  await expect(visible(page.getByText("Usuario desactivado"))).toBeVisible();

  // El detalle de la desactivacion trae el cambio de estado campo por campo.
  await visible(
    page.getByRole("link", { name: /^Ver el detalle: Usuario desactivado/ }),
  ).click();

  const detalle = page.getByRole("complementary", { name: "Usuario desactivado" });
  await expect(detalle).toBeVisible({ timeout: 30_000 });
  await expect(detalle.getByText("Que cambio")).toBeVisible();
  await expect(detalle.getByText("sesiones cerradas")).toBeVisible();
});

test("quien no es administrador no entra a la auditoria", async ({ page }) => {
  const redes = cuenta("redes@conejo.test");

  // Entrar bien pone a cero el fallo que dejo la prueba anterior.
  await entrar(page, redes.email, redes.password);

  await page.goto("/dashboard/auditoria");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("link", { name: "Auditoria" })).toHaveCount(0);
});
