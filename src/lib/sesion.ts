import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { firmarSesion, verificarSesion } from "./jwt";
import { describirNavegador, generarToken, hashDeToken } from "./tokens";
import * as sesiones from "@/models/sesiones";
import * as usuarios from "@/models/usuarios";
import type {
  EstadoRenovacion,
  NombreRol,
  Sesion,
  SlugCargo,
  UsuarioCompleto,
} from "@/types";

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
 * llamando a una guardia: `requerirUsuario`, `requerirRol` o `requerirCargo`.
 *
 * COMO ESTA HECHA UNA SESION
 * --------------------------
 * Son dos cookies y una fila:
 *
 * - El token de ACCESO: un JWT de media hora. Con el enruta el proxy, que no
 *   puede consultar la base.
 * - El token de RENOVACION: un valor al azar. Sirve para pedir otro acceso.
 * - La fila de `sesiones`, donde vive la autoridad: el hash del token de
 *   renovacion, cuando caduca la sesion y si se revoco.
 *
 * Las guardias comprueban la fila en cada peticion, asi que revocarla cierra
 * la sesion de inmediato y no cuando caduque el acceso.
 */

/** Nombre de la cookie. Configurable para no chocar con otros proyectos locales. */
export function nombreCookieSesion(): string {
  return process.env.COOKIE_SESION ?? "conejo_sesion";
}

/** La cookie del token de renovacion cuelga del nombre de la de acceso. */
export function nombreCookieRenovacion(): string {
  return `${nombreCookieSesion()}_renovacion`;
}

/**
 * Tope absoluto de una sesion, en segundos. Doce horas.
 *
 * Aunque se renueve sin parar, a las doce horas de haber entrado termina: se
 * entra una vez al dia.
 */
export function duracionSesion(): number {
  const horas = Number(process.env.SESION_HORAS);

  return (Number.isFinite(horas) && horas > 0 ? horas : 12) * 60 * 60;
}

/**
 * Cuanto puede pasar sin actividad antes de avisar, en milisegundos.
 *
 * Mientras la persona trabaja el acceso se renueva solo. Si lleva este rato
 * sin tocar nada, al acercarse la caducidad se le pregunta.
 */
export function inactividadPermitida(): number {
  const minutos = Number(process.env.SESION_INACTIVIDAD_MINUTOS);

  return (Number.isFinite(minutos) && minutos > 0 ? minutos : 15) * 60 * 1000;
}

/**
 * A donde va quien tiene un token valido pero ya no puede entrar.
 *
 * No puede ser `/login` a secas: el proxy ve un token que verifica y lo
 * devuelve al panel, y el panel lo vuelve a echar. Con este parametro el proxy
 * borra las cookies y deja pasar, y el login explica el motivo.
 */
const SALIDA_FORZADA = "/login?motivo=sin-acceso";

/** Lo mismo, cuando lo que ya no vale es la sesion y no la cuenta. */
const SESION_CERRADA = "/login?motivo=caducada";

/** Atributos comunes a las dos cookies de la sesion. */
function opcionesCookie(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

/**
 * Devuelve la sesion de quien hace la peticion, o null si no hay ninguna.
 *
 * Solo dice que el token de acceso verifica; no dice que la sesion siga
 * viva. Vale para enrutar y para saber de quien es la peticion, nunca para
 * autorizar: para eso estan las guardias.
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
 * del momento en que se emitio. Aqui el dato siempre esta fresco, y ademas se
 * comprueba que la sesion no se haya revocado: una sesion cerrada desde el
 * servidor devuelve null aunque su token todavia verifique.
 *
 * Regla: el token vale para enrutar (el proxy no puede consultar la base), y
 * esto vale para decidir QUE se muestra y QUE se puede hacer.
 *
 * Va envuelto en `cache` de React: una sola consulta por peticion aunque lo
 * llamen el layout, la page y varias actions.
 */
export const usuarioActual = cache(async (): Promise<UsuarioCompleto | null> => {
  return (await personaYSesion())?.usuario ?? null;
});

/** La persona junto con su sesion, en la unica consulta que hacen las guardias. */
const personaYSesion = cache(async () => {
  const sesion = await obtenerSesion();

  if (!sesion) return null;

  const encontrado = await usuarios.buscarPorIdConSesion(
    sesion.usuarioId,
    sesion.sesionId,
  );

  if (!encontrado || !encontrado.sesionCaducaEn) return null;

  return {
    usuario: encontrado.usuario,
    accesoCaducaEn: sesion.accesoCaducaEn,
    sesionCaducaEn: encontrado.sesionCaducaEn.getTime(),
  };
});

/**
 * Las dos horas que necesita el reloj del navegador: cuando caduca el acceso
 * y cuando termina la sesion. Las inyecta el layout al guardian de sesion.
 */
export async function relojDeSesion(): Promise<{
  accesoCaducaEn: number;
  sesionCaducaEn: number;
} | null> {
  const datos = await personaYSesion();

  if (!datos) return null;

  return {
    accesoCaducaEn: Math.min(datos.accesoCaducaEn, datos.sesionCaducaEn),
    sesionCaducaEn: datos.sesionCaducaEn,
  };
}

/**
 * Si la cuenta puede seguir dentro, mirando el dato fresco.
 *
 * Un cliente depende ademas de su empresa: si la agencia deja de atenderla,
 * sus personas pierden el acceso aunque su cuenta siga activa.
 */
export function conservaElAcceso(usuario: UsuarioCompleto): boolean {
  if (!usuario.activo) return false;
  if (usuario.tipo === "cliente" && usuario.empresaActiva === false) return false;

  return true;
}

/**
 * La ruta de la peticion en curso, para volver a ella tras renovar.
 *
 * La deja el proxy en una cabecera, que es quien la conoce: una page no tiene
 * forma de saber su propia URL completa. Quien la use la pasa despues por
 * `destinoSeguro`, asi que da igual que venga de una cabecera.
 */
async function rutaActual(): Promise<string> {
  return (await headers()).get("x-ruta") ?? "/dashboard";
}

/**
 * Igual que `usuarioActual`, pero no deja pasar a nadie sin sesion valida.
 *
 * Hay tres salidas distintas, y distinguirlas es lo que evita perder el
 * trabajo de quien solo tenia el acceso vencido:
 *
 * - El acceso caduco pero queda token de renovacion: a `/renovar`, que pide
 *   otro acceso y devuelve a esta misma ruta.
 * - No hay nada: al login.
 * - El token verifica pero la sesion se revoco, o la cuenta ya no puede
 *   entrar: al login con su motivo, que ademas borra las cookies.
 */
export async function requerirUsuario(): Promise<UsuarioCompleto> {
  const sesion = await obtenerSesion();

  if (!sesion) {
    const almacen = await cookies();

    if (almacen.has(nombreCookieRenovacion())) {
      redirect(`/renovar?volverA=${encodeURIComponent(await rutaActual())}`);
    }

    redirect("/login");
  }

  const usuario = await usuarioActual();

  // La sesion se cerro desde el servidor: otra persona no la echo de la
  // aplicacion, solo tiene que volver a entrar.
  if (!usuario) {
    redirect(SESION_CERRADA);
  }

  if (!conservaElAcceso(usuario)) {
    redirect(SALIDA_FORZADA);
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
 * Exige que la persona tenga alguno de los roles indicados.
 *
 * Se decide con el rol LEIDO DE LA BASE, no con el del token. El token guarda
 * el rol del momento en que se emitio: decidir con el dejaba a un
 * administrador degradado o desactivado crear cuentas y restablecer
 * contrasenas hasta que su token caducara.
 *
 * Quien no tiene sesion va al login. Quien la tiene pero con otro rol vuelve
 * al panel: no se le manda al login porque su sesion es valida, lo que falta
 * es permiso.
 */
export async function requerirRol(
  ...rolesPermitidos: NombreRol[]
): Promise<UsuarioCompleto> {
  const usuario = await requerirUsuario();

  if (!rolesPermitidos.includes(usuario.rol)) {
    redirect("/dashboard");
  }

  return usuario;
}

/** Atajo para lo que solo puede hacer un administrador. */
export async function requerirAdmin(): Promise<UsuarioCompleto> {
  return requerirRol("admin");
}

/** Lo que el token de acceso guarda de una persona. */
function datosDeToken(usuario: UsuarioCompleto, sesionId: number) {
  return {
    usuarioId: usuario.id,
    sesionId,
    email: usuario.email,
    nombre: usuario.nombre,
    tipo: usuario.tipo,
    rol: usuario.rol,
    cargo: usuario.cargoSlug,
    empresaId: usuario.empresaId,
  };
}

/** Firma un acceso nuevo y lo deja en su cookie. Devuelve cuando caduca. */
async function emitirAcceso(
  usuario: UsuarioCompleto,
  sesionId: number,
  restanteSegundos: number,
): Promise<number> {
  const token = await firmarSesion(datosDeToken(usuario, sesionId));
  const sesion = await verificarSesion(token);

  if (!sesion) throw new Error("El token recien firmado no verifica");

  // La cookie vive lo que le queda a la sesion, no lo que dura el acceso: si
  // desapareciera a la media hora, el proxy no sabria distinguir «acceso
  // vencido» de «nunca entro».
  (await cookies()).set(
    nombreCookieSesion(),
    token,
    opcionesCookie(restanteSegundos),
  );

  return sesion.accesoCaducaEn;
}

/**
 * Abre una sesion para quien acaba de demostrar quien es.
 *
 * Crea la fila, emite el acceso y deja las dos cookies. `httpOnly` impide que
 * el JavaScript de la pagina las lea, que es lo que limita el dano de un XSS;
 * `sameSite: lax` evita que viajen en peticiones cruzadas de terceros sin
 * romper la navegacion normal.
 */
export async function abrirSesion(usuario: UsuarioCompleto): Promise<void> {
  const token = generarToken();
  const duracion = duracionSesion();

  const sesion = await sesiones.crear({
    usuarioId: usuario.id,
    tokenHash: hashDeToken(token),
    navegador: describirNavegador((await headers()).get("user-agent")),
    duracionSegundos: duracion,
  });

  await emitirAcceso(usuario, sesion.id, duracion);

  (await cookies()).set(
    nombreCookieRenovacion(),
    token,
    opcionesCookie(duracion),
  );
}

/** Borra las dos cookies de la sesion. */
export async function borrarCookiesDeSesion(): Promise<void> {
  const almacen = await cookies();

  // Se sobrescriben con valor vacio y maxAge 0 en lugar de solo borrarlas,
  // para que el navegador reciba una cabecera Set-Cookie que las invalide.
  almacen.set(nombreCookieSesion(), "", opcionesCookie(0));
  almacen.set(nombreCookieRenovacion(), "", opcionesCookie(0));
}

/**
 * Cierra la sesion de quien hace la peticion: revoca la fila y borra las
 * cookies.
 *
 * Se busca por el token de renovacion y no por el de acceso, porque el de
 * acceso puede haber caducado ya y la sesion seguir viva.
 */
export async function cerrarSesionActual(): Promise<void> {
  const token = (await cookies()).get(nombreCookieRenovacion())?.value;

  if (token) {
    await sesiones.revocarPorToken(hashDeToken(token), "salida");
  }

  await borrarCookiesDeSesion();
}

/**
 * Cambia el token de renovacion por otro y emite un acceso nuevo.
 *
 * Es lo que mantiene viva una sesion. Comprueba todo lo que comprobaria un
 * inicio de sesion salvo la contrasena: que el token corresponda a una sesion
 * viva, y que la persona —leida ahora mismo— pueda seguir entrando.
 *
 * Si algo falla se borran las cookies: lo que tenia el navegador ya no sirve.
 */
export async function renovarSesionActual(): Promise<EstadoRenovacion> {
  const almacen = await cookies();
  const token = almacen.get(nombreCookieRenovacion())?.value;

  if (!token) return { ok: false };

  const nuevo = generarToken();
  const renovacion = await sesiones.rotar(hashDeToken(token), hashDeToken(nuevo));

  if (!renovacion) {
    await borrarCookiesDeSesion();
    return { ok: false };
  }

  const usuario = await usuarios.buscarPorId(renovacion.usuarioId);

  if (!usuario || !conservaElAcceso(usuario)) {
    await sesiones.revocar(renovacion.sesionId, "usuario_desactivado");
    await borrarCookiesDeSesion();
    return { ok: false };
  }

  const sesionCaducaEn = renovacion.caducaEn.getTime();
  const restante = Math.max(1, Math.floor((sesionCaducaEn - Date.now()) / 1000));

  const accesoCaducaEn = await emitirAcceso(usuario, renovacion.sesionId, restante);

  // Sin rotacion no se toca la cookie: otra peticion ya dejo la buena.
  if (renovacion.rotada) {
    almacen.set(nombreCookieRenovacion(), nuevo, opcionesCookie(restante));
  }

  return {
    ok: true,
    // El acceso nunca vive mas que la sesion.
    accesoCaducaEn: Math.min(accesoCaducaEn, sesionCaducaEn),
    sesionCaducaEn,
  };
}
