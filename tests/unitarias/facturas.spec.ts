import { expect, test } from "@playwright/test";
import {
  leerAjustes,
  leerFormato,
  leerMedio,
  leerNumeracion,
  leerPorcentaje,
  quedaPocoTalonario,
  rifValido,
} from "@/lib/finanzas/ajustes";
import { bolivares, fechaImpresa, numeroFactura, tasaLegible } from "@/lib/finanzas/documentos";
import { pdfDeCalibracion, pdfDeFactura, textosDeFactura } from "@/lib/finanzas/pdfFactura";
import type { Factura, FormatoImpresion } from "@/types";

/**
 * Lo puro de la etapa 7: como se leen los ajustes, como se escribe cada dato
 * de la factura en el talonario y que el PDF sale.
 */

function formulario(valores: Record<string, string | string[]>): FormData {
  const datos = new FormData();
  for (const [clave, valor] of Object.entries(valores)) {
    for (const uno of Array.isArray(valor) ? valor : [valor]) datos.append(clave, uno);
  }
  return datos;
}

const FORMATO: FormatoImpresion = {
  id: 1,
  nombre: "Carta (ejemplo)",
  anchoMm: "215.9",
  altoMm: "279.4",
  fuentePt: "9",
  campos: {
    numero: { x: 150, y: 20, ancho: 50 },
    total: { x: 165, y: 179, ancho: 35, alinear: "derecha" },
    razonSocial: { x: 30, y: 42, ancho: 115 },
  },
  renglones: {
    y_inicio: 70,
    alto_mm: 6,
    max: 14,
    columnas: {
      cantidad: { x: 12, ancho: 14, alinear: "derecha" },
      descripcion: { x: 30, ancho: 100 },
    },
  },
  habitual: true,
  activo: true,
};

const FACTURA = {
  serie: "A",
  numero: 12,
  fechaEmision: "2026-10-15",
  venceEl: "2026-10-30",
  tasa: "40.50000000",
  tasaFecha: "2026-10-15",
  totalUsd: "580.00",
  baseImponible: "20250.00",
  montoExento: "0.00",
  ivaPct: "16.00",
  ivaMonto: "3240.00",
  total: "23490.00",
  estado: "emitida",
  cliente: { razonSocial: "Distribuidora Ejemplo, C.A.", rif: "J-30123456-7", domicilio: "Caracas" },
  emisor: { razonSocial: "Agencia de Ejemplo, C.A.", rif: "J-00000000-0", domicilio: "Caracas" },
} as unknown as Factura;

test("los importes y numeros de la factura se escriben como en Venezuela", () => {
  expect(bolivares("1234567.5")).toBe("Bs. 1.234.567,50");
  expect(numeroFactura("A", 12)).toBe("A-000012");
  expect(tasaLegible("40.50000000")).toBe("40,50");
  expect(tasaLegible("1234.56780000")).toBe("1.234,5678");
  expect(fechaImpresa("2026-10-05")).toBe("05/10/2026");
});

test("cada dato del talonario sale de la factura congelada", () => {
  const textos = textosDeFactura(FACTURA);
  expect(textos.numero).toBe("A-000012");
  expect(textos.total).toBe("Bs. 23.490,00");
  expect(textos.ivaPct).toBe("16 %");
  expect(textos.tasa).toBe("Tasa BCV 40,50 Bs/USD del 15/10/2026");
  expect(textos.referenciaUsd).toBe("Referencia: $580,00");
  expect(textos.razonSocial).toBe("Distribuidora Ejemplo, C.A.");
});

test("el PDF de la factura y el de calibracion salen, aun con texto que la fuente no sabe", async () => {
  const factura = await pdfDeFactura(
    FACTURA,
    [{ orden: 1, descripcion: "Diseño «premium» 🎨 con emoji", cantidad: "2.500", precioUnitario: "100.00", exento: false, subtotal: "250.00" }],
    FORMATO,
  );
  expect(Buffer.from(factura.subarray(0, 4)).toString()).toBe("%PDF");

  const calibracion = await pdfDeCalibracion(FORMATO);
  expect(Buffer.from(calibracion.subarray(0, 4)).toString()).toBe("%PDF");
});

test("los ajustes: RIF, porcentajes y dias", () => {
  expect(rifValido("J-12345678-9")).toBe(true);
  expect(rifValido("12345678")).toBe(false);
  expect(leerPorcentaje("16")).toBe("16.00");
  expect(leerPorcentaje("16,5")).toBe("16.50");
  expect(leerPorcentaje("100.01")).toBeNull();
  expect(leerPorcentaje("abc")).toBeNull();

  const bien = leerAjustes(
    formulario({ emisorRif: "j-12345678-9", ivaPct: "16", islrPct: "5", igtfPct: "3", diasCredito: "15", islrActivo: "si" }),
  );
  expect(bien.errores).toEqual({});
  expect(bien.ajustes.emisorRif).toBe("J-12345678-9");
  expect(bien.ajustes.islrActivo).toBe(true);
  expect(bien.ajustes.igtfActivo).toBe(false);

  const mal = leerAjustes(formulario({ emisorRif: "x", ivaPct: "200", islrPct: "5", igtfPct: "3", diasCredito: "400" }));
  expect(Object.keys(mal.errores).sort()).toEqual(["diasCredito", "emisorRif", "ivaPct"]);
});

test("la numeracion: el rango no termina antes del proximo, y avisa al acabarse", () => {
  const bien = leerNumeracion(
    formulario({ serie: "a", proximaFactura: "10", controlPrefijo: "00-", proximoControl: "5", controlHasta: "500" }),
  );
  expect(bien.errores).toEqual({});
  expect(bien.numeracion.serie).toBe("A");

  const mal = leerNumeracion(
    formulario({ serie: "A1", proximaFactura: "0", controlPrefijo: "00-", proximoControl: "50", controlHasta: "10" }),
  );
  expect(Object.keys(mal.errores).sort()).toEqual(["controlHasta", "proximaFactura", "serie"]);

  expect(quedaPocoTalonario({ ...bien.numeracion, proximoControl: 490, controlHasta: 500 })).toBe(11);
  expect(quedaPocoTalonario({ ...bien.numeracion, proximoControl: 501, controlHasta: 500 })).toBe(0);
  expect(quedaPocoTalonario({ ...bien.numeracion, proximoControl: 5, controlHasta: 500 })).toBeNull();
});

test("un medio de pago necesita nombre y alguna moneda conocida", () => {
  const bien = leerMedio(formulario({ nombre: "Zelle", monedas: ["USD", "USD", "EUR"], orden: "3", activo: "si" }));
  expect(bien.errores).toEqual({});
  expect(bien.medio.monedas).toEqual(["USD"]);

  const mal = leerMedio(formulario({ nombre: " ", monedas: ["EUR"] }));
  expect(Object.keys(mal.errores).sort()).toEqual(["monedas", "nombre"]);
});

test("un formato rechaza lo que no cabe en la hoja", () => {
  const base = {
    nombre: "Media carta",
    anchoMm: "215.9",
    altoMm: "139.7",
    fuentePt: "9",
    activo: "si",
    c_numero_usar: "si",
    c_numero_x: "150",
    c_numero_y: "20",
    c_numero_ancho: "50",
    r_y_inicio: "62",
    r_alto_mm: "5.5",
    r_max: "7",
    k_cantidad_x: "12",
    k_cantidad_ancho: "14",
    k_descripcion_x: "30",
    k_descripcion_ancho: "100",
    k_precio_x: "132",
    k_precio_ancho: "30",
    k_subtotal_x: "165",
    k_subtotal_ancho: "35",
  };
  const bien = leerFormato(formulario(base));
  expect(bien.errores).toEqual({});
  expect(bien.formato.campos.numero).toEqual({ x: 150, y: 20, ancho: 50 });
  expect(bien.formato.campos.total).toBeUndefined();

  const mal = leerFormato(formulario({ ...base, c_numero_x: "200", r_max: "20" }));
  expect(mal.errores.c_numero).toBeDefined();
  expect(mal.errores.r_max).toBe("Tantos renglones no caben en la hoja");
});
