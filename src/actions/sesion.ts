"use server";

import { revalidatePath } from "next/cache";

import {
  obtenerSesion,
  renovarSesionActual,
  requerirUsuario,
} from "@/lib/sesion";
import * as sesiones from "@/models/sesiones";
import type { EstadoFormulario, EstadoRenovacion } from "@/types";

/**
 * Lo que una persona hace con su propia sesion: mantenerla viva y cerrar las
 * que tenga abiertas en otros sitios.
 *
 * Entrar y salir estan en `actions/auth.ts`.
 */

/**
 * Pide un acceso nuevo con el token de renovacion.
 *
 * NO empieza por una guardia, y es la unica action que no lo hace: su trabajo
 * es justo atender a quien tiene el acceso vencido, y una guardia lo
 * rechazaria. La comprobacion que hace en su lugar es mas estricta —el token
 * de renovacion contra la base, y la persona leida de nuevo— y vive en
 * `renovarSesionActual`.
 *
 * No recibe argumentos: todo lo que usa viaja en cookies `httpOnly`, asi que
 * no hay nada que quien llama pueda falsear.
 */
export async function renovarSesion(): Promise<EstadoRenovacion> {
  return renovarSesionActual();
}

/**
 * Cierra todas las sesiones de quien llama salvo la que esta usando.
 *
 * La consume `useActionState`, pero no declara sus dos argumentos porque no
 * usa ninguno: no hay nada que enviar, y sobre quien se actua sale de la
 * sesion.
 */
export async function cerrarOtrasSesiones(): Promise<EstadoFormulario> {
  const usuario = await requerirUsuario();
  const sesion = await obtenerSesion();

  const cerradas = await sesiones.revocarDeUsuario(
    usuario.id,
    "cerrada_por_usuario",
    sesion?.sesionId ?? null,
  );

  revalidatePath("/dashboard/perfil");

  return {
    ok: true,
    mensaje:
      cerradas === 0
        ? "No habia otras sesiones abiertas"
        : cerradas === 1
          ? "Se cerro la otra sesion"
          : `Se cerraron las otras ${cerradas} sesiones`,
  };
}
