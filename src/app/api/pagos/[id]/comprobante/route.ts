import { conSesion } from "@/lib/db";
import { leerArchivo } from "@/lib/externos/archivos";
import { conservaElAcceso, usuarioActual } from "@/lib/sesion";
import { comoIdentificador } from "@/lib/validaciones";
import * as pagos from "@/models/pagos";

/**
 * El comprobante de un pago o una retencion. Lo ven quien opera finanzas y el
 * cliente con permiso de la empresa de la factura: lo decide la base con la
 * sesion. El id de Drive no sale del servidor, y lo que no se ve responde
 * 404, nunca 403.
 */

export const dynamic = "force-dynamic";

function noEncontrado(): Response {
  return new Response("No encontrado", { status: 404, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(
  _peticion: Request,
  contexto: RouteContext<"/api/pagos/[id]/comprobante">,
): Promise<Response> {
  const usuario = await usuarioActual();
  if (!usuario || !conservaElAcceso(usuario) || usuario.debeCambiarClave) return noEncontrado();

  const id = comoIdentificador((await contexto.params).id);
  if (id === null) return noEncontrado();

  const comprobante = await conSesion(usuario, (tx) => pagos.comprobanteDe(id, tx));
  if (!comprobante) return noEncontrado();

  const archivo = await leerArchivo(comprobante.archivo, null);
  if (!archivo) return noEncontrado();

  const extension = comprobante.mime === "application/pdf" ? "pdf" : (comprobante.mime.split("/")[1] ?? "bin");
  const cuerpo = archivo.cuerpo instanceof Uint8Array ? new Blob([archivo.cuerpo as BlobPart]) : archivo.cuerpo;

  return new Response(cuerpo, {
    headers: {
      "Content-Type": comprobante.mime,
      "Content-Disposition": `inline; filename="${comprobante.nombre}.${extension}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
