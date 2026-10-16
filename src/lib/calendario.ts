/**
 * El calendario de CampoFecha, como funciones puras.
 *
 * Una fecha viaja siempre como texto `aaaa-mm-dd`, igual que la envia un
 * formulario. Las cuentas se hacen en UTC: un dia del calendario no tiene
 * zona horaria, y en la hora local de Caracas el 14 de noviembre a las
 * 00:00 UTC seria todavia el 13.
 */

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const ESCRITA = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;

/** Las piezas de una fecha ISO, o null si no es un dia que exista. */
export function piezasDe(iso: string): { ano: number; mes: number; dia: number } | null {
  const partes = ISO.exec(iso);
  if (!partes) return null;
  return componer(Number(partes[1]), Number(partes[2]), Number(partes[3]));
}

function componer(ano: number, mes: number, dia: number) {
  if (ano < 1000 || mes < 1 || mes > 12 || dia < 1) return null;
  const fecha = new Date(Date.UTC(ano, mes - 1, dia));
  // El 31 de febrero no existe: Date lo pasaria al 3 de marzo.
  if (fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) return null;
  return { ano, mes, dia };
}

export function aIso(ano: number, mes: number, dia: number): string {
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Lo que alguien escribe, como fecha ISO: `14/11/2026`, `14-11-2026` o
 * `2026-11-14`. Null si no es una fecha que exista.
 */
export function leerFecha(texto: string): string | null {
  const limpio = texto.trim();
  const iso = piezasDe(limpio);
  if (iso) return aIso(iso.ano, iso.mes, iso.dia);

  const partes = ESCRITA.exec(limpio);
  if (!partes) return null;
  const fecha = componer(Number(partes[3]), Number(partes[2]), Number(partes[1]));
  return fecha ? aIso(fecha.ano, fecha.mes, fecha.dia) : null;
}

/** Como se escribe una fecha ISO en el campo: `14/11/2026`. */
export function escribirFecha(iso: string): string {
  const fecha = piezasDe(iso);
  if (!fecha) return "";
  return `${String(fecha.dia).padStart(2, "0")}/${String(fecha.mes).padStart(2, "0")}/${fecha.ano}`;
}

export function sumarDias(iso: string, dias: number): string {
  const fecha = piezasDe(iso);
  if (!fecha) return iso;
  const nueva = new Date(Date.UTC(fecha.ano, fecha.mes - 1, fecha.dia + dias));
  return aIso(nueva.getUTCFullYear(), nueva.getUTCMonth() + 1, nueva.getUTCDate());
}

/** El mismo dia en otro mes; si no existe (31 de abril), el ultimo de ese mes. */
export function sumarMeses(iso: string, meses: number): string {
  const fecha = piezasDe(iso);
  if (!fecha) return iso;
  const indice = fecha.ano * 12 + (fecha.mes - 1) + meses;
  const ano = Math.floor(indice / 12);
  const mes = (indice % 12) + 1;
  return aIso(ano, mes, Math.min(fecha.dia, diasDelMes(ano, mes)));
}

export function diasDelMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** Dia de la semana con el lunes como 0 y el domingo como 6. */
export function diaDeSemana(iso: string): number {
  const fecha = piezasDe(iso);
  if (!fecha) return 0;
  return (new Date(Date.UTC(fecha.ano, fecha.mes - 1, fecha.dia)).getUTCDay() + 6) % 7;
}

/**
 * Las semanas que se pintan para un mes, de lunes a domingo. Los dias del
 * mes anterior o siguiente que completan la primera y la ultima semana
 * tambien estan: se pintan atenuados.
 */
export function semanasDelMes(ano: number, mes: number): string[][] {
  const primero = aIso(ano, mes, 1);
  const ultimo = aIso(ano, mes, diasDelMes(ano, mes));
  let dia = sumarDias(primero, -diaDeSemana(primero));
  const fin = sumarDias(ultimo, 6 - diaDeSemana(ultimo));

  const semanas: string[][] = [];
  while (dia <= fin) {
    const semana: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      semana.push(dia);
      dia = sumarDias(dia, 1);
    }
    semanas.push(semana);
  }
  return semanas;
}

/** Si un dia cae entre los limites. Las cadenas ISO se comparan como texto. */
export function dentroDe(iso: string, min?: string, max?: string): boolean {
  if (min && iso < min) return false;
  if (max && iso > max) return false;
  return true;
}

/** El dia mas cercano dentro de los limites. */
export function acotar(iso: string, min?: string, max?: string): string {
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
}
