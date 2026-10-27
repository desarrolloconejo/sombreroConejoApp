import { conSesion } from "@/lib/db";
import { leerArchivo, leerRango } from "@/lib/externos/archivos";
import { comoAprobado } from "@/lib/nomenclatura";
import { conservaElAcceso, usuarioActual } from "@/lib/sesion";
import { comoIdentificador } from "@/lib/validaciones";
import * as versiones from "@/models/versiones";

/**
 * La entrega de una version: la unica forma de ver un archivo de una pieza.
 *
 * El archivo vive en Drive (o en la base, en modo simulado) y el navegador no
 * sabe donde: pide esta ruta con el id de la version. Lo que decide si lo ve
 * es la base, con la sesion de quien pregunta: el equipo de la pieza ve todas
 * sus versiones; el cliente, solo la enviada y solo con la pieza en la fase 5
 * o aprobada.
 *
 * Todo lo que no se puede ver responde 404, nunca 403: decir «prohibido»
 * confirmaria que la version existe.
 *
 * Admite la cabecera Range, para que un visor pida el archivo por partes.
 * Descargarlo (`?descargar=1`) es otra cosa: el cliente solo puede con la
 * pieza aprobada (C2).
 */

export const dynamic = "force-dynamic";

function noEncontrado(): Response {
  return new Response("No encontrado", {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });
}

/** Un nombre de archivo que viaja sin romper la cabecera. */
function cabeceraDeNombre(nombre: string, adjunto: boolean): string {
  const ascii = nombre.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${adjunto ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`;
}

export async function GET(
  peticion: Request,
  contexto: RouteContext<"/api/archivos/[versionId]">,
): Promise<Response> {
  // Sin sesion valida, la ruta no existe para quien pregunta.
  const usuario = await usuarioActual();
  if (!usuario || !conservaElAcceso(usuario) || usuario.debeCambiarClave) return noEncontrado();

  const id = comoIdentificador((await contexto.params).versionId);
  if (id === null) return noEncontrado();

  const version = await conSesion(usuario, (tx) => versiones.paraEntregar(id, tx));
  if (!version || version.origen !== "archivo" || !version.archivoId) return noEncontrado();

  const descargar = new URL(peticion.url).searchParams.get("descargar") === "1";
  if (descargar && usuario.tipo === "cliente" && !version.aprobada) return noEncontrado();

  const archivo = await leerArchivo(version.archivoId, leerRango(peticion.headers.get("range")));
  if (!archivo) return noEncontrado();

  const cabeceras = new Headers({
    "Content-Type": version.mime ?? "application/octet-stream",
    // La que el cliente aprobo se entrega como APROBADO-CLIENTE, la version
    // final de la nomenclatura; en Drive conserva el nombre con que se subio.
    "Content-Disposition": cabeceraDeNombre(
      version.laAprobada ? comoAprobado(version.nombre) : version.nombre,
      descargar,
    ),
    "Cache-Control": "private, no-store",
    "Accept-Ranges": "bytes",
  });

  if (archivo.trozo) {
    cabeceras.set("Content-Length", String(archivo.trozo.fin - archivo.trozo.inicio + 1));
    cabeceras.set(
      "Content-Range",
      `bytes ${archivo.trozo.inicio}-${archivo.trozo.fin}/${archivo.tamano ?? "*"}`,
    );
  } else if (archivo.tamano !== null) {
    cabeceras.set("Content-Length", String(archivo.tamano));
  }

  const cuerpo =
    archivo.cuerpo instanceof Uint8Array ? new Blob([archivo.cuerpo as BlobPart]) : archivo.cuerpo;

  return new Response(cuerpo, { status: archivo.trozo ? 206 : 200, headers: cabeceras });
}
