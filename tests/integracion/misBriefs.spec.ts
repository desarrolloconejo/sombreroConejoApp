import { expect, test, type Page } from "@playwright/test";
import { USUARIOS } from "../../db/datos/semilla.mts";

/**
 * Mis briefs, del lado del cliente, de punta a punta.
 *
 * Empieza un brief de desarrollo de producto, responde lo obligatorio de cada
 * paso (marcando el empaque como propio, lo que oculta su paso), intenta
 * enviarlo sin fecha, lo envia y despues manda una version 2, que conserva
 * el codigo.
 */

test.describe.configure({ mode: "serial" });

async function entrar(page: Page, email: string) {
  const persona = USUARIOS.find((u) => u.email === email);
  if (!persona) throw new Error(`La semilla no trae ${email}`);

  await page.context().clearCookies();
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByPlaceholder("tucorreo@conejo.test").fill(persona.email);
  await page.getByPlaceholder("Tu contrasena").fill(persona.password);
  await page.getByPlaceholder("Tu contrasena").press("Enter");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 90_000 });
}

async function avisado(page: Page, texto: string | RegExp) {
  await expect(page.getByText(texto).first()).toBeVisible({ timeout: 60_000 });
}

/** Hoy mas unos dias, en Caracas, AAAA-MM-DD. */
function dentroDe(dias: number): string {
  const fecha = new Date(Date.now() + dias * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas" }).format(fecha);
}

async function siguiente(page: Page, paso: RegExp) {
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByRole("heading", { name: paso, level: 2 })).toBeVisible({ timeout: 30_000 });
}

test("el cliente llena, envia y manda una version 2 de un brief", async ({ page }) => {
  test.setTimeout(400_000);

  await entrar(page, "cliente@empresa.test");
  await page.goto("/dashboard/mis-briefs", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Empezar un Brief de Desarrollo de Producto/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/mis-briefs\/\d+$/, { timeout: 60_000 });

  // ---- Datos del proyecto: lo de la cuenta viene precargado.
  await expect(page.getByLabel(/Empresa \/ fabricante/)).not.toHaveValue("", { timeout: 60_000 });
  await expect(page.getByLabel(/Responsable: correo/)).toHaveValue("cliente@empresa.test");
  await page.getByLabel(/Producto \(idea\)/).fill("Galletas de avena con papelon");
  await page.getByLabel(/Responsable: cargo/).fill("Gerente de mercadeo");
  await page.getByLabel(/Responsable: teléfono/).fill("+58 412 555 0103");

  await siguiente(page, /La idea/);
  await page.getByLabel(/¿Qué producto quieres desarrollar\?/).fill("Una galleta de avena sin azucar refinada.");
  await page.getByRole("button", { name: "No lo sé" }).nth(1).click();
  await page.getByRole("radio").first().check();
  await page.getByRole("group").filter({ hasText: /¿Ya tiene nombre\?/ }).getByRole("radio").first().check();

  // ---- Alcance: todo lo tiene el cliente, tambien el empaque.
  await siguiente(page, /Alcance/);
  for (const boton of await page.getByRole("button", { name: "Lo tengo yo" }).all()) {
    await boton.click();
  }
  await avisado(page, /Ocultaremos el paso/);

  await siguiente(page, /El producto por dentro/);
  await siguiente(page, /El mercado/);
  await page.getByLabel(/¿Quién lo va a consumir\?|consumidor/i).first().fill("Adultos que cuidan lo que comen.");
  await page.getByRole("group").filter({ hasText: /¿Dónde te gustaría venderlo\?/ }).getByRole("checkbox").first().check();

  // El empaque no aparece: va directo a lanzamiento.
  await siguiente(page, /Lanzamiento/);
  for (const grupo of await page.getByRole("group").all()) {
    const opciones = grupo.getByRole("radio").or(grupo.getByRole("checkbox"));
    if ((await opciones.count()) > 0) await opciones.first().check();
  }

  await siguiente(page, /Recursos y tiempos/);
  for (const grupo of await page.getByRole("group").all()) {
    const opciones = grupo.getByRole("radio").or(grupo.getByRole("checkbox"));
    if ((await opciones.count()) > 0) await opciones.first().check();
  }

  await siguiente(page, /Antes de enviarlo/);
  await page.getByRole("checkbox", { name: /Confirmo que la información/ }).check();

  // ---- Sin fecha no se envia; con fecha, si.
  await page.getByRole("button", { name: "Enviar brief" }).click();
  await avisado(page, "Indica la fecha de entrega que aspiras");
  await page.getByLabel("Fecha de entrega que aspiras").fill(dentroDe(30));
  await page.getByRole("button", { name: "Enviar brief" }).click();
  await avisado(page, /Brief enviado. Su codigo es ECS-\d{8}-[0-9A-F]{6}/);

  await expect(page.getByRole("heading", { name: "Lo que enviaste" })).toBeVisible({ timeout: 60_000 });
  const kicker = await page.getByText(/^Brief ECS-/).first().textContent();
  const codigo = kicker?.match(/ECS-\d{8}-[0-9A-F]{6}/)?.[0];
  expect(codigo).toBeTruthy();
  // El empaque no quedo en lo enviado.
  await expect(page.getByRole("region", { name: /El empaque/ })).toHaveCount(0);

  // ---- Version 2: mismo codigo.
  await page.getByRole("button", { name: /enviar una version nueva/ }).click();
  await expect(page.getByRole("button", { name: "Enviar la version 2" })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Enviar la version 2" }).click();
  await avisado(page, new RegExp(`Version 2 del brief ${codigo} enviada`));
  await expect(page.getByRole("heading", { name: "Lo que enviaste (version 2)" })).toBeVisible({
    timeout: 60_000,
  });
});

test("quien no es cliente no entra en Mis briefs", async ({ page }) => {
  await entrar(page, "cuentas@conejo.test");
  await page.goto("/dashboard/mis-briefs");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 60_000 });
});
