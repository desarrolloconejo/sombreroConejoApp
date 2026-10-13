import { expect, test, type Locator, type Page } from "@playwright/test";
import { USUARIOS } from "../../db/datos/semilla.mts";

/**
 * La campana, de punta a punta.
 *
 * Algo que pasa fuera de la sesion del administrador —una cuenta que se
 * bloquea por fallar la contrasena— tiene que llegarle a su campana, y abrirla
 * tiene que dejarla leida.
 *
 * Se hace sobre `bloqueo@conejo.test`, la cuenta de la semilla reservada para
 * esto. Tiene que ser solo suya: las pruebas corren en paralelo, y otra que le
 * restableciera la contrasena a mitad pondria su contador de fallos a cero.
 */

const BLOQUEADA = "bloqueo@conejo.test";

function administrador() {
  const admin = USUARIOS.find(
    (u) => u.perfil.tipo === "trabajador" && u.perfil.rol === "admin",
  );
  if (!admin) throw new Error("La semilla no trae ningun administrador");
  return admin;
}

/** El listado pinta cada fila dos veces, como tabla y como tarjeta. */
function visible(localizador: Locator): Locator {
  return localizador.locator("visible=true").first();
}

/** La campana del encabezado de escritorio: en movil hay otra, oculta. */
function campana(page: Page): Locator {
  return page.getByRole("button", { name: /^Notificaciones/ }).locator("visible=true").first();
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

test("una cuenta que se bloquea le llega a la campana del administrador", async ({ page, browser }) => {
  // Entrar, restablecer, cinco intentos fallidos y volver: es larga a proposito.
  test.setTimeout(240_000);

  const admin = administrador();
  await entrar(page, admin.email, admin.password);

  // Restablecer la contrasena levanta un bloqueo anterior y pone el contador
  // a cero: sin esto, una segunda pasada dentro de los 15 minutos encontraria
  // la cuenta ya bloqueada y sus fallos no contarian.
  await page.goto(`/dashboard/usuarios?busqueda=${encodeURIComponent(BLOQUEADA)}`);
  await visible(page.getByRole("link", { name: /^Restablecer la contrasena de/ })).click();
  await page.getByRole("button", { name: "Restablecer contrasena" }).click({ timeout: 30_000 });
  await expect(page.getByText(BLOQUEADA).locator("visible=true").first()).toBeVisible({
    timeout: 30_000,
  });

  // Los cinco fallos, desde otro navegador: nadie ha iniciado sesion ahi.
  const ajeno = await browser.newContext();
  const intruso = await ajeno.newPage();
  await intruso.goto("/login", { waitUntil: "networkidle" });

  for (let intento = 1; intento <= 5; intento++) {
    await intruso.getByPlaceholder("tucorreo@conejo.test").fill(BLOQUEADA);
    await intruso.getByPlaceholder("Tu contrasena").fill(`No-es-esta-${intento}`);

    await intruso.getByPlaceholder("Tu contrasena").press("Enter");

    /*
     * Se espera a que el campo se vacie, no al mensaje de error.
     *
     * El mensaje es el mismo en los cinco intentos, asi que a partir del
     * segundo ya esta en pantalla y verlo no dice nada. Lo que si marca el
     * final de cada intento es que React vacia el formulario al terminar la
     * action. Escribir antes de ese vaciado haria que el intento siguiente
     * saliera con los campos en blanco.
     */
    await expect(intruso.getByPlaceholder("Tu contrasena")).toHaveValue("", {
      timeout: 30_000,
    });
    await expect(intruso.getByText("no son correctos")).toBeVisible();
  }

  await ajeno.close();

  // La campana vive en el layout: una carga completa la trae al dia.
  await page.goto("/dashboard");
  await expect(campana(page)).toHaveAccessibleName(/sin leer$/);

  await campana(page).click();

  const lista = page.getByRole("region", { name: "Notificaciones" }).locator("visible=true");
  await expect(
    lista.getByText("La cuenta de Bloqueo Automatico se bloqueo").first(),
  ).toBeVisible();

  // Lleva al usuario bloqueado, que es donde se le restablece la contrasena.
  await lista.getByRole("link", { name: /La cuenta de Bloqueo Automatico se bloqueo/ }).first().click();
  await expect(page).toHaveURL(/\/dashboard\/usuarios\?busqueda=bloqueo%40conejo\.test$/);

  // Abrirla la dejo leida.
  await page.goto("/dashboard");
  await expect(campana(page)).toHaveAccessibleName("Notificaciones");
});

test("quien no tiene notificaciones ve la campana vacia, no un error", async ({ page }) => {
  const cliente = USUARIOS.find((u) => u.email === "cliente@empresa.test");
  if (!cliente) throw new Error("La semilla no trae la cuenta del cliente");

  await entrar(page, cliente.email, cliente.password);

  await campana(page).click();
  await expect(
    page.getByRole("region", { name: "Notificaciones" }).locator("visible=true"),
  ).toContainText("No tienes notificaciones");
});
