import { expect, test } from "@playwright/test";
import {
  aEscalado,
  cantidadValida,
  deEscalado,
  importesDe,
  normalizarDecimal,
  precioValido,
  subtotalDe,
} from "@/lib/finanzas/calculo";
import { dolares, numeroDe, situacionDe, sumarDias, sumarUnMes } from "@/lib/finanzas/documentos";

/**
 * El calculo de presupuestos y proformas (seccion 7.5 del plan).
 *
 * Es la vista previa del editor: tiene que dar EXACTAMENTE lo mismo que
 * `finanzas.guardar_renglones` en la base. La bateria de permisos compara las
 * dos con los mismos renglones; aqui se fijan los casos de la regla.
 */

const r = (cantidad: string, precioUnitario: string, exento = false) => ({
  descripcion: "x",
  cantidad,
  precioUnitario,
  exento,
});

test.describe("subtotal de un renglon", () => {
  test("cantidad por precio, a dos decimales", () => {
    expect(subtotalDe("1", "100")).toBe("100.00");
    expect(subtotalDe("3", "33.33")).toBe("99.99");
    expect(subtotalDe("2.5", "10")).toBe("25.00");
  });

  test("redondea mitad hacia arriba sobre el renglon", () => {
    // 1.005 x 1.00 = 1.005 -> 1.01
    expect(subtotalDe("1.005", "1")).toBe("1.01");
    // 0.333 x 0.10 = 0.0333 -> 0.03
    expect(subtotalDe("0.333", "0.10")).toBe("0.03");
    // 0.125 x 0.20 = 0.025 -> 0.03
    expect(subtotalDe("0.125", "0.2")).toBe("0.03");
  });

  test("lo que no es un numero valido no tiene subtotal", () => {
    expect(subtotalDe("", "10")).toBeNull();
    expect(subtotalDe("0", "10")).toBeNull();
    expect(subtotalDe("1", "10.555")).toBeNull();
    expect(subtotalDe("1.0005", "10")).toBeNull();
    expect(subtotalDe("-1", "10")).toBeNull();
    expect(subtotalDe("1e3", "10")).toBeNull();
  });

  test("acepta la coma decimal", () => {
    expect(subtotalDe("2,5", "10,50")).toBe("26.25");
  });
});

test.describe("importes del documento", () => {
  test("el ejemplo de la especificacion: base 100, IVA 16, total 116", () => {
    expect(importesDe([r("1", "100")])).toEqual({
      baseImponible: "100.00",
      montoExento: "0.00",
      ivaPct: "16.00",
      ivaMonto: "16.00",
      total: "116.00",
    });
  });

  test("lo exento no paga IVA y suma aparte", () => {
    expect(importesDe([r("1", "100"), r("2", "25", true)])).toEqual({
      baseImponible: "100.00",
      montoExento: "50.00",
      ivaPct: "16.00",
      ivaMonto: "16.00",
      total: "166.00",
    });
  });

  test("el IVA se redondea una vez, sobre la base, no renglon a renglon", () => {
    // Tres renglones de 0.03: IVA por renglon seria 0.0048 -> 0.00 cada uno,
    // y sumaria 0.00. Sobre la base (0.09) es 0.0144 -> 0.01.
    const importes = importesDe([r("1", "0.03"), r("1", "0.03"), r("1", "0.03")]);
    expect(importes.baseImponible).toBe("0.09");
    expect(importes.ivaMonto).toBe("0.01");
    expect(importes.total).toBe("0.10");
  });

  test("redondea el IVA mitad hacia arriba", () => {
    // 2.03 x 16 % = 0.3248 -> 0.32; 2.04 x 16 % = 0.3264 -> 0.33.
    expect(importesDe([r("1", "2.03")]).ivaMonto).toBe("0.32");
    expect(importesDe([r("1", "2.04")]).ivaMonto).toBe("0.33");
    // La mitad exacta sube: 0.50 x 1 % = 0.005 -> 0.01.
    expect(importesDe([r("1", "0.50")], "1").ivaMonto).toBe("0.01");
  });

  test("un renglon invalido no suma", () => {
    expect(importesDe([r("1", "10"), r("", "99")]).total).toBe("11.60");
  });

  test("sin renglones, todo en cero", () => {
    expect(importesDe([]).total).toBe("0.00");
  });

  test("importes grandes no pierden centimos", () => {
    // Con number, 0.1 + 0.2 no es 0.3; con enteros escalados si.
    expect(importesDe([r("1", "0.10"), r("1", "0.20")]).baseImponible).toBe("0.30");
    expect(importesDe([r("999999.999", "999999.99")]).baseImponible).toBe("999999989000.00");
  });
});

test.describe("conversiones", () => {
  test("escala y desescala", () => {
    expect(aEscalado("12.5", 2)).toBe(BigInt(1250));
    expect(deEscalado(BigInt(1250), 2)).toBe("12.50");
    expect(deEscalado(BigInt(5), 2)).toBe("0.05");
    expect(normalizarDecimal("7", 3)).toBe("7.000");
    expect(normalizarDecimal("7,25", 2)).toBe("7.25");
  });

  test("valida cantidades y precios", () => {
    expect(cantidadValida("0.001")).toBe(true);
    expect(cantidadValida("0")).toBe(false);
    expect(precioValido("0")).toBe(true);
    expect(precioValido("1.234")).toBe(false);
  });
});

test.describe("presentacion", () => {
  test("numera los documentos", () => {
    expect(numeroDe("presupuesto", 12)).toBe("PRE-000012");
    expect(numeroDe("proforma", 1234567)).toBe("PRF-1234567");
  });

  test("un enviado vencido se lee como vencido; lo demas, como esta", () => {
    expect(situacionDe("enviado", true)).toBe("vencido");
    expect(situacionDe("enviado", false)).toBe("enviado");
    expect(situacionDe("aprobado", true)).toBe("aprobado");
  });

  test("suma dias sin depender de la zona horaria", () => {
    expect(sumarDias("2026-10-20", 15)).toBe("2026-11-04");
    expect(sumarDias("2026-12-25", 15)).toBe("2027-01-09");
  });

  test("avanza un mes como la base, sin saltar de mes", () => {
    expect(sumarUnMes("2026-01-15")).toBe("2026-02-15");
    expect(sumarUnMes("2026-01-31")).toBe("2026-02-28");
    expect(sumarUnMes("2028-01-31")).toBe("2028-02-29");
    expect(sumarUnMes("2026-12-10")).toBe("2027-01-10");
  });

  test("muestra dolares con separadores de aqui", () => {
    expect(dolares("1234.5")).toBe("$1.234,50");
    expect(dolares("116.00")).toBe("$116,00");
    expect(dolares("1234567.89")).toBe("$1.234.567,89");
  });
});
