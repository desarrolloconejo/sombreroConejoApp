import type { Page } from "@playwright/test";

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
