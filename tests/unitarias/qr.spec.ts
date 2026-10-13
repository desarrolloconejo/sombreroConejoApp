import { expect, test } from "@playwright/test";
import { dibujarQr } from "@/lib/qr";
import { enlaceDeRegistro } from "@/lib/totp";

/**
 * El dibujo del codigo QR.
 *
 * No se puede comprobar aqui que un telefono lo lea: eso lo dice un telefono.
 * Lo que si se fija es su estructura —que tenga las tres marcas de esquina
 * que todo QR lleva— y que el dibujo no se salga de su cuadro.
 */

const ENLACE = enlaceDeRegistro(
  "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
  "carla@conejo.test",
  "Conejo App",
);

/** Reconstruye, a partir del trazo, que modulos quedan oscuros. */
function oscuros(trazo: string, lado: number): boolean[][] {
  const rejilla = Array.from({ length: lado }, () => Array<boolean>(lado).fill(false));

  for (const [, x, y, largo] of trazo.matchAll(/M(\d+),(\d+)h(\d+)v1h-\d+z/g)) {
    for (let i = 0; i < Number(largo); i++) {
      rejilla[Number(y)][Number(x) + i] = true;
    }
  }

  return rejilla;
}

/** La marca de esquina de un QR: un cuadro de 7, un hueco y un cuadro de 3. */
const MARCA = [
  "#######",
  "#.....#",
  "#.###.#",
  "#.###.#",
  "#.###.#",
  "#.....#",
  "#######",
];

function marcaEn(rejilla: boolean[][], fila: number, columna: number): string[] {
  return MARCA.map((_, f) =>
    MARCA.map((__, c) => (rejilla[fila + f][columna + c] ? "#" : ".")).join(""),
  );
}

test("el codigo lleva sus tres marcas de esquina", () => {
  const { lado, trazo } = dibujarQr(ENLACE);
  const rejilla = oscuros(trazo, lado);

  expect(marcaEn(rejilla, 0, 0)).toEqual(MARCA);
  expect(marcaEn(rejilla, 0, lado - 7)).toEqual(MARCA);
  expect(marcaEn(rejilla, lado - 7, 0)).toEqual(MARCA);
});

test("el lado es el de un QR valido y el trazo no se sale de el", () => {
  const { lado, trazo } = dibujarQr(ENLACE);

  // Un QR mide 21 modulos mas 4 por cada version: 21, 25, 29...
  expect((lado - 21) % 4).toBe(0);
  expect(lado).toBeGreaterThanOrEqual(21);

  for (const [, x, y, largo] of trazo.matchAll(/M(\d+),(\d+)h(\d+)v1h-\d+z/g)) {
    expect(Number(y)).toBeLessThan(lado);
    expect(Number(x) + Number(largo)).toBeLessThanOrEqual(lado);
  }
});

test("el mismo texto da siempre el mismo dibujo, y otro texto da otro", () => {
  expect(dibujarQr(ENLACE)).toEqual(dibujarQr(ENLACE));
  expect(dibujarQr(ENLACE).trazo).not.toBe(dibujarQr(`${ENLACE}x`).trazo);
});

test("el trazo solo trae rectangulos: nada que un navegador pueda ejecutar", () => {
  expect(dibujarQr(ENLACE).trazo).toMatch(/^(M\d+,\d+h\d+v1h-\d+z)+$/);
});
