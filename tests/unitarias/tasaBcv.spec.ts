import { expect, test } from "@playwright/test";
import {
  comoDecimal,
  comoFechaValor,
  leerTasasDeBcv,
  saltoIncreible,
} from "@/lib/finanzas/tasaBcv";

/**
 * La lectura de la pagina del BCV.
 *
 * Con lo que salga de aqui se emiten facturas, y la pagina no es nuestra:
 * puede cambiar sin avisar. Por eso lo que mas se prueba no es que lea bien,
 * sino que RECHACE todo lo que no tenga exactamente la forma esperada.
 */

/** Un bloque de moneda con la misma forma que el de la pagina real. */
function moneda(id: string, codigo: string, cifra: string): string {
  return `
    <div id="${id}" class="col-sm-12 col-xs-12 ">
      <div class="field-content">
        <div class="row recuadrotsmc">
          <div class="col-sm-6 col-xs-6">
            <img src="/sites/default/files/${id}.png" class="icono_bss_blanco1">
            <span> ${codigo}</span>
          </div>
          <div class="col-sm-6 col-xs-6 centrado textp">
            <strong class="strong-tb"> ${cifra}</strong>
          </div>
        </div>
      </div>
    </div>`;
}

function fecha(contenido: string): string {
  return `
    <div class="pull-right dinpro center">
      Fecha Valor:
      <span class="date-display-single" property="dc:date"
            datatype="xsd:dateTime" content="${contenido}">Martes, 13 Octubre 2026</span>
    </div>`;
}

const PAGINA =
  "<html><body>" +
  moneda("euro", "EUR", "982,00454402") +
  moneda("yuan", "CNY", "131,03154748") +
  moneda("dolar", "USD", "876,79760000") +
  fecha("2026-10-13T00:00:00-04:00") +
  "</body></html>";

test("lee la fecha valor y todas las monedas, con sus ocho decimales", () => {
  expect(leerTasasDeBcv(PAGINA)).toEqual({
    ok: true,
    lectura: {
      fuente: "bcv",
      fechaValor: "2026-10-13",
      tasas: [
        { moneda: "EUR", valor: "982.00454402" },
        { moneda: "CNY", valor: "131.03154748" },
        { moneda: "USD", valor: "876.79760000" },
      ],
    },
  });
});

test("sin el dolar, la pagina no se da por buena", () => {
  const sinDolar = PAGINA.replace(moneda("dolar", "USD", "876,79760000"), "");

  expect(leerTasasDeBcv(sinDolar)).toEqual({
    ok: false,
    motivo: "No se encontro la tasa de USD",
  });
});

test("sin fecha valor no hay lectura", () => {
  const sinFecha = PAGINA.replace(fecha("2026-10-13T00:00:00-04:00"), "");

  expect(leerTasasDeBcv(sinFecha).ok).toBe(false);
});

test("una cifra que no es un numero rechaza la lectura entera", () => {
  const rota = PAGINA.replace("876,79760000", "876,79,76");

  expect(leerTasasDeBcv(rota)).toEqual({
    ok: false,
    motivo: "La cifra de USD no es un numero valido",
  });
});

test("un bloque sin su cifra no se queda con la del siguiente", () => {
  // Al euro se le quita la cifra. Sin la cota de longitud del lector, su
  // bloque se extenderia hasta la del yuan y se guardaria como si fuera suya.
  const relleno = "<p>relleno</p>".repeat(40);
  const sinCifra =
    "<html><body>" +
    moneda("euro", "EUR", "982,00454402").replace(/<strong[\s\S]*?<\/strong>/, relleno) +
    moneda("yuan", "CNY", "131,03154748") +
    moneda("dolar", "USD", "876,79760000") +
    fecha("2026-10-13T00:00:00-04:00") +
    "</body></html>";

  const resultado = leerTasasDeBcv(sinCifra);

  expect(resultado.ok).toBe(true);
  if (resultado.ok) {
    expect(resultado.lectura.tasas.map((tasa) => tasa.moneda)).toEqual(["CNY", "USD"]);
  }
});

test("la misma moneda dos veces rechaza la lectura", () => {
  const repetida = PAGINA.replace(
    moneda("yuan", "CNY", "131,03154748"),
    moneda("otro", "USD", "1,00000000"),
  );

  expect(leerTasasDeBcv(repetida)).toEqual({
    ok: false,
    motivo: "La pagina trae USD mas de una vez",
  });
});

test("los numeros se leen a la espanola: coma decimal y punto de miles", () => {
  expect(comoDecimal("876,79760000")).toBe("876.79760000");
  expect(comoDecimal(" 17,76980260 ")).toBe("17.76980260");
  expect(comoDecimal("1.234,50")).toBe("1234.50");
  expect(comoDecimal("12.345.678,90")).toBe("12345678.90");
  expect(comoDecimal("42")).toBe("42");
});

test("lo que no es un numero positivo bien escrito no pasa", () => {
  for (const malo of ["", "0", "0,00", "-5,2", "1,2,3", "12.34.5,6", "abc", "1e9", "876.79", "5,"]) {
    expect(comoDecimal(malo), malo).toBeNull();
  }
});

test("la fecha valor es el dia que escribio el BCV, sin pasar por la zona horaria", () => {
  expect(comoFechaValor("2026-10-13T00:00:00-04:00")).toBe("2026-10-13");

  // A las diez de la noche de Caracas ya es dia 14 en UTC. Sigue siendo el 13.
  expect(comoFechaValor("2026-10-13T22:00:00-04:00")).toBe("2026-10-13");
});

test("una fecha que no existe o mal escrita no pasa", () => {
  for (const mala of ["", "2026-02-31T00:00:00-04:00", "13/10/2026", "2026-13-01T00:00:00Z", "hoy"]) {
    expect(comoFechaValor(mala), mala).toBeNull();
  }
});

test("un cambio normal de un dia a otro es creible", () => {
  const anteriores = new Map([["USD", "870.00000000"]]);

  expect(saltoIncreible([{ moneda: "USD", valor: "876.79760000" }], anteriores)).toBeNull();
});

test("un salto mayor del 25 % se rechaza, hacia arriba y hacia abajo", () => {
  const anteriores = new Map([["USD", "876.79760000"]]);

  expect(saltoIncreible([{ moneda: "USD", valor: "8767.97600000" }], anteriores)).toContain("USD");
  expect(saltoIncreible([{ moneda: "USD", valor: "87.67976000" }], anteriores)).toContain("USD");
});

test("una moneda sin tasa anterior no tiene con que compararse y pasa", () => {
  expect(saltoIncreible([{ moneda: "EUR", valor: "982.00454402" }], new Map())).toBeNull();
});
