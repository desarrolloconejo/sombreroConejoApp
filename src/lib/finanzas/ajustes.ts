import { limpiarOpcional, limpiarTexto } from "@/lib/validaciones";
import {
  CAMPOS_FACTURA,
  COLUMNAS_FACTURA,
  type AjustesFinanzas,
  type CampoFactura,
  type ColumnaFactura,
  type ColumnaRenglon,
  type DatosFormatoImpresion,
  type DatosMedioPago,
  type ErroresCampo,
  type MonedaPago,
  type Numeracion,
  type PosicionCampo,
} from "@/types";
import { normalizarDecimal } from "./calculo";

/**
 * Lo que llega de los formularios de ajustes de finanzas, comprobado. Como en
 * el resto de finanzas, la base vuelve a mirar cada valor con sus CHECK: esto
 * esta para devolver un mensaje que se entienda, campo a campo.
 */

export const LIMITES_AJUSTES = {
  razonSocial: 200,
  rif: 20,
  domicilio: 400,
  nombre: 80,
  datosParaPagar: 1000,
} as const;

/** RIF venezolano: letra, guion, ocho digitos, guion, un digito. */
export function rifValido(texto: string): boolean {
  return /^[JGVEPC]-\d{8}-\d$/.test(texto);
}

/** Un porcentaje entre 0 y 100 con hasta dos decimales, como texto. */
export function leerPorcentaje(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const texto = normalizarDecimal(valor.trim().replace(",", "."), 2);
  // Comparar un porcentaje con 100 no mueve dinero: aqui `Number` basta.
  return texto !== null && Number(texto) <= 100 ? texto : null;
}

function leerEntero(valor: unknown, minimo: number, maximo: number): number | null {
  if (typeof valor !== "string" || !/^\d{1,7}$/.test(valor.trim())) return null;
  const numero = Number(valor.trim());
  return numero >= minimo && numero <= maximo ? numero : null;
}

/** Emisor, impuestos y dias de credito. */
export function leerAjustes(datos: FormData): { ajustes: AjustesFinanzas; errores: ErroresCampo } {
  const errores: ErroresCampo = {};

  const razon = limpiarOpcional(datos.get("emisorRazonSocial"), LIMITES_AJUSTES.razonSocial);
  const rif = limpiarOpcional(datos.get("emisorRif"), LIMITES_AJUSTES.rif)?.toUpperCase() ?? null;
  const domicilio = limpiarOpcional(datos.get("emisorDomicilio"), LIMITES_AJUSTES.domicilio);
  if (rif !== null && !rifValido(rif)) errores.emisorRif = "Escribe el RIF asi: J-12345678-9";

  const iva = leerPorcentaje(datos.get("ivaPct"));
  const islr = leerPorcentaje(datos.get("islrPct"));
  const igtf = leerPorcentaje(datos.get("igtfPct"));
  const dias = leerEntero(datos.get("diasCredito"), 0, 365);
  if (iva === null) errores.ivaPct = "Un porcentaje entre 0 y 100";
  if (islr === null) errores.islrPct = "Un porcentaje entre 0 y 100";
  if (igtf === null) errores.igtfPct = "Un porcentaje entre 0 y 100";
  if (dias === null) errores.diasCredito = "Entre 0 y 365 dias";

  return {
    ajustes: {
      emisorRazonSocial: razon,
      emisorRif: rif,
      emisorDomicilio: domicilio,
      ivaPct: iva ?? "16.00",
      islrActivo: datos.get("islrActivo") === "si",
      islrPct: islr ?? "0.00",
      igtfActivo: datos.get("igtfActivo") === "si",
      igtfPct: igtf ?? "0.00",
      diasCredito: dias ?? 0,
    },
    errores,
  };
}

/** Serie, proximos numeros y rango del talonario. */
export function leerNumeracion(datos: FormData): { numeracion: Numeracion; errores: ErroresCampo } {
  const errores: ErroresCampo = {};

  const serie = limpiarTexto(datos.get("serie"), 3).toUpperCase();
  const prefijo = limpiarTexto(datos.get("controlPrefijo"), 6).toUpperCase();
  const factura = leerEntero(datos.get("proximaFactura"), 1, 9_999_999);
  const control = leerEntero(datos.get("proximoControl"), 1, 9_999_999);
  const hasta = leerEntero(datos.get("controlHasta"), 1, 9_999_999);

  if (!/^[A-Z]{1,3}$/.test(serie)) errores.serie = "De una a tres letras";
  if (!/^[0-9A-Z-]{0,6}$/.test(prefijo)) errores.controlPrefijo = "Hasta seis letras, numeros o guiones";
  if (factura === null) errores.proximaFactura = "Un numero entero desde 1";
  if (control === null) errores.proximoControl = "Un numero entero desde 1";
  if (hasta === null) errores.controlHasta = "Un numero entero desde 1";
  if (control !== null && hasta !== null && hasta < control) {
    errores.controlHasta = "El rango no puede terminar antes del proximo numero";
  }

  return {
    numeracion: {
      serie,
      proximaFactura: factura ?? 0,
      proximoControl: control ?? 0,
      controlPrefijo: prefijo,
      controlHasta: hasta ?? 0,
    },
    errores,
  };
}

/** Un medio de pago. */
export function leerMedio(datos: FormData): { medio: DatosMedioPago; errores: ErroresCampo } {
  const errores: ErroresCampo = {};

  const nombre = limpiarTexto(datos.get("nombre"), LIMITES_AJUSTES.nombre);
  const monedas = datos
    .getAll("monedas")
    .filter((m): m is MonedaPago => m === "USD" || m === "VES");
  const orden = leerEntero(datos.get("orden") || "0", 0, 999);

  if (!nombre) errores.nombre = "Ponle un nombre";
  if (monedas.length === 0) errores.monedas = "Elige al menos una moneda";
  if (orden === null) errores.orden = "Un numero entre 0 y 999";

  return {
    medio: {
      nombre,
      monedas: [...new Set(monedas)],
      pideReferencia: datos.get("pideReferencia") === "si",
      datosParaPagar: limpiarOpcional(datos.get("datosParaPagar"), LIMITES_AJUSTES.datosParaPagar),
      orden: orden ?? 0,
      activo: datos.get("activo") === "si",
    },
    errores,
  };
}

/** Una medida en milimetros, con un decimal como mucho. */
function leerMilimetros(valor: unknown, maximo: number): number | null {
  if (typeof valor !== "string") return null;
  const texto = valor.trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d)?$/.test(texto)) return null;
  const numero = Number(texto);
  return numero <= maximo ? numero : null;
}

function leerAlineacion(valor: unknown): "derecha" | undefined {
  return valor === "derecha" ? "derecha" : undefined;
}

/**
 * Un formato de impresion. Cada campo de la factura llega como
 * `c_<campo>_x`, `_y`, `_ancho`, `_alinear` y `_usar` (si se imprime); cada
 * columna de los renglones, como `k_<columna>_x`, `_ancho` y `_alinear`.
 * Todo tiene que caber en la hoja.
 */
export function leerFormato(datos: FormData): { formato: DatosFormatoImpresion; errores: ErroresCampo } {
  const errores: ErroresCampo = {};

  const nombre = limpiarTexto(datos.get("nombre"), LIMITES_AJUSTES.nombre);
  if (!nombre) errores.nombre = "Ponle un nombre";

  const ancho = leerMilimetros(datos.get("anchoMm"), 500);
  const alto = leerMilimetros(datos.get("altoMm"), 500);
  if (ancho === null || ancho < 50) errores.anchoMm = "Entre 50 y 500 mm";
  if (alto === null || alto < 50) errores.altoMm = "Entre 50 y 500 mm";

  const fuente = typeof datos.get("fuentePt") === "string" ? Number(datos.get("fuentePt")) : NaN;
  if (!Number.isFinite(fuente) || fuente < 5 || fuente > 20) errores.fuentePt = "Entre 5 y 20 puntos";

  const anchoHoja = ancho ?? 500;
  const altoHoja = alto ?? 500;

  const campos: Partial<Record<CampoFactura, PosicionCampo>> = {};
  for (const clave of CAMPOS_FACTURA) {
    if (datos.get(`c_${clave}_usar`) !== "si") continue;
    const x = leerMilimetros(datos.get(`c_${clave}_x`), anchoHoja);
    const y = leerMilimetros(datos.get(`c_${clave}_y`), altoHoja);
    const anchoCampo = leerMilimetros(datos.get(`c_${clave}_ancho`), anchoHoja);
    if (x === null || y === null || anchoCampo === null || anchoCampo === 0 || x + anchoCampo > anchoHoja) {
      errores[`c_${clave}`] = "No cabe en la hoja";
      continue;
    }
    const alinear = leerAlineacion(datos.get(`c_${clave}_alinear`));
    campos[clave] = alinear ? { x, y, ancho: anchoCampo, alinear } : { x, y, ancho: anchoCampo };
  }

  const yInicio = leerMilimetros(datos.get("r_y_inicio"), altoHoja);
  const altoRenglon = leerMilimetros(datos.get("r_alto_mm"), 50);
  const maximo = leerEntero(datos.get("r_max"), 1, 60);
  if (yInicio === null) errores.r_y_inicio = "No cabe en la hoja";
  if (altoRenglon === null || altoRenglon < 2) errores.r_alto_mm = "Entre 2 y 50 mm";
  if (maximo === null) errores.r_max = "Entre 1 y 60 renglones";
  if (yInicio !== null && altoRenglon !== null && maximo !== null && yInicio + altoRenglon * maximo > altoHoja) {
    errores.r_max = "Tantos renglones no caben en la hoja";
  }

  const columnas: Partial<Record<ColumnaFactura, ColumnaRenglon>> = {};
  for (const clave of COLUMNAS_FACTURA) {
    const x = leerMilimetros(datos.get(`k_${clave}_x`), anchoHoja);
    const anchoColumna = leerMilimetros(datos.get(`k_${clave}_ancho`), anchoHoja);
    if (x === null || anchoColumna === null || anchoColumna === 0 || x + anchoColumna > anchoHoja) {
      errores[`k_${clave}`] = "No cabe en la hoja";
      continue;
    }
    const alinear = leerAlineacion(datos.get(`k_${clave}_alinear`));
    columnas[clave] = alinear ? { x, ancho: anchoColumna, alinear } : { x, ancho: anchoColumna };
  }

  return {
    formato: {
      nombre,
      anchoMm: String(ancho ?? 0),
      altoMm: String(alto ?? 0),
      fuentePt: String(Number.isFinite(fuente) ? fuente : 9),
      campos,
      renglones: { y_inicio: yInicio ?? 0, alto_mm: altoRenglon ?? 0, max: maximo ?? 1, columnas },
      activo: datos.get("activo") === "si",
    },
    errores,
  };
}

/** Si queda poco talonario: menos de 20 numeros de control, o ninguno. */
export function quedaPocoTalonario(numeracion: Numeracion): number | null {
  const quedan = numeracion.controlHasta - numeracion.proximoControl + 1;
  return quedan < 20 ? Math.max(quedan, 0) : null;
}
