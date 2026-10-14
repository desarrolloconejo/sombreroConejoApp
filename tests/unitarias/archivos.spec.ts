import { expect, test } from "@playwright/test";
import {
  bloque,
  enlacePermitido,
  nombreEstandar,
  sitioDeEnlace,
  tipoPorFirma,
} from "@/lib/portal/archivos";

/**
 * El criterio de los archivos de las piezas: el nombre estandar del estudio,
 * el tipo por la firma de los bytes y la lista blanca de enlaces.
 */

test.describe("nombre estandar", () => {
  test("arma los seis bloques con la version en dos digitos", () => {
    expect(
      nombreEstandar({
        cliente: "Gella",
        proyecto: "Parrilla octubre",
        archivo: "Post 04",
        tipo: "post",
        fecha: "2026-10-06",
        version: 2,
        extension: "png",
      }),
    ).toBe("GELLA_PARRILLA-OCTUBRE_POST-04_POST_261006_v02.png");
  });

  test("la aprobada lleva APROBADO-CLIENTE en lugar del numero", () => {
    expect(
      nombreEstandar({
        cliente: "Gella",
        proyecto: "Imagen corporativa",
        archivo: "Logo",
        tipo: "logo",
        fecha: "2026-10-14",
        version: "aprobado",
        extension: ".PDF",
      }),
    ).toBe("GELLA_IMAGEN-CORPORATIVA_LOGO_LOGO_261014_APROBADO-CLIENTE.pdf");
  });

  test("una historia se llama STORY", () => {
    expect(
      nombreEstandar({
        cliente: "A",
        proyecto: "B",
        archivo: "C",
        tipo: "historia",
        fecha: "2026-01-02",
        version: 1,
        extension: "jpg",
      }),
    ).toContain("_STORY_260102_v01");
  });

  test("sin acentos, sin enie y con guiones entre palabras", () => {
    expect(bloque("Cafe Sendero, C.A.")).toBe("CAFE-SENDERO-C-A");
    expect(bloque("Campana de Navidad")).toBe("CAMPANA-DE-NAVIDAD");
    expect(bloque("Diseño  y   edición")).toBe("DISENO-Y-EDICION");
    expect(bloque("!!!")).toBe("SIN-NOMBRE");
  });
});

test.describe("tipo por firma", () => {
  const con = (...bytes: number[]) => new Uint8Array([...bytes, ...new Array(16).fill(0)]);

  test("reconoce png, jpg, gif, webp y pdf", () => {
    expect(tipoPorFirma(con(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.mime).toBe("image/png");
    expect(tipoPorFirma(con(0xff, 0xd8, 0xff, 0xe0))?.mime).toBe("image/jpeg");
    expect(tipoPorFirma(con(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))?.mime).toBe("image/gif");
    expect(
      tipoPorFirma(con(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))?.mime,
    ).toBe("image/webp");
    expect(tipoPorFirma(con(0x25, 0x50, 0x44, 0x46, 0x2d))?.mime).toBe("application/pdf");
  });

  test("lo demas no se acepta, se llame como se llame", () => {
    expect(tipoPorFirma(new TextEncoder().encode("<script>alert(1)</script>"))).toBeNull();
    expect(tipoPorFirma(con(0x4d, 0x5a))).toBeNull();
    expect(tipoPorFirma(new Uint8Array())).toBeNull();
  });
});

test.describe("enlaces externos", () => {
  test("acepta los sitios de la lista, con o sin subdominio", () => {
    expect(enlacePermitido("https://www.figma.com/file/abc")).toBe("https://www.figma.com/file/abc");
    expect(enlacePermitido("https://app.frame.io/reviews/x")).not.toBeNull();
    expect(enlacePermitido("  https://drive.google.com/file/d/1  ")).not.toBeNull();
  });

  test("rechaza http, otros sitios y lo que solo se parece", () => {
    expect(enlacePermitido("http://figma.com/file")).toBeNull();
    expect(enlacePermitido("https://figma.com.ataque.net/")).toBeNull();
    expect(enlacePermitido("https://notfigma.com/")).toBeNull();
    expect(enlacePermitido("https://usuario:clave@figma.com/")).toBeNull();
    expect(enlacePermitido("javascript:alert(1)")).toBeNull();
    expect(enlacePermitido("no es un enlace")).toBeNull();
  });

  test("nombra el sitio sin www", () => {
    expect(sitioDeEnlace("https://www.dropbox.com/s/x")).toBe("dropbox.com");
  });
});
