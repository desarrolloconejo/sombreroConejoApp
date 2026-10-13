"use server";

import { redirect } from "next/navigation";
import * as usuarios from "@/models/usuarios";
import { gastarTiempoEquivalente, verificar } from "@/lib/password";
import { destinoSeguro } from "@/lib/redireccion";
import { abrirSesion, cerrarSesionActual } from "@/lib/sesion";
import { validarCredenciales } from "@/lib/validaciones";
import type { EstadoFormulario } from "@/types";

/**
 * Autenticacion: entrar y salir.
 *
 * Las actions coordinan; no consultan la base de datos por su cuenta ni saben
 * de criptografia. Piden los datos a los modelos y las comprobaciones a lib.
 */

/**
 * Un solo mensaje para "ese correo no existe" y para "la contrasena no es
 * correcta".
 *
 * Distinguirlos seria mas comodo, pero convertiria el formulario en una via
 * para averiguar que correos estan registrados.
 */
const CREDENCIALES_INVALIDAS = "El correo o la contrasena no son correctos";

/**
 * Inicia sesion. La consume un formulario a traves de useActionState.
 *
 * Devuelve el estado del formulario cuando algo falla; cuando todo va bien no
 * devuelve nada porque redirige.
 */
export async function iniciarSesion(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const { valores, errores, valido } = validarCredenciales(datos);

  if (!valido) {
    return { ok: false, errores };
  }

  const usuario = await usuarios.buscarPorEmailConCredenciales(valores.email);

  if (!usuario) {
    // Se gasta el mismo tiempo que costaria comprobar una contrasena real,
    // para que la duracion de la respuesta no delate si el correo existe.
    await gastarTiempoEquivalente(valores.password);
    return { ok: false, mensaje: CREDENCIALES_INVALIDAS };
  }

  const coincide = await verificar(valores.password, usuario.passwordHash);

  if (!coincide) {
    return { ok: false, mensaje: CREDENCIALES_INVALIDAS };
  }

  // A partir de aqui las credenciales ya son correctas, asi que se puede ser
  // concreto: quien esta al otro lado es quien dice ser.
  if (!usuario.activo) {
    return {
      ok: false,
      mensaje: "Tu cuenta esta desactivada. Habla con un administrador",
    };
  }

  // Un cliente entra en nombre de su empresa: si la agencia dejo de atenderla,
  // sus personas pierden el acceso aunque su cuenta siga activa.
  if (usuario.tipo === "cliente" && usuario.empresaActiva === false) {
    return {
      ok: false,
      mensaje: "Tu empresa esta desactivada. Habla con la agencia",
    };
  }

  // Un usuario sin fila en trabajadores ni en clientes no tiene rol, y sin rol
  // no se puede decidir que puede ver. Es un dato incompleto, no un error de
  // quien intenta entrar.
  if (!usuario.tipo || !usuario.rol) {
    return {
      ok: false,
      mensaje: "Tu cuenta no tiene un perfil asignado. Habla con un administrador",
    };
  }

  await abrirSesion(usuario);

  await usuarios.registrarAcceso(usuario.id);

  // redirect lanza una excepcion interna de Next, asi que tiene que quedar
  // fuera de cualquier try que la pudiera atrapar.
  redirect(destinoSeguro(datos.get("volverA")));
}

/** Cierra la sesion y devuelve al login. */
export async function cerrarSesion(): Promise<void> {
  await cerrarSesionActual();
  redirect("/login");
}
