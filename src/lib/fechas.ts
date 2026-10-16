/**
 * La zona horaria de la agencia.
 *
 * Todo formateador de fechas la fija. Sin ella, uno de servidor escribe la
 * hora del servidor —UTC en Vercel y en Docker—, cuatro horas por delante de
 * Caracas; y uno de cliente, la del navegador, que puede ser otra. Peor aun:
 * si el servidor y el navegador escriben horas distintas, React no casa el
 * HTML con lo que pinta y falla la hidratacion.
 */
export const ZONA_HORARIA = "America/Caracas";

const RELATIVO = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

/**
 * Cuanto hace de algo, como se diria: «hace 5 minutos», «ayer», «hace 3
 * dias», «hace 2 semanas». Para leer de un vistazo cuanto lleva esperando
 * algo; la fecha exacta va aparte cuando haga falta.
 */
export function haceCuanto(fecha: Date, ahora: Date = new Date()): string {
  const minutos = Math.round((ahora.getTime() - fecha.getTime()) / 60_000);
  if (minutos < 1) return "ahora mismo";
  if (minutos < 60) return RELATIVO.format(-minutos, "minute");
  const horas = Math.round(minutos / 60);
  if (horas < 24) return RELATIVO.format(-horas, "hour");
  const dias = Math.round(horas / 24);
  if (dias < 14) return RELATIVO.format(-dias, "day");
  if (dias < 60) return RELATIVO.format(-Math.round(dias / 7), "week");
  return RELATIVO.format(-Math.round(dias / 30), "month");
}
