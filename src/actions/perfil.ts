"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { anotar, soloCambios } from "@/lib/auditoria";
import { transaccion } from "@/lib/db";
import { hashear, verificar } from "@/lib/password";
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
 * La subida de foto esta APAGADA y su codigo vive comentado al final del
 * archivo. El motivo y como reactivarla estan explicados alli.
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

  // El cambio, el cierre de las demas sesiones y su linea van juntos: no
  // puede quedar una contrasena nueva con las sesiones viejas abiertas.
  const cerradas = await transaccion(async (tx) => {
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

    return cuantas;
  });

  if (cerradas === null) {
    return { ok: false, mensaje: "No se pudo cambiar la contrasena" };
  }

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

/* ===========================================================================
   SUBIDA DE FOTO DE PERFIL — APAGADA, NO BORRADA
   ===========================================================================

   POR QUE ESTA APAGADA
   --------------------
   En Vercel el sistema de archivos de una funcion es de SOLO LECTURA salvo
   /tmp, y la carpeta public/ se hornea en el build. El `writeFile` de abajo
   daria EROFS; y aunque no lo diera, el archivo no se serviria por HTTP ni
   sobreviviria al siguiente despliegue, porque cada invocacion puede caer en
   una instancia distinta.

   No es una decision de producto: es que este codigo, tal como esta escrito,
   es incompatible con una plataforma sin disco. En local sigue funcionando, y
   en un VPS volveria a funcionar sin cambiarle una linea.

   COMO REACTIVARLA
   ----------------
   1. Descomentar este bloque entero y los imports de la cabecera:
        import { randomUUID } from "node:crypto";
        import { mkdir, unlink, writeFile } from "node:fs/promises";
        import path from "node:path";
   2. Descomentar `actualizarFoto` en src/models/usuarios.ts.
   3. Descomentar el formulario de src/components/perfil/TarjetaFoto.tsx
      (vuelve a necesitar "use client").
   4. Devolver la entrada de la foto al medidor de
      src/components/inicio/EstadoCuenta.tsx.

   Si en vez de disco se va a almacenamiento de objetos (Vercel Blob, S3), lo
   unico que cambia es de donde sale `rutaPublica`: pasa a ser una URL
   absoluta, y entonces hace falta declarar su host en `images.remotePatterns`
   de next.config.ts o `next/image` la rechaza.

   El contrato con la base NO cambia en ninguno de los dos casos:
   `usuarios.actualizarFoto` ya devuelve la foto anterior para poder borrarla.
   =========================================================================== */

/*
// El limite del que avisa la interfaz. Se comprueba igualmente en el servidor,
// porque el aviso del formulario es una cortesia, no una barrera.
const TAMANO_MAXIMO = 2 * 1024 * 1024;

// Carpeta real en disco y prefijo con el que se sirve por HTTP.
const CARPETA_AVATARES = path.join(process.cwd(), "public", "uploads", "avatares");
const PREFIJO_PUBLICO = "/uploads/avatares";

// Firmas de archivo (magic numbers) de los formatos que se aceptan.
//
// Es lo unico que decide si un archivo entra. Ni el nombre ni el `type` que
// manda el navegador sirven: los dos los controla quien envia, asi que un
// script disfrazado de .jpg pasaria cualquier comprobacion basada en ellos.
const FIRMAS = [
  { extension: "jpg", bytes: [0xff, 0xd8, 0xff], desde: 0 },
  { extension: "png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], desde: 0 },
  // WEBP no tiene una firma continua: es un contenedor RIFF cuyo tipo se
  // declara cuatro bytes despues del tamano, en la posicion 8.
  { extension: "webp", bytes: [0x52, 0x49, 0x46, 0x46], desde: 0, ademas: { bytes: [0x57, 0x45, 0x42, 0x50], desde: 8 } },
] as const;

function coincide(contenido: Uint8Array, bytes: readonly number[], desde: number): boolean {
  if (contenido.length < desde + bytes.length) return false;

  return bytes.every((byte, indice) => contenido[desde + indice] === byte);
}

// Extension que corresponde al contenido real, o null si no es una imagen valida.
function extensionPorFirma(contenido: Uint8Array): string | null {
  for (const firma of FIRMAS) {
    if (!coincide(contenido, firma.bytes, firma.desde)) continue;

    const segunda = "ademas" in firma ? firma.ademas : null;
    if (segunda && !coincide(contenido, segunda.bytes, segunda.desde)) continue;

    return firma.extension;
  }

  return null;
}

// Borra un avatar del disco sin dejar que el fallo suba.
//
// La ruta se reconstruye desde el nombre del archivo, nunca se usa tal cual:
// el valor viene de la base, pero componer una ruta con texto que no se
// controla es la via clasica al recorrido de directorios.
async function borrarAvatar(rutaPublica: string | null): Promise<void> {
  if (!rutaPublica || !rutaPublica.startsWith(`${PREFIJO_PUBLICO}/`)) return;

  try {
    await unlink(path.join(CARPETA_AVATARES, path.basename(rutaPublica)));
  } catch {
    // Que el archivo ya no este no es un problema: lo que importaba era
    // quitarlo de la base, y eso ya ocurrio.
  }
}

// Sustituye la foto de perfil por la que llega en el formulario.
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
  // archivo enorme para despues descartarlo es justo lo que busca quien
  // quiere tumbar el servidor.
  if (archivo.size > TAMANO_MAXIMO) {
    return { ok: false, errores: { foto: "La imagen no puede pasar de 2 MB" } };
  }

  const contenido = new Uint8Array(await archivo.arrayBuffer());
  const extension = extensionPorFirma(contenido);

  if (!extension) {
    return {
      ok: false,
      errores: { foto: "El archivo no es una imagen JPG, PNG o WEBP" },
    };
  }

  // El nombre lo decide el servidor. El que manda el navegador puede traer
  // barras, puntos suspensivos o una extension que no corresponde al
  // contenido, y ninguna de esas cosas debe llegar al disco.
  const nombre = `${randomUUID()}.${extension}`;

  await mkdir(CARPETA_AVATARES, { recursive: true });
  await writeFile(path.join(CARPETA_AVATARES, nombre), contenido);

  const rutaPublica = `${PREFIJO_PUBLICO}/${nombre}`;
  const cambio = await usuarios.actualizarFoto(usuario.id, rutaPublica);

  if (!cambio) {
    // Si la fila no se actualizo, el archivo recien escrito no lo referencia
    // nadie: se retira para no dejar basura en disco.
    await borrarAvatar(rutaPublica);
    return { ok: false, mensaje: "No se pudo guardar la foto" };
  }

  await borrarAvatar(cambio.fotoAnterior);

  revalidatePath("/dashboard", "layout");

  return { ok: true, mensaje: "Tu foto quedo actualizada" };
}
*/
