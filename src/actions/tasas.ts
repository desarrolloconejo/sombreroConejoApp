"use server";

import { revalidatePath } from "next/cache";

import { anotar } from "@/lib/auditoria";
import { conSesion } from "@/lib/db";
import { RUTA_AJUSTES_FINANZAS, RUTA_FACTURAS } from "@/lib/finanzas/rutas";
import { leerTasa } from "@/lib/finanzas/pagos";
import { saltoIncreible } from "@/lib/finanzas/tasaBcv";
import { fechaValida } from "@/lib/finanzas/validar";
import { hoyEnCaracas } from "@/lib/portal/fases";
import { requerirFinanzas } from "@/lib/sesion";
import * as tasas from "@/models/tasas";
import type { EstadoFormulario } from "@/types";

/**
 * Registrar a mano la tasa del dolar del BCV, para cuando la lectura diaria
 * falla. Sin ninguna tasa no se puede facturar.
 *
 * La tabla es un historico: una fecha que ya tiene tasa no se pisa. Un salto
 * de mas del 25 % respecto a la anterior pide confirmarlo, porque con esa
 * tasa se emiten facturas que no cambian.
 */
export async function registrarTasa(_estadoPrevio: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const usuario = await requerirFinanzas();

  const fechaValor = String(datos.get("fechaValor") ?? "");
  const valor = leerTasa(String(datos.get("valor") ?? ""));

  const errores: Record<string, string> = {};
  if (!fechaValida(fechaValor)) errores.fechaValor = "Indica la fecha de la tasa";
  else if (fechaValor > hoyEnCaracas()) errores.fechaValor = "No puede ser una fecha futura";
  if (!valor) errores.valor = "Escribe la tasa: bolivares por dolar, con hasta ocho decimales";
  if (Object.keys(errores).length > 0 || !valor) return { ok: false, errores };

  const resultado = await conSesion(usuario, async (tx) => {
    // Primero, si la fecha ya tiene tasa: eso no se arregla confirmando nada.
    if (await tasas.hayTasaDel("bcv", "USD", fechaValor, tx)) return { repetida: true };

    const anteriores = await tasas.ultimasAntesDe("bcv", fechaValor, tx);
    const salto = saltoIncreible([{ moneda: "USD", valor }], anteriores);
    if (salto && datos.get("confirmoSalto") !== "si") return { salto };

    if (!(await tasas.registrarManual({ fuente: "bcv", moneda: "USD", fechaValor, valor }, usuario.id, tx))) {
      return { repetida: true };
    }

    await anotar(tx, usuario, "tasa.registrada", {
      despues: { fuente: "bcv", fechaValor, usd: valor, origen: "manual", conSalto: salto !== null },
    });
    return { ok: true };
  });

  if ("salto" in resultado) {
    return {
      ok: false,
      errores: { confirmoSalto: `Revisala: ${resultado.salto}. Si es correcta, marca la casilla y guarda otra vez.` },
    };
  }
  if ("repetida" in resultado) {
    return { ok: false, errores: { fechaValor: "Ya hay una tasa para ese dia: no se pisa" } };
  }

  revalidatePath(RUTA_AJUSTES_FINANZAS);
  revalidatePath(RUTA_FACTURAS);
  return { ok: true, mensaje: "Tasa registrada" };
}
