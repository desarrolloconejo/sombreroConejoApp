import { expect, test } from "@playwright/test";
import { auditar } from "@/lib/hooks/auditor";

/**
 * Las reglas del auditor que no se pueden romper sin darse cuenta.
 *
 * La tabla completa de casos vive en db/pruebas/auditor.mts. Aqui se fijan las
 * dos que sostienen todo lo demas, para que fallen tambien en esta bateria.
 */

test("un fallo duro tapa la nota en 69 aunque el resto sume", () => {
  const resultado = auditar({
    hablado: "Hola chicos, hoy te cuento por que 3 de cada 4 cocinas fallan",
    insertTitulo: "El fallo del 75%",
  });

  expect(resultado.nota).toBeLessThanOrEqual(69);
  expect(resultado.aprobado).toBe(false);
});

test("un hook de menos de cuatro palabras no pasa de 25", () => {
  const resultado = auditar({ hablado: "Mira esto ya" });

  expect(resultado.nota).toBeLessThanOrEqual(25);
  expect(resultado.veredicto).toBe("descartar");
});

test("sin texto no hay nada que auditar", () => {
  const resultado = auditar({ hablado: "   " });

  expect(resultado.nota).toBe(0);
  expect(resultado.controles).toHaveLength(1);
});
