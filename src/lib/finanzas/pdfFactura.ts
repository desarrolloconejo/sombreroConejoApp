import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import type {
  CampoFactura,
  ColumnaFactura,
  Factura,
  FormatoImpresion,
  PosicionCampo,
  RenglonFactura,
} from "@/types";
import { NOMBRES_DE_CAMPO_FACTURA } from "@/types";
import { bolivares, dolares, fechaImpresa, numeroFactura, tasaLegible } from "./documentos";

/**
 * El PDF de una factura sobre el talonario preimpreso, y la hoja de
 * calibracion de un formato.
 *
 * La factura lleva SOLO el texto variable: cada dato en sus coordenadas en
 * milimetros, sobre papel que ya trae impreso lo demas. Sale de los datos
 * congelados de la factura, asi que se regenera identica cuando haga falta.
 *
 * Seccion 7.8 del plan. Funciones puras: reciben los datos, devuelven bytes.
 */

const PUNTOS_POR_MM = 72 / 25.4;

function puntos(mm: number): number {
  return mm * PUNTOS_POR_MM;
}

/**
 * La fuente estandar solo sabe WinAnsi. Lo que no cabe ahi (emojis, comillas
 * raras) se cambia por un equivalente o se quita, para que nunca falle.
 */
function enWinAnsi(texto: string): string {
  return texto
    .replace(/[‘’]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E -ÿ]/g, "");
}

/** Recorta el texto con «...» hasta que quepa en el ancho. */
function ajustar(texto: string, fuente: PDFFont, tamano: number, ancho: number): string {
  const limpio = enWinAnsi(texto);
  if (fuente.widthOfTextAtSize(limpio, tamano) <= ancho) return limpio;

  let recorte = limpio;
  while (recorte.length > 0 && fuente.widthOfTextAtSize(`${recorte}...`, tamano) > ancho) {
    recorte = recorte.slice(0, -1);
  }
  return `${recorte}...`;
}

/** Escribe en una posicion en milimetros; `y` es la linea base. */
function escribir(
  pagina: PDFPage,
  texto: string,
  posicion: { x: number; y: number; ancho: number; alinear?: "izquierda" | "derecha" },
  fuente: PDFFont,
  tamano: number,
  altoHoja: number,
): void {
  const ancho = puntos(posicion.ancho);
  const ajustado = ajustar(texto, fuente, tamano, ancho);
  const medida = fuente.widthOfTextAtSize(ajustado, tamano);
  const x = puntos(posicion.x) + (posicion.alinear === "derecha" ? ancho - medida : 0);

  pagina.drawText(ajustado, { x, y: puntos(altoHoja - posicion.y), size: tamano, font: fuente });
}

/** Una cantidad sin ceros de mas: 2.500 -> «2,5». */
function cantidad(texto: string): string {
  const [entera, fraccion = ""] = texto.split(".");
  const recortada = fraccion.replace(/0+$/, "");
  return recortada ? `${entera},${recortada}` : entera;
}

/** Lo que va en cada campo, sacado de la factura congelada. */
export function textosDeFactura(factura: Factura): Record<CampoFactura, string> {
  return {
    numero: numeroFactura(factura.serie, factura.numero),
    fecha: fechaImpresa(factura.fechaEmision),
    vence: fechaImpresa(factura.venceEl),
    razonSocial: factura.cliente.razonSocial,
    rif: factura.cliente.rif,
    domicilio: factura.cliente.domicilio,
    tasa: `Tasa BCV ${tasaLegible(factura.tasa)} Bs/USD del ${fechaImpresa(factura.tasaFecha)}`,
    referenciaUsd: `Referencia: ${dolares(factura.totalUsd)}`,
    baseImponible: bolivares(factura.baseImponible),
    exento: bolivares(factura.montoExento),
    ivaPct: `${factura.ivaPct.replace(/\.00$/, "")} %`,
    ivaMonto: bolivares(factura.ivaMonto),
    total: bolivares(factura.total),
  };
}

function textosDeRenglon(renglon: RenglonFactura): Record<ColumnaFactura, string> {
  return {
    cantidad: cantidad(renglon.cantidad),
    descripcion: renglon.exento ? `${renglon.descripcion} (E)` : renglon.descripcion,
    precio: bolivares(renglon.precioUnitario),
    subtotal: bolivares(renglon.subtotal),
  };
}

/** El PDF de una factura en un formato. */
export async function pdfDeFactura(
  factura: Factura,
  renglones: RenglonFactura[],
  formato: FormatoImpresion,
): Promise<Uint8Array> {
  const ancho = Number(formato.anchoMm);
  const alto = Number(formato.altoMm);
  const tamano = Number(formato.fuentePt);

  const documento = await PDFDocument.create();
  documento.setTitle(`Factura ${numeroFactura(factura.serie, factura.numero)}`);
  documento.setProducer("Conejo App");
  const fuente = await documento.embedFont(StandardFonts.Helvetica);
  const pagina = documento.addPage([puntos(ancho), puntos(alto)]);

  const textos = textosDeFactura(factura);
  for (const [clave, posicion] of Object.entries(formato.campos) as [CampoFactura, PosicionCampo][]) {
    escribir(pagina, textos[clave], posicion, fuente, tamano, alto);
  }

  const { columnas, y_inicio, alto_mm, max } = formato.renglones;
  renglones.slice(0, max).forEach((renglon, indice) => {
    const textosRenglon = textosDeRenglon(renglon);
    for (const [clave, columna] of Object.entries(columnas) as [ColumnaFactura, PosicionCampo][]) {
      escribir(pagina, textosRenglon[clave], { ...columna, y: y_inicio + indice * alto_mm }, fuente, tamano, alto);
    }
  });

  if (factura.estado === "anulada") {
    pagina.drawText("ANULADA", {
      x: puntos(ancho * 0.25),
      y: puntos(alto * 0.5),
      size: 48,
      font: fuente,
      color: rgb(0.6, 0.6, 0.6),
      opacity: 0.4,
    });
  }

  return documento.save();
}

/**
 * La hoja de calibracion de un formato: una cuadricula en milimetros y cada
 * dato recuadrado con su nombre. Se imprime sobre el talonario, se mide lo
 * que se corrio y se ajusta el formato.
 */
export async function pdfDeCalibracion(formato: FormatoImpresion): Promise<Uint8Array> {
  const ancho = Number(formato.anchoMm);
  const alto = Number(formato.altoMm);
  const tamano = Number(formato.fuentePt);
  const linea = tamano * 0.3528 * 1.25;
  const gris = rgb(0.75, 0.75, 0.75);
  const fuerte = rgb(0.45, 0.45, 0.45);
  const marca = rgb(0.38, 0.13, 0.29);

  const documento = await PDFDocument.create();
  documento.setTitle(`Calibracion: ${enWinAnsi(formato.nombre)}`);
  const fuente = await documento.embedFont(StandardFonts.Helvetica);
  const pagina = documento.addPage([puntos(ancho), puntos(alto)]);

  // La cuadricula: cada 5 mm fina, cada 10 mm marcada y numerada.
  for (let x = 0; x <= ancho; x += 5) {
    const decena = x % 10 === 0;
    pagina.drawLine({
      start: { x: puntos(x), y: 0 },
      end: { x: puntos(x), y: puntos(alto) },
      thickness: decena ? 0.4 : 0.15,
      color: decena ? fuerte : gris,
    });
    if (decena && x > 0) pagina.drawText(String(x), { x: puntos(x) + 1, y: puntos(alto) - 7, size: 5, font: fuente, color: fuerte });
  }
  for (let y = 0; y <= alto; y += 5) {
    const decena = y % 10 === 0;
    pagina.drawLine({
      start: { x: 0, y: puntos(alto - y) },
      end: { x: puntos(ancho), y: puntos(alto - y) },
      thickness: decena ? 0.4 : 0.15,
      color: decena ? fuerte : gris,
    });
    if (decena && y > 0) pagina.drawText(String(y), { x: 2, y: puntos(alto - y) + 1, size: 5, font: fuente, color: fuerte });
  }

  // Cada dato, recuadrado donde caeria su texto.
  const recuadro = (x: number, y: number, w: number, nombre: string) => {
    pagina.drawRectangle({
      x: puntos(x),
      y: puntos(alto - y),
      width: puntos(w),
      height: puntos(linea),
      borderColor: marca,
      borderWidth: 0.6,
    });
    pagina.drawText(ajustar(nombre, fuente, 5.5, puntos(w) - 2), {
      x: puntos(x) + 1,
      y: puntos(alto - y) + 1.5,
      size: 5.5,
      font: fuente,
      color: marca,
    });
  };

  for (const [clave, posicion] of Object.entries(formato.campos) as [CampoFactura, PosicionCampo][]) {
    recuadro(posicion.x, posicion.y, posicion.ancho, NOMBRES_DE_CAMPO_FACTURA[clave]);
  }

  const { columnas, y_inicio, alto_mm, max } = formato.renglones;
  for (let i = 0; i < max; i++) {
    for (const [clave, columna] of Object.entries(columnas) as [ColumnaFactura, PosicionCampo][]) {
      recuadro(columna.x, y_inicio + i * alto_mm, columna.ancho, i === 0 ? NOMBRES_DE_CAMPO_FACTURA[clave] : "");
    }
  }

  pagina.drawText(enWinAnsi(`${formato.nombre} - ${ancho} x ${alto} mm - medidas desde la esquina superior izquierda`), {
    x: puntos(12),
    y: puntos(4),
    size: 6,
    font: fuente,
    color: fuerte,
  });

  return documento.save();
}
