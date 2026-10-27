import { anotar } from "@/lib/auditoria";
import { conSistema } from "@/lib/db";
import { consultarTasas } from "@/lib/externos/tasaCambio";
import { notificarAAdministradores } from "@/lib/notificaciones";
import * as tasas from "@/models/tasas";
import type { ResultadoDeTasas } from "@/types";

import { saltoIncreible } from "./tasaBcv";

/**
 * Lee las tasas de la fuente y guarda las que sean nuevas.
 *
 * La llama la tarea programada, que no es ninguna persona: por eso escribe
 * con `conSistema` y sus lineas de auditoria van sin actor.
 *
 * UNA LECTURA RARA NO SE GUARDA
 * -----------------------------
 * Con esta tasa se emiten facturas. Si la pagina no se pudo leer, o lo leido
 * no cuadra con lo anterior, no se escribe nada: se anota el rechazo y se
 * notifica a los administradores, que pueden registrar la tasa a mano.
 *
 * NUNCA LANZA por un problema de la fuente. Si lanza, es que fallo la base.
 *
 * Cada corrida queda en finanzas.lecturas_tasa, tambien la que no trae nada
 * nuevo: es lo que Ajustes de finanzas muestra para que se sepa si la app ya
 * lo intento hoy y si toca registrar la tasa a mano.
 */
export async function actualizarTasas(): Promise<ResultadoDeTasas> {
  // La lectura va FUERA de la transaccion: no se espera a un servidor ajeno
  // con una conexion a la base tomada.
  const consulta = await consultarTasas();

  if (!consulta.ok) {
    await rechazar(consulta.motivo);
    return { ok: false, motivo: consulta.motivo };
  }

  const { lectura } = consulta;

  return conSistema(async (tx) => {
    const anteriores = await tasas.ultimasAntesDe(lectura.fuente, lectura.fechaValor, tx);
    const salto = saltoIncreible(lectura.tasas, anteriores);

    if (salto) {
      const motivo = `La lectura no es creible: ${salto}`;
      await dejarConstanciaDelRechazo(tx, motivo, lectura.fechaValor);
      return { ok: false as const, motivo };
    }

    const nuevas = await tasas.registrarLectura(lectura, tx);

    await tasas.anotarLectura(
      {
        resultado: nuevas > 0 ? "registrada" : "sin_novedad",
        fechaValor: lectura.fechaValor,
        motivo: null,
      },
      tx,
    );

    // Solo se anota cuando entra algo: la tarea lee varias veces la misma
    // fecha valor, y una linea por cada lectura sin novedad seria ruido.
    if (nuevas > 0) {
      const dolar = lectura.tasas.find((tasa) => tasa.moneda === "USD");

      await anotar(tx, null, "tasa.registrada", {
        despues: {
          fuente: lectura.fuente,
          fechaValor: lectura.fechaValor,
          monedas: nuevas,
          usd: dolar?.valor ?? null,
        },
      });
    }

    return {
      ok: true as const,
      fechaValor: lectura.fechaValor,
      nuevas,
      leidas: lectura.tasas.length,
    };
  });
}

/** Anota el rechazo y se lo dice a los administradores. */
async function dejarConstanciaDelRechazo(
  tx: Parameters<Parameters<typeof conSistema>[0]>[0],
  motivo: string,
  fechaValor: string | null,
): Promise<void> {
  await tasas.anotarLectura({ resultado: "rechazada", fechaValor, motivo }, tx);
  await anotar(tx, null, "tasa.rechazada", { despues: { motivo } });

  await notificarAAdministradores(tx, {
    tipo: "tasa.rechazada",
    titulo: "No se pudo actualizar la tasa del BCV",
    cuerpo: motivo,
    href: "/dashboard/auditoria?modulo=tasa",
  });
}

async function rechazar(motivo: string): Promise<void> {
  await conSistema((tx) => dejarConstanciaDelRechazo(tx, motivo, null));
}
