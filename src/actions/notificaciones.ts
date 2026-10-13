"use server";

import { revalidatePath } from "next/cache";

import { conSesion } from "@/lib/db";
import { requerirUsuario } from "@/lib/sesion";
import * as notificaciones from "@/models/notificaciones";

/**
 * Marca como leidas las notificaciones de quien llama.
 *
 * La invoca la campana al abrirse: ver la lista ES leerla. No recibe
 * argumentos: de quien son sale de la sesion, y la base no deja tocar las de
 * nadie mas.
 *
 * No se anota en la auditoria: leer una notificacion no cambia nada del
 * negocio, y llenaria el registro de ruido.
 */
export async function marcarNotificacionesLeidas(): Promise<void> {
  const usuario = await requerirUsuario();

  const marcadas = await conSesion(usuario, (tx) =>
    notificaciones.marcarTodasLeidas(tx),
  );

  // La campana vive en el layout: sin esto seguiria mostrando el contador
  // viejo hasta la siguiente carga completa.
  if (marcadas > 0) revalidatePath("/dashboard", "layout");
}
