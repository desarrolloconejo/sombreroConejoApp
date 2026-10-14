import { expect, test, type Locator, type Page } from "@playwright/test";
import { EMAIL_ADMIN_PRUEBAS, EMAIL_EJECUTIVO, USUARIOS } from "../../db/datos/semilla.mts";

/**
 * Las asignaciones de ejecutivos, desde la ficha de una empresa.
 *
 * La semilla deja al ejecutivo de cuentas atendiendo a la empresa de ejemplo.
 * La prueba se la quita y se la vuelve a asignar, asi que al terminar todo
 * queda como estaba.
 */

function administrador() {
  const admin = USUARIOS.find(
    (u) => u.email === EMAIL_ADMIN_PRUEBAS,
  );
  if (!admin) throw new Error("La semilla no trae ningun administrador");
  return admin;
}

function ejecutivo() {
  const persona = USUARIOS.find((u) => u.email === EMAIL_EJECUTIVO);
  if (!persona) throw new Error("La semilla no trae al ejecutivo de cuentas");
  return persona;
}

/** El listado pinta cada fila dos veces, como tabla y como tarjeta. */
function visible(localizador: Locator): Locator {
  return localizador.locator("visible=true").first();
}

async function entrar(page: Page, email: string, password: string) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByPlaceholder("tucorreo@conejo.test").fill(email);
  await page.getByPlaceholder("Tu contrasena").fill(password);
  await page.getByPlaceholder("Tu contrasena").press("Enter");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 90_000 });
}

/** Abre la ficha de la empresa de ejemplo desde el listado. */
async function abrirFicha(page: Page) {
  await page.goto("/dashboard/empresas?busqueda=Distribuidora");
  await visible(page.getByRole("link", { name: /^Ver la ficha de/ })).click();
  await expect(page.getByText("Quien la atiende")).toBeVisible({ timeout: 60_000 });
}

test("el administrador quita y vuelve a asignar el ejecutivo de una empresa", async ({ page }) => {
  const admin = administrador();
  const nombre = `${ejecutivo().nombre} ${ejecutivo().apellido}`;

  await entrar(page, admin.email, admin.password);
  await abrirFicha(page);

  // Si un intento anterior se quedo a medias, la empresa ya esta sin el.
  const quitar = page.getByRole("button", { name: `Quitar a ${nombre}` });
  if (await quitar.isVisible()) {
    await quitar.click();
    await expect(page.getByText(`${nombre} deja de atender a`).first()).toBeVisible({
      timeout: 30_000,
    });
  }
  await expect(page.getByText("Ningun ejecutivo la atiende todavia")).toBeVisible();

  await page.getByRole("combobox", { name: "Asignar un ejecutivo" }).click();
  await page.getByRole("option", { name: nombre }).click();
  await page.getByRole("button", { name: "Asignar", exact: true }).click();

  await expect(page.getByText(`${nombre} atiende ahora a`).first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: `Quitar a ${nombre}` })).toBeVisible();
});

test("no se desactiva a un ejecutivo con proyectos a su cargo sin reasignarlos", async ({ page }) => {
  const admin = administrador();

  await entrar(page, admin.email, admin.password);
  await page.goto(`/dashboard/usuarios?busqueda=${encodeURIComponent(EMAIL_EJECUTIVO)}`);
  await visible(page.getByRole("link", { name: /^Desactivar la cuenta de/ })).click();
  await page.getByRole("button", { name: "Desactivar cuenta" }).click({ timeout: 30_000 });

  // La semilla le da dos proyectos: con eso basta para que se niegue.
  await expect(
    page.getByText(/proyectos a su cargo.*Reasignalos antes de desactivar la cuenta/).first(),
  ).toBeVisible({ timeout: 30_000 });
});
