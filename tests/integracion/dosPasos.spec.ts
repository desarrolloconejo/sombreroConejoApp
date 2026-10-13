import { expect, test, type Browser, type Page } from "@playwright/test";
import { USUARIOS } from "../../db/datos/semilla.mts";
import { codigoDelPaso, pasoDe } from "../../src/lib/totp";

/**
 * La verificacion en dos pasos, de punta a punta.
 *
 * Se hace con `dospasos@conejo.test`, la unica cuenta de la semilla a la que
 * se le pide configurarla. La prueba hace de telefono: con la clave que
 * muestra la pantalla calcula los mismos codigos que daria la app.
 *
 * Al terminar la desactiva, para que la siguiente pasada encuentre la cuenta
 * como la dejo la semilla... salvo en una cosa: quien la desactiva queda como
 * «prefiere no usarla», asi que la pasada siguiente la activa desde Mi perfil
 * y no desde la pantalla de bienvenida. Las dos entradas se cubren.
 */

const CUENTA = "dospasos@conejo.test";

function credenciales() {
  const usuario = USUARIOS.find((u) => u.email === CUENTA);
  if (!usuario) throw new Error(`La semilla no trae la cuenta ${CUENTA}`);
  return usuario;
}

/**
 * Un codigo que el servidor aceptara, posterior al ultimo que se uso.
 *
 * Cada codigo vale una sola vez, y la prueba necesita dos seguidos. Si no ha
 * cambiado el intervalo de treinta segundos desde el anterior, se toma el del
 * intervalo siguiente, que el servidor tolera.
 */
function codigoNuevo(secreto: string, ultimoPaso: number | null): { paso: number; valor: string } {
  const ahora = pasoDe(Date.now());
  const paso = ultimoPaso !== null && ahora <= ultimoPaso ? ultimoPaso + 1 : ahora;
  const valor = codigoDelPaso(secreto, paso);

  if (!valor) throw new Error("No se pudo calcular el codigo");

  return { paso, valor };
}

async function escribirCredenciales(page: Page) {
  const { email, password } = credenciales();

  // El formulario es de cliente: hasta que hidrata, lo escrito se pierde.
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByPlaceholder("tucorreo@conejo.test").fill(email);
  await page.getByPlaceholder("Tu contrasena").fill(password);
  await page.getByPlaceholder("Tu contrasena").press("Enter");
}

/**
 * Deja la cuenta sin los dos pasos, pase lo que pase antes.
 *
 * Una pasada que fallara a medias la deja activada con una clave que ya nadie
 * tiene. Un administrador se la retira, que es justo la salida prevista para
 * quien pierde el telefono: asi la prueba se recupera sola y, de paso, ese
 * camino queda cubierto.
 */
async function retirarSiLosTiene(browser: Browser) {
  const admin = USUARIOS.find(
    (u) => u.perfil.tipo === "trabajador" && u.perfil.rol === "admin",
  );
  if (!admin) throw new Error("La semilla no trae ningun administrador");

  const contexto = await browser.newContext();
  const page = await contexto.newPage();

  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByPlaceholder("tucorreo@conejo.test").fill(admin.email);
  await page.getByPlaceholder("Tu contrasena").fill(admin.password);
  await page.getByPlaceholder("Tu contrasena").press("Enter");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 90_000 });

  await page.goto(`/dashboard/usuarios?busqueda=${encodeURIComponent(CUENTA)}`);
  await page
    .getByRole("link", { name: /^Ver los datos de/ })
    .locator("visible=true")
    .first()
    .click();

  const ficha = page.getByRole("complementary", { name: /Dos Pasos/ });
  await expect(ficha.getByText("Verificacion en dos pasos:")).toBeVisible({ timeout: 30_000 });

  const retirar = ficha.getByRole("button", { name: /^Retirar la verificacion/ });

  if ((await retirar.count()) > 0) {
    await retirar.click();

    // La ficha se vuelve a pintar ya sin ellos: esa es la confirmacion.
    await expect(ficha.getByText("sin activar")).toBeVisible({ timeout: 30_000 });
    await expect(retirar).toHaveCount(0);
  }

  await contexto.close();
}

test("configurarla, entrar con el codigo, entrar con un respaldo y desactivarla", async ({ page, browser }) => {
  test.setTimeout(300_000);

  await retirarSiLosTiene(browser);

  await escribirCredenciales(page);

  // Sin activar: o le toca la pantalla de bienvenida, o ya dijo que no y cae
  // en el panel. En los dos casos se llega a «Configurar ahora».
  await expect(page).toHaveURL(/\/(dos-pasos|dashboard)$/, { timeout: 90_000 });

  if (page.url().endsWith("/dashboard")) {
    await page.goto("/dashboard/perfil");
  } else {
    /*
     * Pendiente de configurar, y sin haber dicho que no: no pasa de aqui.
     * Pedir cualquier pantalla del panel lo devuelve a esta.
     */
    for (const ruta of ["/dashboard", "/dashboard/perfil", "/dashboard/hooks"]) {
      await page.goto(ruta);
      await expect(page, ruta).toHaveURL(/\/dos-pasos$/);
    }
  }

  await page.getByRole("button", { name: "Configurar ahora" }).click();

  // El codigo QR, para escanearlo desde el telefono.
  await expect(
    page.getByRole("img", { name: /^Codigo QR para registrar la cuenta/ }),
  ).toBeVisible({ timeout: 30_000 });

  // La clave que se registraria en la app.
  const clave = page.locator("code").first();
  await expect(clave).toBeVisible({ timeout: 30_000 });
  const secreto = ((await clave.textContent()) ?? "").replace(/\s/g, "");
  expect(secreto).toMatch(/^[A-Z2-7]{32}$/);

  // Un codigo equivocado no activa nada.
  await page.getByLabel("Codigo de seis digitos").fill("000000");
  await page.getByRole("button", { name: "Activar" }).click();
  await expect(page.getByText("Ese codigo no coincide")).toBeVisible({ timeout: 30_000 });

  // El bueno si, y muestra los codigos de respaldo una sola vez.
  const primero = codigoNuevo(secreto, null);
  await page.getByLabel("Codigo de seis digitos").fill(primero.valor);
  await page.getByRole("button", { name: "Activar" }).click();

  const respaldos = page.getByRole("list", { name: "Codigos de respaldo" });
  await expect(respaldos).toBeVisible({ timeout: 30_000 });
  const lista = await respaldos.getByRole("listitem").allTextContents();
  expect(lista).toHaveLength(10);

  await page.getByRole("button", { name: "Ya los guarde" }).click();
  await expect(page).toHaveURL(/\/dashboard(\/perfil)?$/, { timeout: 30_000 });

  // --- Entrar de nuevo: ahora la contrasena sola no basta -------------------
  await page.context().clearCookies();
  await escribirCredenciales(page);
  await expect(page).toHaveURL(/\/verificar$/, { timeout: 30_000 });

  // Con la contrasena bien y sin codigo, el panel sigue cerrado.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);

  await escribirCredenciales(page);
  await expect(page).toHaveURL(/\/verificar$/, { timeout: 30_000 });

  // El MISMO codigo con el que se activo ya no vale: cada uno sirve una vez.
  await page.getByLabel("Codigo de verificacion").fill(primero.valor);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("El codigo no es correcto")).toBeVisible({ timeout: 30_000 });

  // Uno nuevo si.
  await page.getByLabel("Codigo de verificacion").fill(codigoNuevo(secreto, primero.paso).valor);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });

  // --- Sin telefono: un codigo de respaldo, y solo una vez -----------------
  await page.context().clearCookies();
  await escribirCredenciales(page);
  await expect(page).toHaveURL(/\/verificar$/, { timeout: 30_000 });
  await page.getByLabel("Codigo de verificacion").fill(lista[0].toLowerCase());
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });

  await page.goto("/dashboard/perfil");
  const tarjeta = page.getByRole("region", { name: "Verificacion en dos pasos" });
  await expect(tarjeta.getByText("Activada")).toBeVisible();
  await expect(tarjeta.getByText(/quedan\s+9\s+codigos/)).toBeVisible();

  // --- Desactivarla pide la contrasena -------------------------------------
  await tarjeta.getByLabel("Para desactivarla, escribe tu contrasena").fill("no-es-esta-1A");
  await tarjeta.getByRole("button", { name: "Desactivar" }).click();
  await expect(tarjeta.getByText("La contrasena no es correcta")).toBeVisible({ timeout: 30_000 });

  await tarjeta
    .getByLabel("Para desactivarla, escribe tu contrasena")
    .fill(credenciales().password);
  await tarjeta.getByRole("button", { name: "Desactivar" }).click();
  await expect(tarjeta.getByText("Sin activar")).toBeVisible({ timeout: 30_000 });

  // Y vuelve a entrar solo con la contrasena.
  await page.context().clearCookies();
  await escribirCredenciales(page);
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
});

test("sin configurarla y sin haber dicho que no, no se pasa de su pantalla", async ({ page, browser }) => {
  test.setTimeout(240_000);

  // Un administrador se la retira: es lo que deja la cuenta «pendiente», igual
  // que una cuenta nueva. Si no la tenia activada, se activa primero.
  await retirarSiLosTiene(browser);
  await escribirCredenciales(page);
  await expect(page).toHaveURL(/\/(dos-pasos|dashboard)$/, { timeout: 90_000 });

  if (page.url().endsWith("/dashboard")) {
    // Ya habia dicho que no: se activa desde Mi perfil y se le retira, que es
    // la forma de volver a dejarla pendiente desde la propia aplicacion.
    await page.goto("/dashboard/perfil");
    await page.getByRole("button", { name: "Configurar ahora" }).click();
    const clave = page.locator("code").first();
    await expect(clave).toBeVisible({ timeout: 30_000 });
    const secreto = ((await clave.textContent()) ?? "").replace(/\s/g, "");
    await page.getByLabel("Codigo de seis digitos").fill(codigoNuevo(secreto, null).valor);
    await page.getByRole("button", { name: "Activar" }).click();
    await expect(page.getByRole("list", { name: "Codigos de respaldo" })).toBeVisible({
      timeout: 30_000,
    });
    await retirarSiLosTiene(browser);
  }

  // Pendiente: tras la contrasena cae en la pantalla de configuracion...
  await page.context().clearCookies();
  await escribirCredenciales(page);
  await expect(page).toHaveURL(/\/dos-pasos$/, { timeout: 30_000 });

  // ...y no sale de ella pida lo que pida.
  for (const ruta of ["/dashboard", "/dashboard/perfil", "/dashboard/hooks"]) {
    await page.goto(ruta);
    await expect(page, ruta).toHaveURL(/\/dos-pasos$/);
  }

  // Hasta que declara que no la quiere. Entonces si, y no se le vuelve a pedir.
  await page.getByRole("button", { name: "Ahora no, entrar sin ella" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });

  await page.context().clearCookies();
  await escribirCredenciales(page);
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
});

test("la pantalla del codigo no se abre sin haber acertado la contrasena", async ({ page }) => {
  await page.goto("/verificar");

  await expect(page).toHaveURL(/\/login$/);
});
