import { expect, test, type Page } from "@playwright/test";
import { EMAIL_ADMIN_PRUEBAS, EMAIL_EJECUTIVO, USUARIOS } from "../../db/datos/semilla.mts";
import { elegirEmpresa, elegirOpcion } from "./ayudas/formularios";

/**
 * Proyectos, de punta a punta, como ejecutivo de cuentas.
 *
 * Crea un proyecto de redes con una pieza, marca la tarea de redaccion,
 * completa la fase y comprueba que la bateria suma. Al final cancela el
 * proyecto: queda en la base, pero fuera del tablero.
 */

function ejecutivo() {
  const persona = USUARIOS.find((u) => u.email === EMAIL_EJECUTIVO);
  if (!persona) throw new Error("La semilla no trae al ejecutivo de cuentas");
  return persona;
}

async function entrar(page: Page, email: string, password: string) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByPlaceholder("tucorreo@conejo.test").fill(email);
  await page.getByPlaceholder("Tu contrasena").fill(password);
  await page.getByPlaceholder("Tu contrasena").press("Enter");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 90_000 });
}

test("el ejecutivo crea un proyecto, cumple una tarea y completa la fase", async ({ page }) => {
  const persona = ejecutivo();
  const nombre = `Prueba de integracion ${Date.now()}`;

  await entrar(page, persona.email, persona.password);

  await page.goto("/dashboard/proyectos?panel=nuevo", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Abrir un proyecto" })).toBeVisible({
    timeout: 60_000,
  });

  await elegirEmpresa(page);
  // Lo lleva quien lo abre: el ejecutivo no elige.
  await expect(page.getByText("Solo un administrador puede darselo a otro ejecutivo.")).toBeVisible();
  await page.getByLabel("Nombre", { exact: true }).fill(nombre);
  await page.getByLabel("Titulo de la pieza 1").fill("Pieza de la prueba");
  await page.getByRole("button", { name: "Crear proyecto" }).click();

  // Al crearlo, se abre su pagina.
  await expect(page).toHaveURL(/\/dashboard\/proyectos\/\d+$/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: nombre })).toBeVisible();
  await expect(page.getByRole("img", { name: "Avance del proyecto: 0 por ciento" })).toBeVisible();

  // Al editarlo, ve quien lo lleva pero no lo cambia.
  const proyectoUrl = page.url();
  await page.getByRole("link", { name: "Editar" }).click();
  await expect(page.getByText("Solo un administrador puede cambiar quien lo lleva.")).toBeVisible({
    timeout: 60_000,
  });
  await page.goto(proyectoUrl, { waitUntil: "networkidle" });

  // La ficha de la pieza.
  await page.getByRole("link", { name: /Pieza de la prueba/ }).click();
  await expect(page.getByRole("heading", { name: "Fases y tareas" })).toBeVisible({
    timeout: 60_000,
  });

  // Con la tarea pendiente, la fase no se puede completar.
  const completar = page.getByRole("button", { name: "Completar fase" });
  await expect(completar).toBeDisabled();

  await page.getByRole("button", { name: "Marcar como lista la tarea Redactar el copy" }).click();
  await expect(page.getByText("Tarea lista").first()).toBeVisible({ timeout: 30_000 });

  await expect(completar).toBeEnabled({ timeout: 30_000 });
  await completar.click();
  await expect(page.getByText("Redaccion de contenido: completada").first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("img", { name: "Avance de la pieza: 20 por ciento" })).toBeVisible();

  // Un comentario en la fase 1, sobre su tarea: sale en esa fase con la tarea
  // como etiqueta, y no entre los generales.
  const fase1 = page.locator("details").filter({ has: page.locator("summary", { hasText: "Comentarios" }) }).first();
  await fase1.locator("summary").click();
  await elegirOpcion(page, "Sobre la tarea", "Redactar el copy", fase1);
  await fase1.getByPlaceholder("Solo lo ve el equipo.").fill("Revisar el tono antes de enviar");
  await fase1.getByRole("button", { name: "Comentar" }).click();
  await expect(page.getByText("Comentario anadido").first()).toBeVisible({ timeout: 30_000 });
  await expect(fase1.getByRole("listitem").filter({ hasText: "Revisar el tono antes de enviar" })).toContainText(
    "Redactar el copy",
  );
  await expect(page.getByText("Sin comentarios generales")).toBeVisible();

  // Fuera del tablero: se cancela.
  await page.getByRole("link", { name: nombre }).click();
  await page.getByRole("link", { name: "Estado" }).click();
  await page.getByRole("button", { name: "Cancelar el proyecto" }).click();
  await expect(page.getByText("El estado del proyecto cambio").first()).toBeVisible({
    timeout: 30_000,
  });
});

test("quien no es de cuentas no entra en Proyectos", async ({ page }) => {
  const redes = USUARIOS.find((u) => u.email === "redes@conejo.test");
  if (!redes) throw new Error("La semilla no trae a redes");

  await entrar(page, redes.email, redes.password);
  await page.goto("/dashboard/proyectos");

  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 60_000 });
});

test("el administrador elige quien lleva un proyecto, tambien de otra cuenta", async ({ page }) => {
  const admin = USUARIOS.find((u) => u.email === EMAIL_ADMIN_PRUEBAS);
  if (!admin) throw new Error("La semilla no trae al administrador");

  await entrar(page, admin.email, admin.password);
  await page.goto("/dashboard/proyectos?panel=nuevo", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Abrir un proyecto" })).toBeVisible({ timeout: 60_000 });
  await elegirEmpresa(page);
  await expect(page.getByText("Solo un administrador puede darselo a otro ejecutivo.")).toHaveCount(0);
  await elegirOpcion(page, "Lo lleva", "Andres Rojas");
});
