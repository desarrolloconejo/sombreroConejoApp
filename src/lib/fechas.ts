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
