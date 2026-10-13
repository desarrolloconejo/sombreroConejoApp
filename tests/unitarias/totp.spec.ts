import { expect, test } from "@playwright/test";
import {
  aBase32,
  codigoDelPaso,
  codigoEn,
  deBase32,
  enlaceDeRegistro,
  generarCodigoDeRespaldo,
  generarSecreto,
  normalizarCodigoDeRespaldo,
  pasoDe,
  verificarCodigo,
} from "@/lib/totp";

/**
 * Los codigos de la verificacion en dos pasos.
 *
 * Lo primero que se comprueba es que salen los MISMOS codigos que en
 * cualquier app: los valores de referencia son los del propio estandar
 * (RFC 6238, apendice B). Si eso se rompe, nadie podria entrar.
 */

/** El secreto de los ejemplos del estandar: "12345678901234567890". */
const SECRETO_RFC = aBase32(Buffer.from("12345678901234567890"));

test("da los codigos de referencia del estandar", () => {
  // Segundos desde 1970 y el codigo de 8 digitos del RFC; aqui son 6, que son
  // sus seis ultimos.
  const casos: [segundos: number, codigo: string][] = [
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
    [20000000000, "353130"],
  ];

  for (const [segundos, codigo] of casos) {
    expect(codigoEn(SECRETO_RFC, segundos * 1000), String(segundos)).toBe(codigo);
  }
});

test("Base32 va y vuelve sin perder nada", () => {
  const bytes = Buffer.from("12345678901234567890");

  expect(aBase32(bytes)).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  expect(deBase32(aBase32(bytes))?.equals(bytes)).toBe(true);

  // Como lo escribiria una persona: en grupos, en minusculas.
  expect(deBase32("gezd gnbv gy3t qojq gezd gnbv gy3t qojq")?.equals(bytes)).toBe(true);
});

test("lo que no es Base32 no se decodifica", () => {
  for (const malo of ["", "   ", "ABC1", "hola!", "A1B0C8"]) {
    expect(deBase32(malo), malo).toBeNull();
  }
});

test("un secreto nuevo tiene 160 bits y no se repite", () => {
  const uno = generarSecreto();
  const otro = generarSecreto();

  expect(uno).toMatch(/^[A-Z2-7]{32}$/);
  expect(deBase32(uno)?.length).toBe(20);
  expect(uno).not.toBe(otro);
});

test("acepta el codigo del momento y devuelve su paso", () => {
  const ahora = 1_800_000_000_000;
  const codigo = codigoEn(SECRETO_RFC, ahora)!;

  expect(verificarCodigo(SECRETO_RFC, codigo, ahora)).toBe(pasoDe(ahora));
});

test("tolera un paso de desfase, pero no dos", () => {
  const ahora = 1_800_000_000_000;
  const paso = pasoDe(ahora);

  expect(verificarCodigo(SECRETO_RFC, codigoDelPaso(SECRETO_RFC, paso - 1)!, ahora)).toBe(paso - 1);
  expect(verificarCodigo(SECRETO_RFC, codigoDelPaso(SECRETO_RFC, paso + 1)!, ahora)).toBe(paso + 1);
  expect(verificarCodigo(SECRETO_RFC, codigoDelPaso(SECRETO_RFC, paso - 2)!, ahora)).toBeNull();
  expect(verificarCodigo(SECRETO_RFC, codigoDelPaso(SECRETO_RFC, paso + 2)!, ahora)).toBeNull();
});

test("un codigo no vale dos veces", () => {
  const ahora = 1_800_000_000_000;
  const codigo = codigoEn(SECRETO_RFC, ahora)!;

  const paso = verificarCodigo(SECRETO_RFC, codigo, ahora);
  expect(paso).not.toBeNull();

  // El mismo codigo, un instante despues y dentro de su ventana.
  expect(verificarCodigo(SECRETO_RFC, codigo, ahora + 5000, paso)).toBeNull();

  // Ni uno anterior al ultimo aceptado, aunque siga dentro de la tolerancia.
  const anterior = codigoDelPaso(SECRETO_RFC, paso! - 1)!;
  expect(verificarCodigo(SECRETO_RFC, anterior, ahora, paso)).toBeNull();

  // El siguiente si.
  const siguiente = codigoDelPaso(SECRETO_RFC, paso! + 1)!;
  expect(verificarCodigo(SECRETO_RFC, siguiente, ahora, paso)).toBe(paso! + 1);
});

test("rechaza un codigo equivocado, incompleto o que no es un numero", () => {
  const ahora = 1_800_000_000_000;
  const bueno = codigoEn(SECRETO_RFC, ahora)!;
  const malo = bueno === "000000" ? "000001" : "000000";

  for (const codigo of [malo, bueno.slice(0, 5), `${bueno}1`, "abcdef", "", "12 34"]) {
    expect(verificarCodigo(SECRETO_RFC, codigo, ahora), codigo).toBeNull();
  }
});

test("acepta el codigo aunque venga con espacios, como lo muestra la app", () => {
  const ahora = 1_800_000_000_000;
  const codigo = codigoEn(SECRETO_RFC, ahora)!;

  expect(verificarCodigo(SECRETO_RFC, `${codigo.slice(0, 3)} ${codigo.slice(3)}`, ahora)).toBe(
    pasoDe(ahora),
  );
});

test("con otro secreto, el codigo no sirve", () => {
  const ahora = 1_800_000_000_000;

  expect(verificarCodigo(generarSecreto(), codigoEn(SECRETO_RFC, ahora)!, ahora)).toBeNull();
});

test("el enlace de registro lleva lo que la app necesita", () => {
  const enlace = new URL(enlaceDeRegistro(SECRETO_RFC, "carla@conejo.test", "Conejo App"));

  expect(enlace.protocol).toBe("otpauth:");
  expect(decodeURIComponent(enlace.pathname)).toContain("Conejo App:carla@conejo.test");
  expect(enlace.searchParams.get("secret")).toBe(SECRETO_RFC);
  expect(enlace.searchParams.get("issuer")).toBe("Conejo App");
  expect(enlace.searchParams.get("digits")).toBe("6");
  expect(enlace.searchParams.get("period")).toBe("30");
});

test("los codigos de respaldo se reconocen los escriban como los escriban", () => {
  const codigo = generarCodigoDeRespaldo();

  expect(codigo).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
  expect(normalizarCodigoDeRespaldo(codigo)).toBe(codigo);
  expect(normalizarCodigoDeRespaldo(codigo.toLowerCase().replace("-", " "))).toBe(codigo);
  expect(normalizarCodigoDeRespaldo(codigo.replace("-", ""))).toBe(codigo);
});

test("lo que no es un codigo de respaldo no pasa", () => {
  for (const malo of ["", "ABCDE", "ABCDE-FGHJ", "ABCDE-FGHJK-M", "ABCD0-FGHJK", "123456"]) {
    expect(normalizarCodigoDeRespaldo(malo), malo).toBeNull();
  }
});
