import { expect, test } from "@playwright/test";
import {
  bloque,
  comoAprobado,
  esBloqueValido,
  fechaAamm,
  limpiarBloque,
  limpiarExtension,
  nombreDeArchivo,
  proponerNombreCorto,
  proponerSigla,
} from "@/lib/nomenclatura";

/**
 * La nomenclatura de archivos de la agencia: la comparten el renombrado de
 * las versiones y el modulo «Nombres de archivo».
 */

test.describe("bloques", () => {
  test("sin acentos, sin enie y con guiones entre palabras", () => {
    expect(bloque("Cafe Sendero, C.A.")).toBe("CAFE-SENDERO-C-A");
    expect(bloque("Campaña de Navidad")).toBe("CAMPANA-DE-NAVIDAD");
    expect(bloque("Diseño  y   edición")).toBe("DISENO-Y-EDICION");
    expect(bloque("!!!")).toBe("SIN-NOMBRE");
    expect(limpiarBloque("!!!")).toBe("");
  });

  test("un bloque valido cabe y esta bien escrito", () => {
    expect(esBloqueValido("SHERWIN-WILLIAMS", 20)).toBe(true);
    expect(esBloqueValido("sherwin", 20)).toBe(false);
    expect(esBloqueValido("A--B", 20)).toBe(false);
    expect(esBloqueValido("", 20)).toBe(false);
    expect(esBloqueValido("UNA-SIGLA-DEMASIADO-LARGA", 20)).toBe(false);
  });
});

test.describe("propuestas", () => {
  test("la sigla quita la forma juridica y no parte palabras", () => {
    expect(proponerSigla("Distribuidora Ejemplo, C.A.")).toBe("DISTRIBUIDORA");
    expect(proponerSigla("Sherwin Williams")).toBe("SHERWIN-WILLIAMS");
    expect(proponerSigla("Toyota de Venezuela S.A.")).toBe("TOYOTA-DE-VENEZUELA");
    expect(proponerSigla("Papelón")).toBe("PAPELON");
  });

  test("el nombre corto toma tres palabras con sentido", () => {
    expect(proponerNombreCorto("Parrilla de octubre")).toBe("PARRILLA-OCTUBRE");
    expect(proponerNombreCorto("Empaque de la linea premium")).toBe("EMPAQUE-LINEA-PREMIUM");
    expect(proponerNombreCorto("Campaña de verano para la marca")).toBe("CAMPANA-VERANO-MARCA");
  });
});

test.describe("el nombre", () => {
  test("une los bloques con la fecha AAMM y la version", () => {
    expect(fechaAamm("2026-09-14")).toBe("2609");
    expect(
      nombreDeArchivo({ cliente: "TOYOTA", proyecto: "LANZAMIENTO-PRADO", tipo: "KV", fecha: "2609", version: 3, extension: ".AI" }),
    ).toBe("TOYOTA_LANZAMIENTO-PRADO_KV_2609_v03.ai");
  });

  test("la extension se limpia", () => {
    expect(limpiarExtension(" .PNG ")).toBe("png");
    expect(limpiarExtension("p.n g")).toBe("png");
  });

  test("una version pasa a APROBADO-CLIENTE al aprobarse", () => {
    expect(comoAprobado("GELLA_PARRILLA-OCTUBRE_POST_2610_v04.png")).toBe(
      "GELLA_PARRILLA-OCTUBRE_POST_2610_APROBADO-CLIENTE.png",
    );
    expect(comoAprobado("GELLA_X_POST_2610_v12")).toBe("GELLA_X_POST_2610_APROBADO-CLIENTE");
    // Un nombre de antes, que no sigue la nomenclatura, se queda igual.
    expect(comoAprobado("Corte final.pdf")).toBe("Corte final.pdf");
  });
});
