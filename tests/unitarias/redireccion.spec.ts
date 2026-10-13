import { expect, test } from "@playwright/test";
import { destinoSeguro } from "@/lib/redireccion";

/**
 * El destino tras iniciar sesion nunca puede salir del panel.
 *
 * Cada caso de `FUERA` es una forma conocida de colar otro dominio en un valor
 * que a simple vista parece una ruta interna.
 */

const FUERA: [nombre: string, valor: unknown][] = [
  ["protocolo relativo", "//sitio.com"],
  ["tabulador entre las barras", "/\t/sitio.com"],
  ["salto de linea entre las barras", "/\n/sitio.com"],
  ["retorno de carro entre las barras", "/\r/sitio.com"],
  ["barra invertida", "/\\sitio.com"],
  ["barra invertida tras la ruta", "/\\/sitio.com"],
  ["URL absoluta", "https://sitio.com/dashboard"],
  ["esquema javascript", "javascript:alert(1)"],
  ["ruta relativa", "dashboard"],
  ["ruta interna fuera del panel", "/login"],
  ["prefijo que solo se parece", "/dashboardfalso"],
  ["subir desde el panel", "/dashboard/../login"],
  ["cadena vacia", ""],
  ["no es texto", null],
  ["varios valores", ["/dashboard", "//sitio.com"]],
];

for (const [nombre, valor] of FUERA) {
  test(`rechaza: ${nombre}`, () => {
    expect(destinoSeguro(valor)).toBe("/dashboard");
  });
}

test("conserva una ruta del panel", () => {
  expect(destinoSeguro("/dashboard/hooks/historial")).toBe(
    "/dashboard/hooks/historial",
  );
});

test("conserva la busqueda de la ruta", () => {
  expect(destinoSeguro("/dashboard/usuarios?pagina=2")).toBe(
    "/dashboard/usuarios?pagina=2",
  );
});

test("una arroba en la ruta no cambia de dominio", () => {
  expect(destinoSeguro("/dashboard/@sitio.com")).toBe("/dashboard/@sitio.com");
});
