import type { Locator, Page } from "@playwright/test";

/** La empresa de ejemplo de la semilla, la que tiene clientes y proyectos. */
export const EMPRESA_SEMILLA = "Distribuidora Ejemplo, C.A.";

/**
 * Elige la empresa de la semilla en un formulario de alta. No se puede contar
 * con que venga elegida: las pruebas de briefs convierten prospectos en
 * empresas nuevas, asignadas al mismo ejecutivo.
 */
export async function elegirEmpresa(page: Page) {
  await page.getByRole("combobox", { name: "Empresa" }).click();
  await page.getByRole("option", { name: EMPRESA_SEMILLA }).click();
}

/**
 * Elige una opcion de un Selector: el desplegable de la casa no es un
 * <select>, asi que no vale selectOption. Se abre por su nombre y se pulsa
 * la opcion. `donde` acota la busqueda a un formulario si hay varios iguales.
 */
export async function elegirOpcion(
  page: Page,
  nombre: string,
  opcion: string | RegExp,
  donde: Page | Locator = page,
) {
  await donde.getByRole("combobox", { name: nombre, exact: true }).click();
  // La lista se pinta en el <body>, fuera de `donde`.
  await page.getByRole("option", { name: opcion }).first().click();
}
