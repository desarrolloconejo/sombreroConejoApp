"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { anotar, soloCambios } from "@/lib/auditoria";
import { correoDeClaveCambiada } from "@/lib/correos/plantillas";
import { conSesion, transaccion } from "@/lib/db";
import { subirArchivo } from "@/lib/externos/archivos";
import { encolarCorreo, entregarCorreos } from "@/lib/externos/correo";
import { ZONA_HORARIA } from "@/lib/fechas";
import { hashear, verificar } from "@/lib/password";
import { tipoPorFirma } from "@/lib/portal/archivos";
import { obtenerSesion, requerirUsuario } from "@/lib/sesion";
import { validarCambioPassword, validarPerfil } from "@/lib/validaciones";
import * as sesiones from "@/models/sesiones";
import * as usuarios from "@/models/usuarios";
import type { EstadoFormulario } from "@/types";

/**
 * El modulo Mi perfil: lo que cada quien puede cambiar de si mismo.
 *
 * Toda action empieza por `requerirUsuario`, que devuelve a la persona LEIDA
 * DE LA BASE. De ahi sale el identificador sobre el que se escribe, y por eso
 * ninguna de estas actions acepta un id por formulario: si lo aceptara,
 * cualquiera podria editar el perfil ajeno cambiando un campo oculto.
 *
 * La preferencia de tema no vive aqui: es `cambiarTema` de "@/actions/tema",
 * que ya la usa el proveedor de tema desde el cliente.
 *
 * La foto de perfil se guarda en Drive (`subirFoto`), como los demas
 * archivos: en Vercel no hay disco donde escribirla.
 */

/** Guarda los datos personales que cada quien puede cambiar de si mismo. */
export async function actualizarPerfil(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirUsuario();

  const { valores, errores, valido } = validarPerfil(datos);

  if (!valido) {
    return { ok: false, errores };
  }

  const actualizado = await transaccion(async (tx) => {
    const fila = await usuarios.actualizarPerfil(usuario.id, valores, tx);

    const cambios = fila
      ? soloCambios(
          {
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            telefono: usuario.telefono,
          },
          { nombre: fila.nombre, apellido: fila.apellido, telefono: fila.telefono },
        )
      : null;

    // Guardar el formulario sin tocar nada no es una edicion.
    if (cambios) {
      await anotar(tx, usuario, "usuario.perfil_editado", {
        entidadId: usuario.id,
        empresaId: usuario.empresaId,
        ...cambios,
      });
    }

    return fila;
  });

  if (!actualizado) {
    return { ok: false, mensaje: "No se pudieron guardar los cambios" };
  }

  // El layout tambien pinta el nombre en el sidebar, asi que se revalida
  // desde ahi y no solo esta page.
  revalidatePath("/dashboard", "layout");

  return { ok: true, mensaje: "Tus datos quedaron guardados" };
}

/**
 * Cambia la contrasena previa confirmacion de la actual.
 *
 * Es la unica action que admite a quien entra con una contrasena
 * provisional: cambiarla es justo lo que tiene que hacer.
 */
export async function cambiarPassword(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirUsuario({ conClaveProvisional: true });

  const { valores, errores, valido } = validarCambioPassword(datos);

  if (!valido) {
    return { ok: false, errores };
  }

  // `requerirUsuario` no trae el hash a proposito: no debe salir de la capa
  // de datos salvo cuando hay que compararlo, que es justo este caso.
  const credenciales = await usuarios.buscarPorEmailConCredenciales(usuario.email);

  if (!credenciales || credenciales.id !== usuario.id) {
    return { ok: false, mensaje: "No se pudo verificar tu cuenta" };
  }

  const esLaActual = await verificar(valores.actual, credenciales.passwordHash);

  if (!esLaActual) {
    return {
      ok: false,
      errores: { passwordActual: "La contrasena actual no es correcta" },
    };
  }

  const nuevoHash = await hashear(valores.nueva);
  const sesion = await obtenerSesion();

  const cuando = new Intl.DateTimeFormat("es-VE", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: ZONA_HORARIA,
  }).format(new Date());

  // El cambio, el cierre de las demas sesiones, su linea y el aviso por correo
  // van juntos: no puede quedar una contrasena nueva con las sesiones viejas
  // abiertas, ni un cambio sin avisar.
  const cambio = await conSesion(usuario, async (tx) => {
    const guardada = await usuarios.actualizarPasswordHash(
      usuario.id,
      nuevoHash,
      // La eligio la propia persona: deja de ser provisional.
      false,
      tx,
    );

    if (!guardada) return null;

    // Quien tuviera la contrasena anterior deja de estar dentro. Se conserva
    // solo la sesion desde la que se acaba de cambiar.
    const cuantas = await sesiones.revocarDeUsuario(
      usuario.id,
      "clave_cambiada",
      sesion?.sesionId ?? null,
      tx,
    );

    await anotar(tx, usuario, "usuario.clave_cambiada", {
      entidadId: usuario.id,
      empresaId: usuario.empresaId,
    });

    // Por si no fue la propia persona: le llega a su correo, que quien tenga
    // su contrasena no controla.
    const correoId = await encolarCorreo(tx, usuario, correoDeClaveCambiada(usuario, "perfil", cuando));

    return { cerradas: cuantas, correoId };
  });

  if (cambio === null) {
    return { ok: false, mensaje: "No se pudo cambiar la contrasena" };
  }

  const { cerradas, correoId } = cambio;
  await entregarCorreos(usuario, [correoId]);

  // Quien venia obligado a cambiarla ya puede pasar. Va fuera de cualquier
  // try: redirect lanza una excepcion interna de Next.
  if (usuario.debeCambiarClave) {
    redirect("/dashboard");
  }

  return {
    ok: true,
    mensaje:
      cerradas > 0
        ? "Tu contrasena quedo actualizada y se cerraron tus otras sesiones"
        : "Tu contrasena quedo actualizada",
  };
}

/** El peso maximo de una foto de perfil. */
const TAMANO_FOTO = 2 * 1024 * 1024;

/** Los tipos que admite una foto: imagenes fijas, sin GIF. */
const TIPOS_FOTO = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Sustituye la foto de perfil por la que llega en el formulario.
 *
 * La foto va a Drive (ConejoApp/Perfiles), como los demas archivos: en
 * Vercel no hay disco donde escribir. Se entrega por /api/fotos/ID, que
 * exige sesion; el id de Drive no sale del servidor. La URL lleva una version
 * para que el navegador no siga pintando la anterior.
 *
 * La foto anterior se queda en Drive: el adaptador no borra, y una foto vieja
 * no estorba (docs/pendientes.md).
 */
export async function subirFoto(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirUsuario();

  const archivo = datos.get("foto");

  if (!(archivo instanceof File) || archivo.size === 0) {
    return { ok: false, errores: { foto: "Elige una imagen antes de subirla" } };
  }

  // Se rechaza por tamano ANTES de leer el contenido: cargar en memoria un
  // archivo enorme para despues descartarlo es lo que busca quien quiere
  // tumbar el servidor.
  if (archivo.size > TAMANO_FOTO) {
    return { ok: false, errores: { foto: "La imagen no puede pasar de 2 MB" } };
  }

  // El tipo lo dice el contenido, no el nombre ni lo que declara el navegador.
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const tipo = tipoPorFirma(bytes);

  if (!tipo || !TIPOS_FOTO.has(tipo.mime)) {
    return { ok: false, errores: { foto: "El archivo no es una imagen JPG, PNG o WEBP" } };
  }

  // Se sube ANTES de la fila y fuera de cualquier transaccion: un servicio
  // externo no se llama con una conexion a la base tomada.
  let guardada: string;

  try {
    guardada = await subirArchivo({
      nombre: `PERFIL_${usuario.id}_${Date.now().toString(36)}.${tipo.extension}`,
      mime: tipo.mime,
      bytes,
      carpeta: "perfiles",
    });
  } catch (error) {
    console.error("[perfil] no se pudo guardar la foto:", error);
    return { ok: false, mensaje: "No se pudo guardar la foto. Intentalo de nuevo" };
  }

  // La version cambia con cada foto y lleva la extension: la ruta saca de
  // ella el tipo de imagen sin tener que leer el archivo.
  const fotoUrl = `/api/fotos/${usuario.id}?v=${Date.now().toString(36)}.${tipo.extension}`;

  const hecho = await transaccion(async (tx) => {
    if (!(await usuarios.actualizarFoto(usuario.id, { fotoUrl, archivo: guardada }, tx))) return false;

    await anotar(tx, usuario, "usuario.foto_cambiada", {
      entidadId: usuario.id,
      empresaId: usuario.empresaId,
    });

    return true;
  });

  if (!hecho) return { ok: false, mensaje: "No se pudo guardar la foto" };

  // La foto sale en la barra lateral y en todo el panel.
  revalidatePath("/dashboard", "layout");

  return { ok: true, mensaje: "Tu foto quedo actualizada" };
}

/** Quita la foto de perfil: vuelven las iniciales. */
export async function quitarFoto(): Promise<EstadoFormulario> {
  const usuario = await requerirUsuario();

  if (!usuario.fotoUrl) return { ok: false, mensaje: "No tienes foto" };

  await transaccion(async (tx) => {
    await usuarios.actualizarFoto(usuario.id, null, tx);
    await anotar(tx, usuario, "usuario.foto_cambiada", {
      entidadId: usuario.id,
      empresaId: usuario.empresaId,
      despues: { foto: null },
    });
  });

  revalidatePath("/dashboard", "layout");

  return { ok: true, mensaje: "Quitaste tu foto" };
}
