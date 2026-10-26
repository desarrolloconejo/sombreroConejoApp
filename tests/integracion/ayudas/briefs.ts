import { expect, type Page } from "@playwright/test";
import { USUARIOS } from "../../../db/datos/semilla.mts";

/**
 * Lo que comparten las pruebas de briefs: entrar con una cuenta de la
 * semilla y llenar y enviar un brief de desarrollo de producto respondiendo
 * solo lo obligatorio.
 */

export async function entrar(page: Page, email: string) {
  const persona = USUARIOS.find((u) => u.email === email);
  if (!persona) throw new Error(`La semilla no trae ${email}`);

  await page.context().clearCookies();
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByPlaceholder("tucorreo@conejo.test").fill(persona.email);
  await page.getByPlaceholder("Tu contrasena").fill(persona.password);
  await page.getByPlaceholder("Tu contrasena").press("Enter");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 90_000 });
}

export async function avisado(page: Page, texto: string | RegExp) {
  await expect(page.getByText(texto).first()).toBeVisible({ timeout: 60_000 });
}

/** Hoy mas unos dias, en Caracas, AAAA-MM-DD. */
export function dentroDe(dias: number): string {
  const fecha = new Date(Date.now() + dias * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas" }).format(fecha);
}

async function siguiente(page: Page, paso: RegExp) {
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByRole("heading", { name: paso, level: 2 })).toBeVisible({ timeout: 30_000 });
}

/** Marca la primera opcion de cada grupo del paso en pantalla. */
async function primeraOpcionDeCadaGrupo(page: Page) {
  for (const grupo of await page.getByRole("group").all()) {
    const opciones = grupo.getByRole("radio").or(grupo.getByRole("checkbox"));
    if ((await opciones.count()) > 0) await opciones.first().check();
  }
}

/**
 * Empieza un brief como el cliente en sesion, responde lo obligatorio y lo
 * deja en el ultimo paso, sin enviar. `producto` distingue un brief de otro.
 */
export async function llenarBrief(page: Page, producto: string) {
  await empezarBrief(page);
  await responderBrief(page, producto);
}

/**
 * Empieza un brief de Desarrollo de Producto como el cliente en sesion: la
 * ventana de «Nuevo brief», elegir el formato y confirmar. Deja en su
 * formulario.
 */
export async function empezarBrief(page: Page) {
  await page.goto("/dashboard/mis-briefs", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Nuevo brief" }).click();
  const ventana = page.getByRole("dialog", { name: "Nuevo brief" });
  await ventana.getByLabel(/Brief de Desarrollo de Producto/).check({ timeout: 60_000 });
  await ventana.getByRole("button", { name: "Empezar el brief" }).click();
  await expect(page).toHaveURL(/\/dashboard\/mis-briefs\/\d+$/, { timeout: 60_000 });
}

/**
 * Con el formulario abierto en su primer paso, responde lo obligatorio (el
 * empaque, como propio: su paso se oculta) y lo deja en el ultimo paso.
 */
export async function responderBrief(page: Page, producto: string) {
  await expect(page.getByLabel(/Empresa \/ fabricante/)).not.toHaveValue("", { timeout: 60_000 });
  await page.getByLabel(/Producto \(idea\)/).fill(producto);
  await page.getByLabel(/Responsable: cargo/).fill("Gerente de mercadeo");
  await page.getByLabel(/Responsable: teléfono/).fill("+58 412 555 0103");

  await siguiente(page, /La idea/);
  await page.getByLabel(/¿Qué producto quieres desarrollar\?/).fill(`${producto}, sin azucar refinada.`);
  await primeraOpcionDeCadaGrupo(page);

  await siguiente(page, /Alcance/);
  for (const boton of await page.getByRole("button", { name: "Lo tengo yo" }).all()) {
    await boton.click();
  }

  await siguiente(page, /El producto por dentro/);
  await siguiente(page, /El mercado/);
  await page.getByLabel(/¿Quién lo va a consumir\?/).fill("Adultos que cuidan lo que comen.");
  await primeraOpcionDeCadaGrupo(page);

  await siguiente(page, /Lanzamiento/);
  await primeraOpcionDeCadaGrupo(page);
  await siguiente(page, /Recursos y tiempos/);
  await primeraOpcionDeCadaGrupo(page);
  await siguiente(page, /Antes de enviarlo/);
  await page.getByRole("checkbox", { name: /Confirmo que la información/ }).check();
}

/** Llena y envia un brief. Devuelve su codigo. */
export async function enviarBrief(page: Page, producto: string): Promise<string> {
  await llenarBrief(page, producto);
  return enviarAbierto(page);
}

/** Envia el brief que ya esta respondido en pantalla. Devuelve su codigo. */
export async function enviarAbierto(page: Page): Promise<string> {
  await page.getByLabel("Fecha de entrega que aspiras").fill(dentroDe(30));
  await page.getByRole("button", { name: "Enviar brief" }).click();
  await avisado(page, /Brief enviado. Su codigo es ECS-/);
  await expect(page.getByRole("heading", { name: "Lo que enviaste" })).toBeVisible({ timeout: 60_000 });

  const kicker = await page.getByText(/Brief ECS-\d{8}-/).first().textContent();
  const codigo = kicker?.match(/ECS-\d{8}-[0-9A-F]{6}/)?.[0];
  if (!codigo) throw new Error("El brief enviado no muestra su codigo");
  return codigo;
}
