import { conSesion } from "@/lib/db";
import { numeroFactura } from "@/lib/finanzas/documentos";
import { pdfDeFactura } from "@/lib/finanzas/pdfFactura";
import { conservaElAcceso, usuarioActual } from "@/lib/sesion";
import { comoIdentificador } from "@/lib/validaciones";
import * as ajustes from "@/models/ajustesFinanzas";
import * as facturas from "@/models/facturas";

/**
 * El PDF de una factura para imprimir sobre el talonario: solo el texto
 * variable, en las coordenadas de un formato (el habitual, o el de
 * `?formato=`). Sale de los datos congelados de la factura: se regenera
 * identico. Lo pide quien opera finanzas; la base lo decide con su sesion
 * (los formatos solo los ve el operador).
 *
 * Lo que no se puede ver responde 404, nunca 403.
 */

export const dynamic = "force-dynamic";

function noEncontrado(): Response {
  return new Response("No encontrado", { status: 404, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(peticion: Request, contexto: RouteContext<"/api/facturas/[id]/pdf">): Promise<Response> {
  const usuario = await usuarioActual();
  if (!usuario || !conservaElAcceso(usuario) || usuario.debeCambiarClave) return noEncontrado();

  const id = comoIdentificador((await contexto.params).id);
  if (id === null) return noEncontrado();
  const formatoId = comoIdentificador(new URL(peticion.url).searchParams.get("formato"));

  const datos = await conSesion(usuario, async (tx) => {
    const factura = await facturas.buscarPorId(id, tx);
    const formato = formatoId !== null ? await ajustes.formato(formatoId, tx) : await ajustes.formatoHabitual(tx);
    if (!factura || !formato) return null;
    return { factura, formato, renglones: await facturas.renglones(id, tx) };
  });
  if (!datos) return noEncontrado();

  const bytes = await pdfDeFactura(datos.factura, datos.renglones, datos.formato);
  const nombre = `factura-${numeroFactura(datos.factura.serie, datos.factura.numero)}.pdf`;

  return new Response(new Blob([bytes as BlobPart]), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nombre}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
