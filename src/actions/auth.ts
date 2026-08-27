"use server";

import { redirect } from "next/navigation";
import * as usuarios from "@/models/usuarios";
import { gastarTiempoEquivalente, verificar } from "@/lib/password";
import { borrarCookieSesion, crearCookieSesion, obtenerSesion } from "@/lib/sesion";
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
 * Comprueba que el destino de la redireccion sea una ruta interna.
 *
 * El parametro `volverA` llega en la URL, asi que lo controla quien envia el
 * enlace. Sin esta comprobacion se podria construir un enlace al login propio
 * que, tras entrar, deje al usuario en un sitio ajeno: el clasico redirect
 * abierto, muy usado para phishing.
 */
function destinoSeguro(valor: unknown): string {
  if (typeof valor !== "string") return "/dashboard";

  // Debe empezar por una sola barra. "//otro-sitio.com" es una URL con
  // protocolo relativo y saldria del dominio.
  if (!valor.startsWith("/") || valor.startsWith("//")) return "/dashboard";
  if (valor.includes("\\")) return "/dashboard";

  return valor;
}

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

  // Un usuario sin fila en trabajadores ni en clientes no tiene rol, y sin rol
  // no se puede decidir que puede ver. Es un dato incompleto, no un error de
  // quien intenta entrar.
  if (!usuario.tipo || !usuario.rol) {
    return {
      ok: false,
      mensaje: "Tu cuenta no tiene un perfil asignado. Habla con un administrador",
    };
  }

  await crearCookieSesion({
    usuarioId: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    tipo: usuario.tipo,
    rol: usuario.rol,
    cargo: usuario.cargoSlug,
    empresaId: usuario.empresaId,
  });

  await usuarios.registrarAcceso(usuario.id);

  // redirect lanza una excepcion interna de Next, asi que tiene que quedar
  // fuera de cualquier try que la pudiera atrapar.
  redirect(destinoSeguro(datos.get("volverA")));
}

/** Cierra la sesion y devuelve al login. */
export async function cerrarSesion(): Promise<void> {
  await borrarCookieSesion();
  redirect("/login");
}

/**
 * Devuelve la sesion actual para las pages que la necesiten como prop.
 * Es una lectura, no una barrera: no redirige.
 */
export async function sesionActual() {
  return obtenerSesion();
}
