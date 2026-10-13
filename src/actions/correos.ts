"use server";

import { revalidatePath } from "next/cache";

import { anotar } from "@/lib/auditoria";
import { conSesion } from "@/lib/db";
import { entregarCorreos, modoDeCorreo } from "@/lib/externos/correo";
import { requerirAdmin } from "@/lib/sesion";
import { comoIdentificador } from "@/lib/validaciones";
import * as correos from "@/models/correos";
import type { EstadoFormulario } from "@/types";

/**
 * Lo que un administrador hace con la bandeja de salida.
 *
 * Escribir un correo no esta aqui: lo hace la action del cambio que lo
 * provoca, con `encolarCorreo`, dentro de su misma transaccion.
 */

const RUTA = "/dashboard/salida";

/**
 * Deja constancia de que un correo simulado se entrego a mano.
 *
 * En modo simulado nadie recibe nada: un administrador lee el mensaje y lo
 * hace llegar por otro medio. Marcarlo es lo que lo saca de la lista de
 * pendientes, para que no se entregue dos veces ni se quede sin entregar.
 */
export async function marcarCorreoEntregado(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const admin = await requerirAdmin();

  const id = comoIdentificador(datos.get("id"));

  if (id === null) {
    return { ok: false, mensaje: "No se pudo identificar el correo" };
  }

  const marcado = await conSesion(admin, async (tx) => {
    if (!(await correos.marcarEntregado(id, admin.id, tx))) return false;

    await anotar(tx, admin, "correo.entregado_a_mano", { entidadId: id });

    return true;
  });

  if (!marcado) {
    return { ok: false, mensaje: "Ese correo ya estaba entregado o no se puede marcar" };
  }

  revalidatePath(RUTA);

  return { ok: true, mensaje: "Queda anotado como entregado a mano" };
}

/** Vuelve a intentar el envio de un correo que fallo. */
export async function reintentarCorreo(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const admin = await requerirAdmin();

  const id = comoIdentificador(datos.get("id"));

  if (id === null) {
    return { ok: false, mensaje: "No se pudo identificar el correo" };
  }

  if (modoDeCorreo() === "simulado") {
    return {
      ok: false,
      mensaje: "El correo esta en modo simulado: no hay a donde enviarlo",
    };
  }

  await conSesion(admin, (tx) =>
    anotar(tx, admin, "correo.reintentado", { entidadId: id }),
  );

  const enviados = await entregarCorreos(admin, [id]);

  revalidatePath(RUTA);

  return enviados === 1
    ? { ok: true, mensaje: "El correo se envio" }
    : { ok: false, mensaje: "No se pudo enviar. El motivo queda en el detalle" };
}
