import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { firmarSesion, verificarSesion } from "./jwt";
import * as usuarios from "@/models/usuarios";
import type { NombreRol, Sesion, SlugCargo, UsuarioCompleto } from "@/types";

/**
 * Lectura y escritura de la sesion del lado del servidor.
 *
 * Este modulo es la segunda barrera de autorizacion, y la que de verdad
 * protege los datos. El proxy filtra por ruta, pero la documentacion de
 * Next 16 advierte que las Server Actions son peticiones POST a la ruta donde
 * se usan, de modo que un cambio en el matcher puede dejarlas fuera de su
 * alcance sin que nada avise.
 *
 * Por eso toda page protegida y toda action que lea o modifique datos empieza
 * llamando a `requerirSesion` o a `requerirRol`. El proxy evita el viaje
 * inutil; esto es lo que impide el acceso.
 */

/** Nombre de la cookie. Configurable para no chocar con otros proyectos locales. */
export function nombreCookieSesion(): string {
  return process.env.COOKIE_SESION ?? "conejo_sesion";
}

/** Ocho horas, en segundos. Debe ir en linea con JWT_EXPIRACION. */
const DURACION_COOKIE = 8 * 60 * 60;

/**
 * Devuelve la sesion de quien hace la peticion, o null si no hay ninguna.
 *
 * Va envuelta en `cache` de React para que, aunque la llamen el layout, la
 * page y varias actions dentro de la misma peticion, la firma solo se
 * verifique una vez.
 */
export const obtenerSesion = cache(async (): Promise<Sesion | null> => {
  const almacen = await cookies();
  const token = almacen.get(nombreCookieSesion())?.value;

  if (!token) return null;

  return verificarSesion(token);
});

/**
 * La persona que hace la peticion, con su ambito LEIDO DE LA BASE.
 *
 * Es la diferencia importante con `obtenerSesion`: el token guarda una foto
 * del momento en que se inicio sesion, asi que si un administrador cambia el
 * cargo o la empresa de alguien, su token sigue diciendo lo anterior hasta que
 * caduque. Aqui el dato siempre esta fresco.
 *
 * Regla: el token vale para enrutar (el proxy no puede consultar la base), y
 * esto vale para decidir QUE CONTENIDO se muestra. Cualquier page o action que
 * filtre por cargo o por empresa usa esto, nunca la sesion.
 *
 * Va envuelto en `cache` de React: una sola consulta por peticion aunque lo
 * llamen el layout, la page y varias actions.
 */
export const usuarioActual = cache(async (): Promise<UsuarioCompleto | null> => {
  const sesion = await obtenerSesion();

  if (!sesion) return null;

  return usuarios.buscarPorId(sesion.usuarioId);
});

/**
 * Igual que `usuarioActual`, pero manda al login si no hay nadie.
 *
 * Tambien echa a quien fue desactivado mientras tenia la sesion abierta: su
 * token sigue siendo valido, pero su cuenta ya no.
 */
export async function requerirUsuario(): Promise<UsuarioCompleto> {
  const usuario = await usuarioActual();

  if (!usuario || !usuario.activo) {
    redirect("/login");
  }

  return usuario;
}

/**
 * Exige que la persona tenga uno de los cargos indicados.
 *
 * El cargo es el eje que decide QUE CONTENIDO se ve, y se comprueba contra el
 * valor fresco de la base, no contra el token. El admin se salta el filtro:
 * su rol le da acceso a todas las areas.
 */
export async function requerirCargo(
  ...cargosPermitidos: SlugCargo[]
): Promise<UsuarioCompleto> {
  const usuario = await requerirUsuario();

  if (usuario.rol === "admin") return usuario;

  if (!usuario.cargoSlug || !cargosPermitidos.includes(usuario.cargoSlug)) {
    redirect("/dashboard");
  }

  return usuario;
}

/**
 * Exige que la persona sea cliente y devuelve la empresa cuyo contenido puede
 * ver. Un trabajador no pasa por aqui: su ambito es el cargo, no una empresa.
 */
export async function requerirEmpresa(): Promise<{
  usuario: UsuarioCompleto;
  empresaId: number;
}> {
  const usuario = await requerirUsuario();

  if (usuario.tipo !== "cliente" || !usuario.empresaId) {
    redirect("/dashboard");
  }

  return { usuario, empresaId: usuario.empresaId };
}

/**
 * Igual que `obtenerSesion`, pero manda al login si no hay sesion.
 * Devuelve la sesion ya garantizada, para no tener que comprobar null.
 */
export async function requerirSesion(): Promise<Sesion> {
  const sesion = await obtenerSesion();

  if (!sesion) {
    redirect("/login");
  }

  return sesion;
}

/**
 * Exige una sesion con alguno de los roles indicados.
 *
 * Quien no tiene sesion va al login. Quien la tiene pero con otro rol vuelve
 * al panel: no se le manda al login porque su sesion es valida, lo que falta
 * es permiso.
 */
export async function requerirRol(
  ...rolesPermitidos: NombreRol[]
): Promise<Sesion> {
  const sesion = await requerirSesion();

  if (!rolesPermitidos.includes(sesion.rol)) {
    redirect("/dashboard");
  }

  return sesion;
}

/** Atajo para lo que solo puede hacer un administrador. */
export async function requerirAdmin(): Promise<Sesion> {
  return requerirRol("admin");
}

/**
 * Emite el token y lo guarda en la cookie.
 *
 * `httpOnly` impide que el JavaScript de la pagina lea la cookie, que es lo
 * que limita el dano de un XSS. `sameSite: lax` evita que se envie en
 * peticiones cruzadas de terceros, sin romper la navegacion normal.
 */
export async function crearCookieSesion(sesion: Sesion): Promise<void> {
  const token = await firmarSesion(sesion);
  const almacen = await cookies();

  almacen.set(nombreCookieSesion(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACION_COOKIE,
  });
}

/** Borra la cookie de sesion. */
export async function borrarCookieSesion(): Promise<void> {
  const almacen = await cookies();

  // Se sobrescribe con valor vacio y maxAge 0 en lugar de solo borrarla, para
  // que el navegador reciba una cabecera Set-Cookie que la invalide.
  almacen.set(nombreCookieSesion(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
