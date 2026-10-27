import { expect, test } from "@playwright/test";
import {
  correoDeClaveCambiada,
  correoDeRecuperarClave,
  MARCADOR_ENLACE,
} from "@/lib/correos/plantillas";
import { enlaceParaToken, hashDeToken, nuevoToken, pareceToken } from "@/lib/recuperarClave";

/**
 * «Olvide mi contrasena»: el token del enlace y lo que dicen sus correos.
 * Lo que se guarda (el hash, la bandeja) nunca permite usar el enlace.
 */

const PERSONA = { id: 7, nombre: "Ana", email: "ana@ejemplo.test", empresaId: null };

test("cada token es distinto, con forma fija, y se guarda su hash", () => {
  const uno = nuevoToken();
  const otro = nuevoToken();

  expect(uno.token).not.toBe(otro.token);
  expect(pareceToken(uno.token)).toBe(true);
  expect(uno.hash).toMatch(/^[0-9a-f]{64}$/);
  expect(uno.hash).toBe(hashDeToken(uno.token));
  expect(uno.hash).not.toContain(uno.token);
});

test("lo que no tiene forma de token no se consulta", () => {
  expect(pareceToken("")).toBe(false);
  expect(pareceToken("corto")).toBe(false);
  expect(pareceToken("' OR 1=1 --".padEnd(43, "x"))).toBe(false);
  expect(pareceToken(undefined)).toBe(false);
});

test("el enlace sale de APP_URL_PUBLICA, y sin ella no hay enlace", () => {
  const antes = process.env.APP_URL_PUBLICA;
  try {
    process.env.APP_URL_PUBLICA = "https://app.ejemplo.test/";
    expect(enlaceParaToken("abc")).toBe("https://app.ejemplo.test/recuperar/nueva?token=abc");
    delete process.env.APP_URL_PUBLICA;
    expect(enlaceParaToken("abc")).toBeNull();
  } finally {
    if (antes === undefined) delete process.env.APP_URL_PUBLICA;
    else process.env.APP_URL_PUBLICA = antes;
  }
});

test("el correo del enlace guarda el marcador, nunca el enlace", () => {
  const correo = correoDeRecuperarClave(PERSONA, 30);

  expect(correo.tipo).toBe("clave_recuperar");
  expect(correo.cuerpo).toContain(MARCADOR_ENLACE);
  expect(correo.cuerpo).not.toMatch(/token=/);
  expect(correo.cuerpo).toContain("30 minutos");
});

test("el aviso de contrasena cambiada no lleva nada privado", () => {
  const correo = correoDeClaveCambiada(PERSONA, "perfil", "27 de octubre de 2026");

  expect(correo.tipo).toBe("clave_cambiada");
  expect(correo.cuerpo).toContain("27 de octubre de 2026");
  expect(correo.cuerpo).not.toContain(MARCADOR_ENLACE);
  expect(correo.cuerpo).not.toMatch(/token=/);
});
