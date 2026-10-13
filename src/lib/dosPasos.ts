import { cookies } from "next/headers";

import { firmarPasoPendiente, verificarPasoPendiente } from "./jwt";
import { nombreCookieSesion } from "./sesion";

/**
 * El tramo entre la contrasena y el codigo.
 *
 * Quien tiene los dos pasos activados y acierta la contrasena todavia NO ha
 * entrado: no se le abre sesion. Se le deja una cookie que dice solo «esta
 * persona ya paso el primer paso», valida cinco minutos, y con ella va a la
 * pantalla del codigo.
 *
 * Esa cookie no sirve para nada mas: no es una sesion, las guardias no la
 * miran, y ninguna pantalla del panel se abre con ella.
 */

/** Cinco minutos para ir a por el telefono y teclear el codigo. */
const DURACION = 5 * 60;

function nombreCookie(): string {
  return `${nombreCookieSesion()}_paso2`;
}

/** Deja constancia de que alguien acerto su contrasena y falta el codigo. */
export async function abrirPasoPendiente(usuarioId: number, volverA: string): Promise<void> {
  const token = await firmarPasoPendiente(usuarioId, volverA, DURACION);

  (await cookies()).set(nombreCookie(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACION,
  });
}

/** Quien esta a medio entrar, o null si no hay nadie o ya caduco. */
export async function pasoPendiente(): Promise<{ usuarioId: number; volverA: string } | null> {
  const token = (await cookies()).get(nombreCookie())?.value;

  return token ? verificarPasoPendiente(token) : null;
}

/** Retira la cookie: se uso, o hay que empezar de nuevo. */
export async function cerrarPasoPendiente(): Promise<void> {
  (await cookies()).set(nombreCookie(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
