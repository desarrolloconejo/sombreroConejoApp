"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";

import { anotar } from "@/lib/auditoria";
import { correoDeClaveCambiada, correoDeRecuperarClave } from "@/lib/correos/plantillas";
import { conSistema } from "@/lib/db";
import { encolarCorreo, entregarCorreos } from "@/lib/externos/correo";
import { ZONA_HORARIA } from "@/lib/fechas";
import { hashear } from "@/lib/password";
import {
  ENLACES_POR_HORA,
  enlaceParaToken,
  hashDeToken,
  MINUTOS_DEL_ENLACE,
  nuevoToken,
  pareceToken,
} from "@/lib/recuperarClave";
import { conservaElAcceso } from "@/lib/sesion";
import { esEmail, LIMITES, limpiarTexto, validarPassword } from "@/lib/validaciones";
import * as restablecimientos from "@/models/restablecimientos";
import * as sesiones from "@/models/sesiones";
import * as usuarios from "@/models/usuarios";
import type { EstadoFormulario } from "@/types";

/**
 * «Olvide mi contrasena»: pedir un enlace por correo y usarlo para poner una
 * contrasena nueva.
 *
 * SIN GUARDIA DE SESION, A PROPOSITO
 * ----------------------------------
 * Las dos atienden a quien no puede entrar. Su guardia es otra: pedir el
 * enlace solo manda un correo a la direccion de la cuenta (quien pide no ve
 * nada), y usarlo exige el token que solo llega a ese correo. Escriben con
 * `conSistema`: no hay usuario con sesion y no se inventa uno.
 *
 * NO DICEN SI LA CUENTA EXISTE
 * ----------------------------
 * Pedir el enlace responde siempre lo mismo, y todo el trabajo (buscar la
 * cuenta, guardar el enlace, enviar el correo) ocurre despues de responder,
 * con `after`: ni el texto ni lo que tarda la respuesta delatan si ese correo
 * tiene cuenta. Igual que el login, que responde igual a todo.
 */

const RESPUESTA: EstadoFormulario = {
  ok: true,
  mensaje: `Si hay una cuenta con ese correo, te enviamos un enlace para elegir una contrasena nueva. Vence en ${MINUTOS_DEL_ENLACE} minutos: revisa tambien el correo no deseado.`,
};

const ENLACE_NO_VALE =
  "Este enlace ya no sirve: vencio, ya se uso o se pidio otro despues. Pide uno nuevo.";

/** Pide un enlace para poner una contrasena nueva. */
export async function pedirRecuperacion(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const email = limpiarTexto(datos.get("email"), LIMITES.email).toLowerCase();

  if (!esEmail(email)) {
    return { ok: false, errores: { email: "Escribe el correo con el que entras" } };
  }

  after(async () => {
    try {
      await enviarEnlace(email);
    } catch (error) {
      console.error("[recuperar] no se pudo preparar el enlace:", error instanceof Error ? error.message : error);
    }
  });

  return RESPUESTA;
}

/** Lo que pasa despues de responder: si la cuenta existe y puede, le llega el enlace. */
async function enviarEnlace(email: string): Promise<void> {
  const usuario = await usuarios.buscarPorEmailConCredenciales(email);

  // Una cuenta que no puede entrar no recibe enlace: con el no entraria.
  if (!usuario || !conservaElAcceso(usuario)) return;

  const { token, hash } = nuevoToken();
  const enlace = enlaceParaToken(token);

  if (!enlace) {
    console.error("[recuperar] falta APP_URL_PUBLICA: el correo no tendria enlace");
    return;
  }

  const correoId = await conSistema(async (tx) => {
    // Pocos por hora: que nadie llene el buzon de otra persona.
    if ((await restablecimientos.pedidosRecientes(usuario.id, tx)) >= ENLACES_POR_HORA) return null;

    await restablecimientos.crear(usuario.id, hash, MINUTOS_DEL_ENLACE, tx);

    await anotar(tx, null, "usuario.clave_pedida", {
      entidadId: usuario.id,
      empresaId: usuario.empresaId,
    });

    return encolarCorreo(tx, null, correoDeRecuperarClave(usuario, MINUTOS_DEL_ENLACE));
  });

  if (correoId === null) return;

  // El enlace va solo en lo que se envia: la bandeja guarda el marcador.
  await entregarCorreos({ sistema: true }, [correoId], { [correoId]: enlace });
}

/** Pone la contrasena nueva con el token del enlace. */
export async function ponerClaveNueva(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const token = datos.get("token");
  if (!pareceToken(token)) return { ok: false, mensaje: ENLACE_NO_VALE };

  const nueva = typeof datos.get("passwordNueva") === "string" ? (datos.get("passwordNueva") as string) : "";
  const confirmacion =
    typeof datos.get("passwordConfirmacion") === "string" ? (datos.get("passwordConfirmacion") as string) : "";

  const problema = validarPassword(nueva);
  if (problema) return { ok: false, errores: { passwordNueva: problema } };
  if (nueva !== confirmacion) {
    return { ok: false, errores: { passwordConfirmacion: "Las contrasenas no coinciden" } };
  }

  // El hash es lento a proposito: se calcula antes de abrir la transaccion.
  const nuevoHash = await hashear(nueva);
  const cuando = new Intl.DateTimeFormat("es-VE", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: ZONA_HORARIA,
  }).format(new Date());

  const correoId = await conSistema(async (tx) => {
    const usuarioId = await restablecimientos.usar(hashDeToken(token), tx);
    if (usuarioId === null) return null;

    const usuario = await usuarios.buscarPorId(usuarioId, tx);
    if (!usuario || !conservaElAcceso(usuario)) return null;

    // La eligio la propia persona: deja de ser provisional, y se desbloquea.
    if (!(await usuarios.actualizarPasswordHash(usuario.id, nuevoHash, false, tx))) return null;

    // Quien estuviera dentro con la contrasena anterior, fuera.
    const cerradas = await sesiones.revocarDeUsuario(usuario.id, "clave_restablecida", null, tx);

    await anotar(tx, null, "usuario.clave_recuperada", {
      entidadId: usuario.id,
      empresaId: usuario.empresaId,
      despues: { sesionesCerradas: cerradas },
    });

    return encolarCorreo(tx, null, correoDeClaveCambiada(usuario, "enlace", cuando));
  });

  if (correoId === null) return { ok: false, mensaje: ENLACE_NO_VALE };

  after(() => entregarCorreos({ sistema: true }, [correoId]));

  redirect("/login?motivo=clave-nueva");
}
