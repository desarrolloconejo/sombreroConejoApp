"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { anotar } from "@/lib/auditoria";
import { cifrar, descifrar } from "@/lib/cifrado";
import { conSesion, transaccion } from "@/lib/db";
import { cerrarPasoPendiente, pasoPendiente } from "@/lib/dosPasos";
import { notificarA, notificarAAdministradores } from "@/lib/notificaciones";
import { verificar } from "@/lib/password";
import { dibujarQr } from "@/lib/qr";
import { destinoSeguro } from "@/lib/redireccion";
import {
  abrirSesion,
  conservaElAcceso,
  requerirAdmin,
  requerirUsuario,
} from "@/lib/sesion";
import { hashDeToken } from "@/lib/tokens";
import {
  CODIGOS_DE_RESPALDO,
  enGrupos,
  enlaceDeRegistro,
  generarCodigoDeRespaldo,
  generarSecreto,
  normalizarCodigoDeRespaldo,
  verificarCodigo,
} from "@/lib/totp";
import { comoIdentificador } from "@/lib/validaciones";
import * as dosPasos from "@/models/dosPasos";
import * as usuarios from "@/models/usuarios";
import type { EstadoDosPasos, EstadoFormulario } from "@/types";

/**
 * La verificacion en dos pasos: configurarla, usarla al entrar y quitarla.
 *
 * Se pide por defecto a todas las cuentas. Quien no la quiera puede decirlo,
 * y entonces no se le vuelve a preguntar.
 */

/** Como aparece la cuenta en la app de codigos. */
const EMISOR = "Conejo App";

/** Los mismos limites que el login: los fallos del codigo cuentan igual. */
const INTENTOS_PERMITIDOS = 5;
const MINUTOS_DE_BLOQUEO = 15;

/**
 * Un solo mensaje para «codigo equivocado» y «cuenta bloqueada», por lo mismo
 * que en el login: uno propio diria que probar ya no sirve.
 */
const CODIGO_INVALIDO =
  "El codigo no es correcto. Tras cinco intentos fallidos la cuenta se bloquea 15 minutos";

/**
 * El segundo paso del inicio de sesion.
 *
 * NO empieza por una guardia: quien llega aqui todavia no tiene sesion. Lo
 * que comprueba es la cookie que dejo el login al acertar la contrasena, y a
 * partir de ahi vuelve a leer a la persona de la base.
 */
export async function verificarSegundoPaso(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const pendiente = await pasoPendiente();

  if (!pendiente) {
    // Pasaron los cinco minutos, o se llego aqui sin pasar por el login.
    redirect("/login");
  }

  const usuario = await usuarios.buscarPorId(pendiente.usuarioId);
  const credenciales = usuario ? await dosPasos.credenciales(usuario.id) : null;

  if (!usuario || !credenciales || !conservaElAcceso(usuario)) {
    await cerrarPasoPendiente();
    redirect("/login?motivo=sin-acceso");
  }

  const escrito = datos.get("codigo");
  const texto = typeof escrito === "string" ? escrito.trim() : "";

  if (!texto) {
    return { ok: false, errores: { codigo: "Escribe el codigo de tu app" } };
  }

  const secreto =
    credenciales.activado && credenciales.secretoCifrado
      ? descifrar(credenciales.secretoCifrado)
      : null;

  // Con la cuenta bloqueada no se comprueba nada, igual que en el login.
  let valido: "codigo" | "respaldo" | null = null;

  if (!credenciales.bloqueado && secreto) {
    const paso = verificarCodigo(secreto, texto, Date.now(), credenciales.ultimoPaso);

    if (paso !== null) {
      // Apuntar el paso es lo que impide usar el mismo codigo dos veces, y
      // lo decide la base: dos envios simultaneos no pasan los dos.
      if (await dosPasos.registrarPaso(usuario.id, paso)) valido = "codigo";
    } else {
      const respaldo = normalizarCodigoDeRespaldo(texto);

      if (respaldo && (await dosPasos.usarRespaldo(usuario.id, hashDeToken(respaldo)))) {
        valido = "respaldo";
      }
    }
  }

  if (!valido) {
    await conSesion(usuario, async (tx) => {
      const bloqueada = await usuarios.registrarFallo(
        usuario.id,
        INTENTOS_PERMITIDOS,
        MINUTOS_DE_BLOQUEO,
        tx,
      );

      await anotar(tx, usuario, bloqueada ? "sesion.bloqueo" : "sesion.fallo", {
        entidad: "usuario",
        entidadId: usuario.id,
        empresaId: usuario.empresaId,
        despues: { paso: "codigo" },
      });

      if (bloqueada) {
        await notificarAAdministradores(tx, {
          tipo: "cuenta.bloqueada",
          titulo: `La cuenta de ${usuario.nombre} ${usuario.apellido} se bloqueo`,
          cuerpo:
            "Cinco codigos de verificacion equivocados seguidos. Quien lo intenta ya conoce la contrasena.",
          href: `/dashboard/usuarios?busqueda=${encodeURIComponent(usuario.email)}`,
          empresaId: usuario.empresaId,
        });
      }
    });

    return { ok: false, mensaje: CODIGO_INVALIDO };
  }

  await abrirSesion(usuario);
  await cerrarPasoPendiente();

  await transaccion(async (tx) => {
    await usuarios.registrarAcceso(usuario.id, tx);
    await anotar(tx, usuario, "sesion.inicio", {
      entidad: "usuario",
      entidadId: usuario.id,
      empresaId: usuario.empresaId,
      despues: { segundoPaso: valido },
    });
  });

  redirect(destinoSeguro(pendiente.volverA));
}

/**
 * Lo que la pantalla necesita para registrar la cuenta en la app: el codigo
 * QR para escanearlo, la clave para teclearla y el enlace para abrirlo desde
 * el propio telefono. Las tres cosas dicen lo mismo.
 */
function paraRegistrar(secreto: string, correo: string) {
  const enlace = enlaceDeRegistro(secreto, correo, EMISOR);

  return { secreto: enGrupos(secreto), enlace, qr: dibujarQr(enlace) };
}

/**
 * Empieza la activacion: genera el secreto y lo devuelve para registrarlo en
 * la app. Todavia no activa nada; eso lo hace `confirmarDosPasos`.
 *
 * Se puede llamar las veces que haga falta: cada una genera un secreto nuevo
 * y descarta el anterior, que nunca llego a usarse.
 */
export async function iniciarDosPasos(): Promise<EstadoDosPasos> {
  const usuario = await requerirUsuario({ sinResolverDosPasos: true });

  const secreto = generarSecreto();

  if (!(await dosPasos.guardarSecretoPendiente(usuario.id, cifrar(secreto)))) {
    return { ok: false, mensaje: "Ya tienes activada la verificacion en dos pasos" };
  }

  return { ok: true, ...paraRegistrar(secreto, usuario.email) };
}

/**
 * Termina la activacion comprobando un codigo de la app.
 *
 * Sin este paso se podria activar con un secreto que la persona no llego a
 * registrar, y quedaria fuera de su propia cuenta. Devuelve los codigos de
 * respaldo, que es la UNICA vez que se muestran: en la base queda su hash.
 */
export async function confirmarDosPasos(
  _estadoPrevio: EstadoDosPasos,
  datos: FormData,
): Promise<EstadoDosPasos> {
  const usuario = await requerirUsuario({ sinResolverDosPasos: true });

  const credenciales = await dosPasos.credenciales(usuario.id);
  const secreto =
    credenciales?.secretoCifrado && !credenciales.activado
      ? descifrar(credenciales.secretoCifrado)
      : null;

  if (!secreto) {
    return { ok: false, mensaje: "Vuelve a empezar la configuracion" };
  }

  const escrito = datos.get("codigo");
  const paso = verificarCodigo(
    secreto,
    typeof escrito === "string" ? escrito : "",
    Date.now(),
  );

  if (paso === null) {
    return {
      ok: false,
      ...paraRegistrar(secreto, usuario.email),
      errores: {
        codigo: "Ese codigo no coincide. Comprueba que la hora del telefono es la correcta",
      },
    };
  }

  const respaldos = Array.from({ length: CODIGOS_DE_RESPALDO }, generarCodigoDeRespaldo);

  const activado = await transaccion(async (tx) => {
    const hecho = await dosPasos.activar(
      usuario.id,
      paso,
      respaldos.map((codigo) => hashDeToken(codigo)),
      tx,
    );

    if (hecho) {
      await anotar(tx, usuario, "usuario.dos_pasos_activados", {
        entidadId: usuario.id,
        empresaId: usuario.empresaId,
      });
    }

    return hecho;
  });

  if (!activado) {
    return { ok: false, mensaje: "No se pudo activar. Vuelve a empezar la configuracion" };
  }

  /*
   * NO se revalida nada aqui, y es a proposito.
   *
   * Revalidar haria que la pantalla se volviera a pintar ya con los dos pasos
   * activados: Mi perfil cambiaria de tarjeta y la pantalla de bienvenida
   * redirigiria, y en los dos casos los codigos de respaldo —que solo viajan
   * en esta respuesta— desaparecerian antes de poder leerlos. La pantalla se
   * refresca cuando la persona pulsa «Ya los guarde».
   */
  return {
    ok: true,
    mensaje: "La verificacion en dos pasos quedo activada",
    respaldos,
  };
}

/**
 * «Prefiero no usarla». Deja de preguntarse al entrar.
 *
 * Solo vale para quien no la tiene activada. Dejar de usarla una vez activa
 * es `desactivarDosPasos`, que pide la contrasena.
 */
export async function omitirDosPasos(): Promise<void> {
  const usuario = await requerirUsuario({ sinResolverDosPasos: true });

  await transaccion(async (tx) => {
    if (await dosPasos.omitir(usuario.id, tx)) {
      await anotar(tx, usuario, "usuario.dos_pasos_omitidos", {
        entidadId: usuario.id,
        empresaId: usuario.empresaId,
      });
    }
  });

  redirect("/dashboard");
}

/**
 * La propia persona deja de usar los dos pasos. Pide la contrasena: con una
 * sesion abierta y desatendida no basta para rebajar la proteccion de la
 * cuenta.
 */
export async function desactivarDosPasos(
  _estadoPrevio: EstadoDosPasos,
  datos: FormData,
): Promise<EstadoDosPasos> {
  const usuario = await requerirUsuario();

  const escrita = datos.get("password");
  const password = typeof escrita === "string" ? escrita : "";

  if (!password) {
    return { ok: false, errores: { password: "Escribe tu contrasena" } };
  }

  const conHash = await usuarios.buscarPorEmailConCredenciales(usuario.email);

  if (!conHash || conHash.id !== usuario.id) {
    return { ok: false, mensaje: "No se pudo verificar tu cuenta" };
  }

  if (!(await verificar(password, conHash.passwordHash))) {
    return { ok: false, errores: { password: "La contrasena no es correcta" } };
  }

  const hecho = await transaccion(async (tx) => {
    // Con `true`: la quita quien la usa, asi que no se le vuelve a pedir.
    if (!(await dosPasos.desactivar(usuario.id, true, tx))) return false;

    await anotar(tx, usuario, "usuario.dos_pasos_desactivados", {
      entidadId: usuario.id,
      empresaId: usuario.empresaId,
    });

    return true;
  });

  if (!hecho) {
    return { ok: false, mensaje: "No tenias activada la verificacion en dos pasos" };
  }

  revalidatePath("/dashboard", "layout");

  return { ok: true, mensaje: "La verificacion en dos pasos quedo desactivada" };
}

/**
 * Un administrador le retira los dos pasos a otra persona.
 *
 * Es la salida para quien perdio el telefono y los codigos de respaldo: sin
 * esto no podria volver a entrar. La proxima vez que entre se le pedira que
 * los configure de nuevo.
 */
export async function retirarDosPasos(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const admin = await requerirAdmin();

  const id = comoIdentificador(datos.get("id"));

  if (id === null) {
    return { ok: false, mensaje: "No se pudo identificar la cuenta" };
  }

  const usuario = await usuarios.buscarPorId(id);

  if (!usuario) return { ok: false, mensaje: "Esa cuenta ya no existe" };

  const hecho = await conSesion(admin, async (tx) => {
    // Con `false`: no fue decision suya, asi que se le vuelve a pedir.
    if (!(await dosPasos.desactivar(usuario.id, false, tx))) return false;

    await anotar(tx, admin, "usuario.dos_pasos_retirados", {
      entidadId: usuario.id,
      empresaId: usuario.empresaId,
    });

    await notificarA(tx, [usuario.id], {
      tipo: "cuenta.dos_pasos_retirados",
      titulo: "Un administrador retiro tu verificacion en dos pasos",
      cuerpo: "Al entrar se te pedira que la configures de nuevo.",
      href: "/dashboard/perfil",
      empresaId: usuario.empresaId,
    });

    return true;
  });

  if (!hecho) {
    return { ok: false, mensaje: "Esa cuenta no tenia activados los dos pasos" };
  }

  revalidatePath("/dashboard/usuarios");

  return {
    ok: true,
    mensaje: `${usuario.nombre} ya puede entrar solo con su contrasena, y se le pedira configurarlos de nuevo`,
  };
}
