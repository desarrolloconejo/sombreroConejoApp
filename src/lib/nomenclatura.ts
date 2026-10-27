import type { TipoPieza } from "@/types";

/**
 * La nomenclatura de archivos de la agencia, como funciones puras.
 *
 *   CLIENTE_PROYECTO_TIPO_AAMM_VERSION.extension
 *
 * La comparten el renombrado automatico de las versiones de las piezas y el
 * modulo «Nombres de archivo», para que un archivo subido a la app y uno
 * nombrado a mano se llamen igual. Las reglas salen del armador HTML que usaba
 * el estudio: `_` separa bloques y `-` une palabras; mayusculas, sin acentos
 * ni enie, sin espacios; la fecha es ano-mes (2609 = septiembre de 2026); la
 * version, v01…, o APROBADO-CLIENTE la que el cliente aprobo.
 *
 * Sin dependencias de servidor: la usan tambien los componentes.
 */

/** Lo que mide como mucho la sigla de una empresa y el nombre corto de un proyecto. */
export const LARGO_SIGLA = 20;
export const LARGO_NOMBRE_CORTO = 30;

/** La version que el cliente aprobo, en lugar del numero. */
export const VERSION_APROBADA = "APROBADO-CLIENTE";

/** Un bloque bien escrito: palabras en mayusculas y numeros unidas por guiones. */
const BLOQUE_VALIDO = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

/**
 * Un bloque del nombre: MAYUSCULAS, sin acentos ni enie, con guiones entre
 * palabras y nada que no sea letra, numero o guion. Vacio si no queda nada.
 */
export function limpiarBloque(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Como `limpiarBloque`, pero nunca vacio: el nombre de un archivo no puede quedar cojo. */
export function bloque(texto: string): string {
  return limpiarBloque(texto) || "SIN-NOMBRE";
}

/** Si un valor ya escrito (una sigla, un nombre corto) cumple la nomenclatura. */
export function esBloqueValido(valor: string, largo: number): boolean {
  return valor.length > 0 && valor.length <= largo && BLOQUE_VALIDO.test(valor);
}

/** Recorta un bloque a un largo sin partir una palabra, si se puede. */
function recortar(valor: string, largo: number): string {
  if (valor.length <= largo) return valor;

  const corte = valor.slice(0, largo + 1).lastIndexOf("-");
  return (corte > 0 ? valor.slice(0, corte) : valor.slice(0, largo)).replace(/-+$/, "");
}

/** Las formas juridicas que sobran en la sigla de un cliente. */
const FORMAS_JURIDICAS = new Set(["C", "A", "CA", "S", "SA", "SRL", "RL", "LLC", "INC", "CORP"]);

/**
 * La sigla que se propone para una empresa a partir de su nombre: el nombre
 * en bloque, sin «C.A.» ni las formas juridicas del final. El administrador la
 * revisa; es la que va en todos sus archivos.
 */
export function proponerSigla(nombre: string): string {
  const palabras = limpiarBloque(nombre).split("-").filter(Boolean);

  while (palabras.length > 1 && FORMAS_JURIDICAS.has(palabras[palabras.length - 1])) {
    palabras.pop();
  }

  return recortar(palabras.join("-"), LARGO_SIGLA);
}

/**
 * El nombre corto que se propone para un proyecto: sus primeras palabras con
 * sentido, sin los articulos y preposiciones de enlace.
 */
const PALABRAS_VACIAS = new Set(["DE", "DEL", "LA", "EL", "LOS", "LAS", "Y", "PARA", "EN", "A", "UN", "UNA"]);

export function proponerNombreCorto(nombre: string): string {
  const palabras = limpiarBloque(nombre)
    .split("-")
    .filter((palabra) => palabra && !PALABRAS_VACIAS.has(palabra));

  return recortar(palabras.slice(0, 3).join("-"), LARGO_NOMBRE_CORTO);
}

/** Un tipo de archivo del armador. */
export type TipoArmador = { valor: string; nombre: string; grupo: "Piezas" | "Documentos" };

/** Los tipos de archivo de la agencia, en el orden del armador. */
export const TIPOS_ARMADOR: readonly TipoArmador[] = [
  { valor: "POST", nombre: "Post estatico (redes sociales)", grupo: "Piezas" },
  { valor: "CARRUSEL", nombre: "Carrusel (redes sociales)", grupo: "Piezas" },
  { valor: "REEL", nombre: "Reel / TikTok", grupo: "Piezas" },
  { valor: "STORY", nombre: "Historia / Story", grupo: "Piezas" },
  { valor: "VIDEO", nombre: "Video", grupo: "Piezas" },
  { valor: "COMERCIAL", nombre: "Comercial", grupo: "Piezas" },
  { valor: "KV", nombre: "Key visual", grupo: "Piezas" },
  { valor: "LOGO", nombre: "Logo", grupo: "Piezas" },
  { valor: "VALLA", nombre: "Valla", grupo: "Piezas" },
  { valor: "BRIEF", nombre: "Brief", grupo: "Documentos" },
  { valor: "CONCEPTO", nombre: "Concepto", grupo: "Documentos" },
  { valor: "CAMPANA", nombre: "Campana (documento)", grupo: "Documentos" },
  { valor: "PROPUESTA", nombre: "Propuesta", grupo: "Documentos" },
  { valor: "DECK", nombre: "Presentacion / deck", grupo: "Documentos" },
  { valor: "COT", nombre: "Cotizacion", grupo: "Documentos" },
  { valor: "INFORME", nombre: "Informe", grupo: "Documentos" },
];

/**
 * Como se llama cada tipo de pieza de la app en el armador. «Otro» no tiene
 * equivalente: va como PIEZA.
 */
export const TIPO_DE_PIEZA: Record<TipoPieza, string> = {
  post: "POST",
  carrusel: "CARRUSEL",
  reel: "REEL",
  historia: "STORY",
  video: "VIDEO",
  logo: "LOGO",
  entregable: "PROPUESTA",
  otro: "PIEZA",
};

/** Las extensiones que el armador ofrece a un toque. */
export const EXTENSIONES_RAPIDAS: readonly string[] = [
  "jpg", "png", "gif", "svg", "pdf", "ai", "psd", "indd", "mp4",
  "mov", "prproj", "aep", "mp3", "wav", "pptx", "docx", "xlsx", "zip",
];

/** El bloque de la fecha, AAMM, desde un dia `aaaa-mm-dd`. */
export function fechaAamm(dia: string): string {
  return dia.slice(2, 4) + dia.slice(5, 7);
}

/** El bloque de la version: v01…, o APROBADO-CLIENTE. */
export function bloqueVersion(version: number | "aprobado"): string {
  return version === "aprobado" ? VERSION_APROBADA : `v${String(version).padStart(2, "0")}`;
}

/** Una extension limpia, sin punto y en minusculas. */
export function limpiarExtension(extension: string): string {
  return extension.trim().replace(/^\./, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * El nombre completo. Cada bloque llega ya escrito (la sigla, el nombre
 * corto, el tipo): esta funcion solo los une. Sin extension, el nombre
 * termina en la version.
 */
export function nombreDeArchivo(partes: {
  cliente: string;
  proyecto: string;
  tipo: string;
  /** AAMM. */
  fecha: string;
  version: number | "aprobado";
  extension?: string;
}): string {
  const extension = limpiarExtension(partes.extension ?? "");

  return (
    [partes.cliente, partes.proyecto, partes.tipo, partes.fecha, bloqueVersion(partes.version)].join("_") +
    (extension ? `.${extension}` : "")
  );
}

/**
 * El nombre de un archivo cuando el cliente lo aprueba: el mismo, con
 * APROBADO-CLIENTE en lugar de su numero de version. Si el nombre no sigue la
 * nomenclatura (un archivo de antes), se deja como esta.
 */
export function comoAprobado(nombre: string): string {
  return nombre.replace(/_v\d{2,}(\.[a-z0-9]+)?$/, (_, extension = "") => `_${VERSION_APROBADA}${extension}`);
}
