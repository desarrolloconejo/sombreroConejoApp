import { hoyEnCaracas, ZONA_HORARIA } from "@/lib/fechas";
import type { LecturaTasa } from "@/types";

/**
 * Cuando corre la tarea diaria de la tasa y que significa su ultima corrida.
 *
 * Vercel, en el plan gratuito, solo deja una tarea al dia. Corre a las 18:30
 * de Caracas (22:30 UTC), despues de que el BCV publica. La programacion vive
 * en `vercel.json`; `tests/unitarias/programacionTasa.spec.ts` comprueba que
 * coincide con esta.
 */

/** La expresion de `vercel.json`. Caracas no cambia de hora: UTC-4 todo el ano. */
export const CRON_TASA = "30 22 * * *";
const HORA_UTC = 22;
const MINUTO_UTC = 30;

/** Pasado este margen sin corrida de hoy, algo fallo en la plataforma. */
const MARGEN_MINUTOS = 30;

/**
 * El turno de la tarea del dia de hoy EN CARACAS. Entre las 20:00 y las 24:00
 * de Caracas en UTC ya es manana; el dia que cuenta es el de aqui. Las 22:30
 * UTC caen el mismo dia en Caracas (18:30).
 */
function turnoDe(ahora: Date): Date {
  const [ano, mes, dia] = hoyEnCaracas(ahora).split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia, HORA_UTC, MINUTO_UTC));
}

/** La proxima vez que correra la tarea, a partir de `ahora`. */
export function proximaCorrida(ahora: Date = new Date()): Date {
  const turno = turnoDe(ahora);
  if (ahora < turno) return turno;
  return new Date(turno.getTime() + 24 * 60 * 60 * 1000);
}

const HORA = new Intl.DateTimeFormat("es-VE", {
  timeZone: ZONA_HORARIA,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const DIA = new Intl.DateTimeFormat("es-VE", {
  timeZone: ZONA_HORARIA,
  day: "2-digit",
  month: "2-digit",
});

/** «hoy a las 6:30 p. m.», «manana a las…», o con fecha si es otro dia. */
export function cuandoEs(fecha: Date, ahora: Date = new Date()): string {
  const hoy = hoyEnCaracas(ahora);
  const manana = hoyEnCaracas(new Date(ahora.getTime() + 24 * 60 * 60 * 1000));
  const ayer = hoyEnCaracas(new Date(ahora.getTime() - 24 * 60 * 60 * 1000));
  const dia = hoyEnCaracas(fecha);
  const hora = HORA.format(fecha);

  if (dia === hoy) return `hoy a las ${hora}`;
  if (dia === manana) return `manana a las ${hora}`;
  if (dia === ayer) return `ayer a las ${hora}`;
  return `el ${DIA.format(fecha)} a las ${hora}`;
}

function diaDeValor(fechaValor: string): string {
  const [ano, mes, dia] = fechaValor.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Lo que se le dice a quien opera finanzas sobre la tarea de hoy. */
export type SituacionTasa = {
  /** ok: no hay nada que hacer; aviso: conviene mirar; manual: toca registrarla a mano. */
  tono: "ok" | "aviso" | "manual";
  titulo: string;
  detalle: string;
  proxima: string;
};

/**
 * Lee las ultimas corridas de la tarea (la mas reciente primero) y dice si la
 * app ya lo hizo hoy, como le fue, y si le toca a una persona registrar la
 * tasa a mano.
 *
 * Si hoy hubo una corrida que registro la tasa, manda esa: una posterior sin
 * novedad, o rechazada, no cambia que la tasa de hoy ya esta.
 */
export function situacionTasa(lecturas: LecturaTasa[], ahora: Date = new Date()): SituacionTasa {
  const hoy = hoyEnCaracas(ahora);
  const ultima =
    lecturas.find((l) => l.resultado === "registrada" && hoyEnCaracas(l.leidaEn) === hoy) ??
    lecturas[0] ??
    null;
  // Sin punto final: la hora ya acaba en «p. m.».
  const proxima = `Proxima lectura automatica: ${cuandoEs(proximaCorrida(ahora), ahora)}`;
  const turnoHoy = turnoDe(ahora);
  const yaDebia = ahora.getTime() > turnoHoy.getTime() + MARGEN_MINUTOS * 60 * 1000;
  const corrioHoy = ultima !== null && hoyEnCaracas(ultima.leidaEn) === hoyEnCaracas(ahora);

  if (!ultima) {
    return {
      tono: yaDebia ? "manual" : "aviso",
      titulo: "La app todavia no ha leido la tasa nunca",
      detalle: yaDebia
        ? "Ya paso la hora de la tarea y no hay registro de que corriera: revisa la tarea programada en Vercel y, mientras, registra la tasa a mano."
        : "La primera lectura sera a la hora de la tarea. Si la necesitas antes, registrala a mano.",
      proxima,
    };
  }

  const cuando = cuandoEs(ultima.leidaEn, ahora);

  if (!corrioHoy) {
    const anterior =
      ultima.resultado === "rechazada"
        ? `La ultima vez (${cuando}) no pudo leerla: ${ultima.motivo}.`
        : `La ultima vez fue ${cuando}.`;

    if (yaDebia) {
      return {
        tono: "manual",
        titulo: "Hoy la app no ha leido la tasa",
        detalle: `Debia hacerlo ${cuandoEs(turnoHoy, ahora)} y no hay registro. ${anterior} Registra la tasa a mano y revisa la tarea programada en Vercel.`,
        proxima,
      };
    }

    return {
      tono: ultima.resultado === "rechazada" ? "manual" : "ok",
      titulo: "Hoy la app todavia no ha leido la tasa",
      detalle: `Lo hara ${cuandoEs(turnoHoy, ahora)}. ${anterior}${
        ultima.resultado === "rechazada" ? " Si necesitas facturar antes, registrala a mano." : ""
      }`,
      proxima,
    };
  }

  if (ultima.resultado === "registrada") {
    return {
      tono: "ok",
      titulo: "La app ya registro la tasa de hoy",
      detalle: `La leyo del BCV ${cuando}: la del ${diaDeValor(ultima.fechaValor ?? "")}. No hace falta registrarla a mano.`,
      proxima,
    };
  }

  if (ultima.resultado === "sin_novedad") {
    return {
      tono: "aviso",
      titulo: "La app ya reviso hoy: el BCV no ha publicado una nueva",
      detalle: `Leyo ${cuando} y el BCV seguia con la del ${diaDeValor(ultima.fechaValor ?? "")}, que ya estaba registrada. Pasa los fines de semana y feriados. Si sabes que hay una nueva, registrala a mano.`,
      proxima,
    };
  }

  return {
    tono: "manual",
    titulo: "La app lo intento hoy y no pudo",
    detalle: `Lo intento ${cuando}: ${ultima.motivo}. Registra la tasa a mano; no se reintenta hasta la proxima lectura.`,
    proxima,
  };
}
