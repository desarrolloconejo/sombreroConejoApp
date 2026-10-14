import { expect, test, type Locator, type Page } from "@playwright/test";
import { EMAIL_ADMIN_PRUEBAS, USUARIOS } from "../../db/datos/semilla.mts";

/**
 * La bandeja de salida, de punta a punta.
 *
 * Un cambio que provoca un correo —restablecer una contrasena— tiene que dejar
 * el mensaje en la bandeja, sin la contrasena dentro, y el administrador tiene
 * que poder abrirlo y anotarlo como entregado.
 *
 * Todo se hace sobre `pruebas@conejo.test`, la cuenta de la semilla reservada
 * para esto: nadie inicia sesion con ella.
 */

const DESTINATARIO = "pruebas@conejo.test";

function administrador() {
  const admin = USUARIOS.find(
    (u) => u.email === EMAIL_ADMIN_PRUEBAS,
  );
  if (!admin) throw new Error("La semilla no trae ningun administrador");
  return admin;
}

/** El listado pinta cada fila dos veces, como tabla y como tarjeta. */
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
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 90_000 });
}

test("restablecer una contrasena deja su correo en la bandeja, y se puede entregar a mano", async ({ page }) => {
  const admin = administrador();
  await entrar(page, admin.email, admin.password);

  await page.goto(`/dashboard/usuarios?busqueda=${encodeURIComponent(DESTINATARIO)}`);
  await visible(page.getByRole("link", { name: /^Restablecer la contrasena de/ })).click();
  await page.getByRole("button", { name: "Restablecer contrasena" }).click({ timeout: 30_000 });

  // La contrasena provisional se muestra aqui, y solo aqui: en mano.
  await expect(page.getByText(DESTINATARIO).locator("visible=true").first()).toBeVisible({
    timeout: 30_000,
  });

  await page.goto(`/dashboard/salida?busqueda=${encodeURIComponent(DESTINATARIO)}`);

  await expect(
    visible(page.getByText("Tu contrasena de Conejo App se restablecio")),
  ).toBeVisible();

  await visible(page.getByRole("link", { name: /^Abrir el correo para/ })).click();

  const panel = page.getByRole("complementary", { name: /Pruebas Automaticas/ });
  await expect(panel).toBeVisible({ timeout: 30_000 });
  await expect(panel.getByText("modo simulado")).toBeVisible();
  await expect(panel.getByText("Un administrador restablecio la contrasena")).toBeVisible();

  // El correo avisa; no entrega la contrasena.
  await expect(panel.getByText("te la entrega esa persona")).toBeVisible();

  await panel.getByRole("button", { name: "Ya lo entregue" }).click();
  await expect(page.getByText("Queda anotado como entregado a mano").first()).toBeVisible({
    timeout: 30_000,
  });

  // Se comprueba sobre ESTE correo y no sobre la lista de pendientes: una
  // pasada anterior que fallara a medias deja el suyo sin entregar, y eso no
  // dice nada de si este se anoto bien.
  await expect(panel.getByText("Entregado a mano")).toBeVisible({ timeout: 30_000 });
  await expect(panel.getByRole("button", { name: "Ya lo entregue" })).toHaveCount(0);
});

test("quien no es administrador no entra a la bandeja de salida", async ({ page }) => {
  const redes = USUARIOS.find((u) => u.email === "redes@conejo.test");
  if (!redes) throw new Error("La semilla no trae la cuenta de redes");

  await entrar(page, redes.email, redes.password);

  await page.goto("/dashboard/salida");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("link", { name: "Bandeja de salida" })).toHaveCount(0);
});
