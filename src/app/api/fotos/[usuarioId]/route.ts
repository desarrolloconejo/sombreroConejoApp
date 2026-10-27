import { leerArchivo } from "@/lib/externos/archivos";
import { conservaElAcceso, usuarioActual } from "@/lib/sesion";
import { comoIdentificador } from "@/lib/validaciones";
import * as usuarios from "@/models/usuarios";

/**
 * La foto de perfil de una persona.
 *
 * Vive en Drive (o en la base, en modo simulado) y el navegador no sabe
 * donde: pide esta ruta con el id de la persona. La ve cualquiera con sesion
 * (equipo y clientes, donde hoy salen las iniciales); sin sesion, nadie. Lo
 * que no se puede ver responde 404, nunca 403.
 *
 * La URL que se pinta lleva `?v=`, que cambia con cada foto: por eso se puede
 * guardar en la cache del navegador sin que se quede la vieja.
 */

export const dynamic = "force-dynamic";

/** El tipo de cada extension que admite una foto (la de la version de su URL). */
const TIPOS: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function noEncontrado(): Response {
  return new Response("No encontrado", {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(
  _peticion: Request,
  contexto: RouteContext<"/api/fotos/[usuarioId]">,
): Promise<Response> {
  const usuario = await usuarioActual();
  if (!usuario || !conservaElAcceso(usuario) || usuario.debeCambiarClave) return noEncontrado();

  const id = comoIdentificador((await contexto.params).usuarioId);
  if (id === null) return noEncontrado();

  const foto = await usuarios.archivoDeFoto(id);
  if (!foto) return noEncontrado();

  const leido = await leerArchivo(foto.archivo, null);
  if (!leido) return noEncontrado();

  const extension = foto.fotoUrl.split(".").pop();
  const tipo = TIPOS[extension ?? ""];
  if (!tipo) return noEncontrado();

  const cuerpo = leido.cuerpo instanceof Uint8Array ? new Blob([leido.cuerpo as BlobPart]) : leido.cuerpo;

  return new Response(cuerpo, {
    headers: {
      "Content-Type": tipo,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      ...(leido.tamano !== null ? { "Content-Length": String(leido.tamano) } : {}),
    },
  });
}
