import { expect, test } from "@playwright/test";
import { leerRango } from "@/lib/externos/archivos";
import {
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
  const base = {
    cliente: "GELLA",
    proyecto: "PARRILLA-OCTUBRE",
    tipo: "post" as const,
    orden: { numero: 1, total: 1 },
    fecha: "2026-10-06",
  };

  test("CLIENTE_PROYECTO_TIPO_AAMM_vNN, con la version en dos digitos", () => {
    expect(nombreEstandar({ ...base, version: 2, extension: "png" })).toBe(
      "GELLA_PARRILLA-OCTUBRE_POST_2610_v02.png",
    );
  });

  test("la aprobada lleva APROBADO-CLIENTE en lugar del numero", () => {
    expect(nombreEstandar({ ...base, tipo: "logo", version: "aprobado", extension: ".PDF" })).toBe(
      "GELLA_PARRILLA-OCTUBRE_LOGO_2610_APROBADO-CLIENTE.pdf",
    );
  });

  test("una historia se llama STORY y un entregable PROPUESTA", () => {
    expect(nombreEstandar({ ...base, tipo: "historia", version: 1 })).toBe("GELLA_PARRILLA-OCTUBRE_STORY_2610_v01");
    expect(nombreEstandar({ ...base, tipo: "entregable", version: 1 })).toContain("_PROPUESTA_");
  });

  test("con varias piezas del mismo tipo, el tipo lleva su orden", () => {
    expect(nombreEstandar({ ...base, orden: { numero: 3, total: 4 }, version: 1, extension: "jpg" })).toBe(
      "GELLA_PARRILLA-OCTUBRE_POST-03_2610_v01.jpg",
    );
  });

  test("lo que llega sin limpiar se pasa a bloque", () => {
    expect(nombreEstandar({ ...base, cliente: "Café Sendero", proyecto: "", version: 1 })).toBe(
      "CAFE-SENDERO_SIN-NOMBRE_POST_2610_v01",
    );
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

test.describe("cabecera Range", () => {
  test("entiende un trozo con y sin final", () => {
    expect(leerRango("bytes=0-99")).toEqual({ inicio: 0, fin: 99 });
    expect(leerRango("bytes=500-")).toEqual({ inicio: 500, fin: null });
  });

  test("lo que no se reconoce se ignora y se entrega entero", () => {
    expect(leerRango(null)).toBeNull();
    expect(leerRango("bytes=10-5")).toBeNull();
    expect(leerRango("bytes=0-1,5-9")).toBeNull();
    expect(leerRango("items=0-9")).toBeNull();
  });
});
