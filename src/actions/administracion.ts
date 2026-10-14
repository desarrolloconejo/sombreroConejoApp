"use server";

import { revalidatePath } from "next/cache";

import { anotar } from "@/lib/auditoria";
import { conSesion, esErrorPostgres } from "@/lib/db";
import { numeroDe } from "@/lib/finanzas/documentos";
import {
  RUTA_ADMINISTRACION,
  RUTA_PRESUPUESTOS,
  rutaMiPresupuesto,
  rutaPresupuesto,
} from "@/lib/finanzas/rutas";
import { leerMotivo } from "@/lib/finanzas/validar";
import { notificarA } from "@/lib/notificaciones";
import { requerirFinanzasDeEmpresa } from "@/lib/sesion";
import { comoIdentificador } from "@/lib/validaciones";
import * as presupuestos from "@/models/presupuestos";
import * as usuarios from "@/models/usuarios";
import type { EstadoFormulario } from "@/types";

/**
 * Lo que el cliente hace en Administracion: aprobar o rechazar un presupuesto.
 *
 * Solo quien tiene el permiso de finanzas de su empresa. No hay UPDATE del
 * cliente sobre presupuestos: la decision pasa por
 * `finanzas.cliente_resuelve_presupuesto`, que solo toca el estado, quien,
 * cuando y el motivo, y rechaza si ya no esta pendiente o vencio.
 */
export async function resolverPresupuesto(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const { usuario } = await requerirFinanzasDeEmpresa();

  const id = comoIdentificador(datos.get("id"));
  if (id === null) return { ok: false, mensaje: "No se encontro el presupuesto" };

  const aprobar = datos.get("decision") === "aprobar";
  const motivo = leerMotivo(datos);

  if (!aprobar && !motivo) {
    return { ok: false, errores: { motivo: "Cuentanos por que lo rechazas" } };
  }

  let resultado: { error: string } | { ok: true };

  try {
    resultado = await conSesion(usuario, async (tx) => {
      const actual = await presupuestos.buscarPorId(id, tx);
      if (!actual) return { error: "No se encontro el presupuesto" };

      await presupuestos.resolverComoCliente(id, aprobar, motivo, tx);

      await anotar(tx, usuario, aprobar ? "presupuesto.aprobado" : "presupuesto.rechazado", {
        entidadId: id,
        empresaId: actual.empresaId,
        despues: { total: actual.total, motivo },
      });

      // Quien opera finanzas se entera en la campana: si lo aprobo, toca
      // generar la proforma.
      const numero = numeroDe("presupuesto", actual.numero);
      await notificarA(tx, await usuarios.operadoresDeFinanzas(tx), {
        tipo: "presupuesto.resuelto",
        titulo: aprobar
          ? `${actual.empresaNombre} aprobo ${numero}`
          : `${actual.empresaNombre} rechazo ${numero}`,
        cuerpo: aprobar ? `«${actual.titulo}». Ya puedes generar la proforma.` : motivo,
        href: rutaPresupuesto(id),
        empresaId: actual.empresaId,
      });

      return { ok: true as const };
    });
  } catch (error) {
    if (esErrorPostgres(error, "23514")) {
      return { ok: false, mensaje: "Este presupuesto ya no esta pendiente, o su validez paso" };
    }
    if (esErrorPostgres(error, "42501")) {
      return { ok: false, mensaje: "No tienes permiso para decidir sobre este presupuesto" };
    }
    throw error;
  }

  if ("error" in resultado) return { ok: false, mensaje: resultado.error };

  revalidatePath(RUTA_ADMINISTRACION);
  revalidatePath(rutaMiPresupuesto(id));
  revalidatePath(RUTA_PRESUPUESTOS);

  return {
    ok: true,
    mensaje: aprobar ? "Presupuesto aprobado. Gracias" : "Presupuesto rechazado. Lo revisaremos",
  };
}
