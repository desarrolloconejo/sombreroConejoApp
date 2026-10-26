import { conSesion, type ActorDeBase, type Ejecutor } from "./db";
import * as asignaciones from "@/models/asignaciones";
import * as notificaciones from "@/models/notificaciones";
import * as usuarios from "@/models/usuarios";
import type { NuevaNotificacion, ResumenDeNotificaciones } from "@/types";

/**
 * Lo que las actions usan para notificar a alguien.
 *
 * La regla es la misma que con la auditoria y el correo: la notificacion se
 * escribe en la MISMA transaccion que el cambio que la provoca, y esa
 * transaccion tiene que venir de `conSesion`, porque la tabla tiene seguridad
 * por fila.
 */

/** Cuantas muestra la campana al abrirse. */
const EN_LA_CAMPANA = 12;

/** Notifica a las personas indicadas. */
export async function notificarA(
  ejecutor: Ejecutor,
  destinatarios: readonly number[],
  notificacion: NuevaNotificacion,
): Promise<void> {
  await notificaciones.crear(destinatarios, notificacion, ejecutor);
}

/**
 * Notifica a los ejecutivos de cuentas que atienden una empresa: lo que pasa
 * con el dinero o los proyectos de su cliente tambien es asunto suyo.
 */
export async function notificarAEjecutivosDe(
  ejecutor: Ejecutor,
  empresaId: number,
  notificacion: NuevaNotificacion,
): Promise<void> {
  await notificaciones.crear(await asignaciones.ejecutivosDe(empresaId, ejecutor), notificacion, ejecutor);
}

/**
 * Notifica a todos los administradores activos.
 *
 * `salvo` deja fuera a una persona: quien provoca algo no necesita que le
 * cuenten lo que acaba de hacer.
 */
export async function notificarAAdministradores(
  ejecutor: Ejecutor,
  notificacion: NuevaNotificacion,
  salvo: number | null = null,
): Promise<void> {
  const administradores = await usuarios.idsDeAdministradores(salvo, ejecutor);

  await notificaciones.crear(administradores, notificacion, ejecutor);
}

/**
 * Lo que la campana necesita para pintarse: las ultimas y cuantas quedan sin
 * leer. Lo pide el layout, una vez por carga.
 */
export async function resumenDeNotificaciones(
  actor: ActorDeBase,
): Promise<ResumenDeNotificaciones> {
  return conSesion(actor, async (tx) => ({
    recientes: await notificaciones.recientes(EN_LA_CAMPANA, tx),
    sinLeer: await notificaciones.contarSinLeer(tx),
  }));
}
