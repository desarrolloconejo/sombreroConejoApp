import { expect, test } from "@playwright/test";
import { avisado, entrar } from "./ayudas/briefs";
import { elegirOpcion } from "./ayudas/formularios";

/**
 * Ajustes de finanzas, del lado de administracion: emisor, numeracion que
 * solo sube, medios de pago y formatos de impresion.
 */

test.describe.configure({ mode: "serial" });

const CAPTURAS = process.env.CAPTURAS_DIR;

test("administracion configura emisor, numeracion, medios y formatos", async ({ page }) => {
  test.setTimeout(300_000);
  const marca = Date.now();

  await entrar(page, "finanzas@conejo.test");
  await page.goto("/dashboard/ajustes-finanzas", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Ajustes de finanzas", level: 1 })).toBeVisible({ timeout: 60_000 });
  if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/ajustes-escritorio.png`, fullPage: true });

  // ---- Emisor: un RIF mal escrito no se guarda.
  await page.getByLabel("RIF", { exact: true }).fill("12345");
  await page.getByRole("button", { name: "Guardar los ajustes" }).click();
  await avisado(page, "Escribe el RIF asi: J-12345678-9");
  await page.getByLabel("RIF", { exact: true }).fill("J-00000000-0");
  await page.getByRole("button", { name: "Guardar los ajustes" }).click();
  await avisado(page, "Ajustes guardados");

  // ---- Numeracion: bajar no se puede; subir si.
  const proxima = Number(await page.getByLabel("Proximo numero de factura").inputValue());
  await page.getByLabel("Proximo numero de factura").fill("1");
  await page.getByRole("button", { name: "Guardar la numeracion" }).click();
  if (proxima > 1) await avisado(page, /solo pueden subir/);
  await page.getByLabel("Proximo numero de factura").fill(String(proxima + 1));
  await page.getByRole("button", { name: "Guardar la numeracion" }).click();
  await avisado(page, "Numeracion guardada");

  // ---- Medios de pago: alta y edicion en su sitio.
  const nombre = `Binance ${marca}`;
  await page.getByRole("button", { name: "Anadir un medio de pago" }).click();
  await page.locator("#medio-nuevo-nombre").fill(nombre);
  await page.getByRole("button", { name: "Anadir el medio" }).click();
  await avisado(page, "Medio de pago creado");
  await page.getByRole("button", { name: `Editar ${nombre}` }).click();
  await page.getByRole("list", { name: "Medios de pago" }).getByLabel("Activo: el cliente lo ve").uncheck();
  await page.getByRole("button", { name: "Guardar el medio" }).click();
  await avisado(page, "Medio de pago guardado");
  await expect(page.getByRole("listitem").filter({ hasText: nombre })).toContainText("Inactivo");

  // ---- Formatos: duplicar el de ejemplo lleva a su editor; se usa y se vuelve.
  await page.getByRole("link", { name: /^Carta \(ejemplo\)/ }).click();
  await expect(page.getByRole("heading", { name: "Carta (ejemplo)", level: 1 })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Duplicar" }).click();
  await expect(page.getByRole("heading", { name: /^Copia( \d+)? de Carta \(ejemplo\)/, level: 1 })).toBeVisible({
    timeout: 60_000,
  });
  if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/formato-escritorio.png`, fullPage: true });

  await page.getByLabel("Nombre", { exact: true }).fill(`Media carta ${marca}`);
  await page.getByLabel("Alto (mm)").fill("139.7");
  await page.getByRole("button", { name: "Guardar el formato" }).click();
  await avisado(page, "Hay medidas que no caben en la hoja");
  await page.getByLabel("Alto (mm)").fill("279.4");
  await page.getByRole("button", { name: "Guardar el formato" }).click();
  await avisado(page, "Formato guardado");

  await page.getByRole("button", { name: "Usar como habitual" }).click();
  await avisado(page, "Ahora es el formato habitual");

  // El de ejemplo vuelve a ser el habitual: el resto de pruebas cuenta con el.
  await page.goto("/dashboard/ajustes-finanzas", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: /^Carta \(ejemplo\)/ }).click();
  await page.getByRole("button", { name: "Usar como habitual" }).click();
  await avisado(page, "Ahora es el formato habitual");

  // ---- Datos de facturacion de una empresa.
  await page.goto("/dashboard/ajustes-finanzas", { waitUntil: "networkidle" });
  await elegirOpcion(page, "Retencion de IVA de Distribuidora Ejemplo, C.A.", "Retiene el 75 %");
  await page.getByRole("button", { name: "Guardar los datos de facturacion de Distribuidora Ejemplo, C.A." }).click();
  await avisado(page, "Datos de facturacion guardados");
  await elegirOpcion(page, "Retencion de IVA de Distribuidora Ejemplo, C.A.", "No retiene");
  await page.getByRole("button", { name: "Guardar los datos de facturacion de Distribuidora Ejemplo, C.A." }).click();
  await avisado(page, "Datos de facturacion guardados");

  if (CAPTURAS) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${CAPTURAS}/ajustes-movil.png`, fullPage: true });
  }
});

test("quien no opera finanzas no entra en los ajustes", async ({ page }) => {
  await entrar(page, "cuentas@conejo.test");
  await page.goto("/dashboard/ajustes-finanzas");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 60_000 });
});

test("la tasa del dolar se registra a mano, un salto grande se confirma y una fecha no se pisa", async ({ page }) => {
  test.setTimeout(200_000);
  // Fechas viejas que no estorban a la tasa vigente; distintas en cada corrida.
  // Con solo el ano chocaba con corridas anteriores (89 huecos); con el dia,
  // son casi 2.500.
  const segundos = Math.floor(Date.now() / 1000);
  const ano = 1900 + (segundos % 89);
  const dia = String(1 + (Math.floor(segundos / 89) % 28)).padStart(2, "0");
  const enero = `${ano}-01-${dia}`;
  const febrero = `${ano}-02-${dia}`;

  await entrar(page, "finanzas@conejo.test");
  await page.goto("/dashboard/ajustes-finanzas", { waitUntil: "networkidle" });
  await expect(page.getByText("La que se usa al facturar hoy")).toBeVisible({ timeout: 60_000 });

  await page.getByLabel("Fecha de la tasa").fill(enero);
  await page.getByLabel("Bolivares por dolar").fill("40,5");
  await page.getByRole("button", { name: "Registrar la tasa" }).click();

  // Otras corridas dejaron tasas de anos anteriores: contra ellas esta puede
  // parecer un salto. Si lo pide, se confirma.
  const confirmar = page.getByRole("checkbox", { name: /Revisala/ });
  await expect(page.getByText("Tasa registrada").or(confirmar).first()).toBeVisible({ timeout: 60_000 });
  if (await confirmar.isVisible()) {
    await confirmar.check();
    await page.getByRole("button", { name: "Registrar la tasa" }).click();
    await expect(confirmar).toHaveCount(0, { timeout: 60_000 });
  }
  await expect(page.getByLabel("Bolivares por dolar")).toHaveValue("", { timeout: 60_000 });

  // Diez veces mas al mes siguiente: pide confirmarlo.
  await page.getByLabel("Fecha de la tasa").fill(febrero);
  await page.getByLabel("Bolivares por dolar").fill("405");
  await page.getByRole("button", { name: "Registrar la tasa" }).click();
  await avisado(page, /Revisala: USD pasaria de/);
  await page.getByRole("checkbox", { name: /Revisala/ }).check();
  await page.getByRole("button", { name: "Registrar la tasa" }).click();
  // El aviso del primer registro sigue a la vista: se espera a que el
  // formulario quede limpio, que es cuando termino el segundo.
  await expect(page.getByRole("checkbox", { name: /Revisala/ })).toHaveCount(0, { timeout: 60_000 });
  await expect(page.getByLabel("Bolivares por dolar")).toHaveValue("");

  // La misma fecha otra vez no se pisa.
  await page.getByLabel("Fecha de la tasa").fill(enero);
  await page.getByLabel("Bolivares por dolar").fill("41");
  await page.getByRole("button", { name: "Registrar la tasa" }).click();
  await avisado(page, "Ya hay una tasa para ese dia: no se pisa");
});
