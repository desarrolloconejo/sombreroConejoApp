import { expect, test } from "@playwright/test";
import { validarPassword } from "@/lib/validaciones";

/**
 * El limite de bcrypt es de 72 bytes, no de 72 caracteres.
 *
 * Lo que pase de ahi se ignora al calcular el hash, asi que una contrasena
 * mas larga se rechaza en vez de aceptarse a medias.
 */

test("72 caracteres de un byte caben justos", () => {
  expect(validarPassword(`Aa1${"x".repeat(69)}`)).toBeNull();
});

test("73 caracteres de un byte ya no caben", () => {
  expect(validarPassword(`Aa1${"x".repeat(70)}`)).toBe(
    "La contrasena es demasiado larga",
  );
});

test("menos de 72 caracteres pueden pasar de 72 bytes", () => {
  // 3 + 35 letras de dos bytes: 38 caracteres, 73 bytes.
  expect(validarPassword(`Aa1${"ñ".repeat(35)}`)).toBe(
    "La contrasena es demasiado larga",
  );
});
