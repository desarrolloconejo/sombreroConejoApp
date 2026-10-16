import { expect, test } from "@playwright/test";
import {
  acotar,
  dentroDe,
  diaDeSemana,
  escribirFecha,
  leerFecha,
  semanasDelMes,
  sumarDias,
  sumarMeses,
} from "@/lib/calendario";

test("lee la fecha escrita a la venezolana y en ISO", () => {
  expect(leerFecha("14/11/2026")).toBe("2026-11-14");
  expect(leerFecha(" 4/1/2027 ")).toBe("2027-01-04");
  expect(leerFecha("14-11-2026")).toBe("2026-11-14");
  expect(leerFecha("2026-11-14")).toBe("2026-11-14");
  expect(escribirFecha("2027-01-04")).toBe("04/01/2027");
});

test("rechaza lo que no es un dia que exista", () => {
  expect(leerFecha("31/02/2026")).toBeNull();
  expect(leerFecha("2026-13-01")).toBeNull();
  expect(leerFecha("29/02/2026")).toBeNull();
  expect(leerFecha("29/02/2028")).toBe("2028-02-29");
  expect(leerFecha("mañana")).toBeNull();
  expect(leerFecha("")).toBeNull();
  expect(escribirFecha("")).toBe("");
});

test("las semanas empiezan en lunes y completan el mes", () => {
  // Noviembre de 2026 empieza en domingo: la primera semana trae seis dias de octubre.
  const noviembre = semanasDelMes(2026, 11);
  expect(noviembre[0][0]).toBe("2026-10-26");
  expect(noviembre[0][6]).toBe("2026-11-01");
  expect(noviembre.every((semana) => semana.length === 7)).toBe(true);
  expect(noviembre.flat()).toContain("2026-11-30");
  expect(noviembre).toHaveLength(6);

  // Febrero de 2021 empieza en lunes y tiene 28 dias: cuatro semanas justas.
  expect(semanasDelMes(2021, 2)).toHaveLength(4);
  expect(diaDeSemana("2026-11-16")).toBe(0);
  expect(diaDeSemana("2026-11-15")).toBe(6);
});

test("sumar dias y meses cruza meses, anos y bisiestos", () => {
  expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
  expect(sumarDias("2028-03-01", -1)).toBe("2028-02-29");
  expect(sumarMeses("2026-01-31", 1)).toBe("2026-02-28");
  expect(sumarMeses("2026-01-15", -1)).toBe("2025-12-15");
});

test("los limites dejan fuera lo anterior al minimo y lo posterior al maximo", () => {
  expect(dentroDe("2026-11-14", "2026-11-14")).toBe(true);
  expect(dentroDe("2026-11-13", "2026-11-14")).toBe(false);
  expect(dentroDe("2026-11-15", undefined, "2026-11-14")).toBe(false);
  expect(acotar("2026-01-01", "2026-11-14")).toBe("2026-11-14");
  expect(acotar("2030-01-01", undefined, "2026-11-14")).toBe("2026-11-14");
});
