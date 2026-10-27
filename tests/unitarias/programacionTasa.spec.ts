import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { CRON_TASA, proximaCorrida, situacionTasa } from "@/lib/finanzas/programacionTasa";
import type { LecturaTasa } from "@/types";

/**
 * Lo que se le dice a quien opera finanzas sobre la tarea diaria de la tasa:
 * si la app ya lo hizo hoy, como le fue, cuando vuelve y si toca a mano.
 *
 * Las horas van en UTC. La tarea corre a las 22:30 UTC, las 18:30 de Caracas.
 */

const lectura = (leidaEn: string, resto: Partial<LecturaTasa> = {}): LecturaTasa => ({
  id: 1,
  leidaEn: new Date(leidaEn),
  resultado: "registrada",
  fechaValor: "2026-10-28",
  motivo: null,
  ...resto,
});

test("la programacion coincide con la de vercel.json", () => {
  const vercel = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8"));
  const tarea = vercel.crons.find((cron: { path: string }) => cron.path === "/api/cron/tasa");
  expect(tarea?.schedule).toBe(CRON_TASA);
});

test("la proxima corrida es hoy antes de la hora y manana despues", () => {
  expect(proximaCorrida(new Date("2026-10-27T15:00:00Z")).toISOString()).toBe("2026-10-27T22:30:00.000Z");
  expect(proximaCorrida(new Date("2026-10-27T22:30:00Z")).toISOString()).toBe("2026-10-28T22:30:00.000Z");
  expect(proximaCorrida(new Date("2026-10-27T23:10:00Z")).toISOString()).toBe("2026-10-28T22:30:00.000Z");
});

test("si ya registro la de hoy, no hay nada que hacer", () => {
  const s = situacionTasa([lectura("2026-10-27T22:31:00Z")], new Date("2026-10-27T23:00:00Z"));
  expect(s.tono).toBe("ok");
  expect(s.titulo).toContain("ya registro");
  expect(s.detalle).toContain("hoy a las");
  expect(s.proxima).toContain("manana");
});

test("si reviso y el BCV no publico una nueva, lo dice", () => {
  const s = situacionTasa(
    [lectura("2026-10-27T22:31:00Z", { resultado: "sin_novedad", fechaValor: "2026-10-27" })],
    new Date("2026-10-27T23:00:00Z"),
  );
  expect(s.tono).toBe("aviso");
  expect(s.detalle).toContain("27/10/2026");
});

test("si lo intento hoy y fallo, toca registrarla a mano", () => {
  const s = situacionTasa(
    [lectura("2026-10-27T22:31:00Z", { resultado: "rechazada", fechaValor: null, motivo: "El BCV no respondio" })],
    new Date("2026-10-27T23:00:00Z"),
  );
  expect(s.tono).toBe("manual");
  expect(s.detalle).toContain("El BCV no respondio");
});

test("antes de la hora dice que lo hara hoy", () => {
  // Ultima corrida: ayer por la tarde en Caracas.
  const s = situacionTasa([lectura("2026-10-26T22:31:00Z")], new Date("2026-10-27T15:00:00Z"));
  expect(s.tono).toBe("ok");
  expect(s.titulo).toContain("todavia no");
  expect(s.detalle).toContain("Lo hara hoy a las");
});

test("pasada la hora sin corrida de hoy, avisa de que algo fallo", () => {
  const s = situacionTasa([lectura("2026-10-26T22:31:00Z")], new Date("2026-10-27T23:30:00Z"));
  expect(s.tono).toBe("manual");
  expect(s.detalle).toContain("Vercel");
});

test("de noche en Caracas (ya manana en UTC) sigue contando el dia de aqui", () => {
  // 22:00 del 27 en Caracas, sin corrida ese dia: la tarea debia correr a las 18:30.
  const s = situacionTasa([lectura("2026-10-26T22:31:00Z")], new Date("2026-10-28T02:00:00Z"));
  expect(s.tono).toBe("manual");
  expect(proximaCorrida(new Date("2026-10-28T02:00:00Z")).toISOString()).toBe("2026-10-28T22:30:00.000Z");
});

test("una corrida posterior sin novedad no tapa la que registro hoy", () => {
  const s = situacionTasa(
    [
      lectura("2026-10-27T22:40:00Z", { resultado: "sin_novedad" }),
      lectura("2026-10-27T22:31:00Z"),
    ],
    new Date("2026-10-27T23:00:00Z"),
  );
  expect(s.tono).toBe("ok");
  expect(s.titulo).toContain("ya registro");
});

test("sin ninguna corrida, lo dice", () => {
  expect(situacionTasa([], new Date("2026-10-27T15:00:00Z")).tono).toBe("aviso");
  expect(situacionTasa([], new Date("2026-10-27T23:30:00Z")).tono).toBe("manual");
});
