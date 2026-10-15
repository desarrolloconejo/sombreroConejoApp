import { conSesion } from "@/lib/db";
import { pdfDeCalibracion } from "@/lib/finanzas/pdfFactura";
import { conservaElAcceso, usuarioActual } from "@/lib/sesion";
import { comoIdentificador } from "@/lib/validaciones";
import * as ajustes from "@/models/ajustesFinanzas";

/**
 * La hoja de calibracion de un formato de impresion: cuadricula en milimetros
 * y cada dato recuadrado. Solo para quien opera finanzas: los formatos solo
 * los ve el operador, y lo que no se ve responde 404.
 */

export const dynamic = "force-dynamic";

function noEncontrado(): Response {
  return new Response("No encontrado", { status: 404, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(
  _peticion: Request,
  contexto: RouteContext<"/api/formatos/[id]/calibracion">,
): Promise<Response> {
  const usuario = await usuarioActual();
  if (!usuario || !conservaElAcceso(usuario) || usuario.debeCambiarClave) return noEncontrado();

  const id = comoIdentificador((await contexto.params).id);
  if (id === null) return noEncontrado();

  const formato = await conSesion(usuario, (tx) => ajustes.formato(id, tx));
  if (!formato) return noEncontrado();

  const bytes = await pdfDeCalibracion(formato);

  return new Response(new Blob([bytes as BlobPart]), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="calibracion-${id}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
