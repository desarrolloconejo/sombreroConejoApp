import { FASES, FASES_DE_TRABAJO, RUTAS_DE_CORRECCION } from "./catalogo";
import type {
  AlertaPieza,
  EstadoFase,
  EstadoPieza,
  EstadoTarea,
  NumeroFase,
  TipoCorreccion,
  TipoProyecto,
} from "@/types";

/**
 * Las reglas de la bateria como funciones puras.
 *
 * Las usan las actions para decidir, y las pruebas unitarias para fijarlas.
 * El avance que se muestra lo calcula la base (`portal.v_progreso_*`); el de
 * aqui es el mismo calculo, y las pruebas comprueban que coinciden.
 */

/** Lo minimo de una fase para razonar sobre ella. */
export type EstadoDeFase = { fase: NumeroFase; estado: EstadoFase };

/** La primera fase no completada, o null si la pieza esta aprobada. */
export function faseActual(fases: readonly EstadoDeFase[]): NumeroFase | null {
  const pendiente = [...fases]
    .sort((a, b) => a.fase - b.fase)
    .find((fase) => fase.estado !== "completada");

  return pendiente?.fase ?? null;
}

/** El avance de una pieza: veinte puntos por fase completada. */
export function porcentajePieza(fases: readonly EstadoDeFase[]): number {
  return fases.filter((fase) => fase.estado === "completada").length * 20;
}

/**
 * El avance de un proyecto: fases completadas entre cinco por pieza.
 *
 * Solo cuentan las piezas activas. Redondea a dos decimales, igual que la
 * vista.
 */
export function porcentajeProyecto(
  piezas: readonly { estado: EstadoPieza; fases: readonly EstadoDeFase[] }[],
): number {
  const activas = piezas.filter((pieza) => pieza.estado === "activa");

  if (activas.length === 0) return 0;

  const completadas = activas.reduce(
    (total, pieza) =>
      total + pieza.fases.filter((fase) => fase.estado === "completada").length,
    0,
  );

  return Math.round((10000 * completadas) / (5 * activas.length)) / 100;
}

/** Si una fase lleva tareas. */
export function esFaseDeTrabajo(fase: NumeroFase): fase is 1 | 3 {
  return (FASES_DE_TRABAJO as readonly number[]).includes(fase);
}

/** Por que no se puede completar una fase, o null si se puede. */
export function motivoParaNoCompletar(
  fases: readonly EstadoDeFase[],
  fase: NumeroFase,
  tareas: readonly { estado: EstadoTarea }[],
): string | null {
  if (fase === 5) {
    return "La fase 5 la decide el cliente al revisar la pieza.";
  }

  const actual = faseActual(fases);

  if (actual === null) return "La pieza ya esta aprobada.";
  if (actual !== fase) return `Solo se puede completar la fase en curso, que es la ${actual}.`;

  if (esFaseDeTrabajo(fase)) {
    const pendientes = tareas.filter((tarea) => tarea.estado !== "lista").length;

    if (pendientes > 0) {
      return pendientes === 1
        ? "Falta una tarea por marcar como lista."
        : `Faltan ${pendientes} tareas por marcar como listas.`;
    }
  }

  return null;
}

/**
 * La fase que se puede regresar: la ultima completada, mientras la pieza no
 * este aprobada. Null si no hay ninguna.
 */
export function faseQueSePuedeRegresar(
  fases: readonly EstadoDeFase[],
): NumeroFase | null {
  const actual = faseActual(fases);

  if (actual === null || actual === 1) return null;

  return (actual - 1) as NumeroFase;
}

/** La ruta que sigue una correccion del cliente. */
export function rutaDeCorreccion(tipo: TipoProyecto, correccion: TipoCorreccion) {
  return RUTAS_DE_CORRECCION[tipo][correccion];
}

/**
 * Como quedan las fases tras una correccion: las de la ruta vuelven a
 * pendiente, y la menor de ellas pasa a estar en curso.
 */
export function aplicarCorreccion(
  fases: readonly EstadoDeFase[],
  reabre: readonly NumeroFase[],
): EstadoDeFase[] {
  const primera = Math.min(...reabre) as NumeroFase;

  return FASES.map((numero) => {
    const anterior = fases.find((fase) => fase.fase === numero);
    let estado: EstadoFase = anterior?.estado ?? "pendiente";

    if (reabre.includes(numero)) estado = numero === primera ? "en_curso" : "pendiente";

    return { fase: numero, estado };
  });
}

/** El dia de hoy en Caracas, como AAAA-MM-DD. */
export function hoyEnCaracas(ahora: Date = new Date()): string {
  // en-CA escribe las fechas como AAAA-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

/** Suma dias a una fecha AAAA-MM-DD, sin pasar por ninguna zona horaria. */
export function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const utc = new Date(Date.UTC(anio, mes - 1, dia + dias));

  return utc.toISOString().slice(0, 10);
}

/**
 * Las alertas de una pieza. Es el mismo criterio que `portal.v_progreso_pieza`:
 * la vista es la que se usa para pintar, esto es para razonar y probar.
 */
export function alertasDePieza(
  pieza: {
    estado: EstadoPieza;
    ronda: number;
    faseActual: NumeroFase | null;
    fechaEstimadaActual: string | null;
  },
  hoy: string,
): AlertaPieza[] {
  if (pieza.estado !== "activa" || pieza.faseActual === null) return [];

  const alertas: AlertaPieza[] = [];
  const fecha = pieza.fechaEstimadaActual;

  // Las fechas AAAA-MM-DD se comparan bien como texto.
  if (fecha !== null && fecha >= hoy && fecha <= sumarDias(hoy, 2)) alertas.push("por_vencer");
  if (fecha !== null && fecha < hoy) alertas.push("atrasada");
  if (pieza.faseActual === 5) alertas.push("esperando_cliente");
  if (pieza.ronda > 1) alertas.push("en_correccion");

  return alertas;
}
