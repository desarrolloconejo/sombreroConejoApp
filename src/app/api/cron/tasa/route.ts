import { timingSafeEqual } from "node:crypto";

import { actualizarTasas } from "@/lib/finanzas/actualizarTasas";

/**
 * La tarea programada que actualiza la tasa del BCV.
 *
 * La llama el programador de la plataforma —en Vercel, segun `vercel.json`;
 * en un VPS, `cron`— y nadie mas: no hay sesion ni persona detras. Lo que la
 * protege es un secreto en la cabecera, que solo conocen la plataforma y la
 * aplicacion.
 *
 * Es una ruta y no una Server Action porque quien la llama no es un
 * formulario de la aplicacion, sino una peticion HTTP de fuera.
 */

// Lee una pagina ajena y escribe en la base: no se puede dar por sabida.
export const dynamic = "force-dynamic";

/**
 * Compara el secreto recibido con el esperado sin revelar, por el tiempo que
 * tarda, cuantos caracteres acerto quien pregunta.
 */
function secretoCorrecto(recibido: string | null, esperado: string): boolean {
  if (!recibido) return false;

  const a = Buffer.from(recibido);
  const b = Buffer.from(`Bearer ${esperado}`);

  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request): Promise<Response> {
  const secreto = process.env.CRON_SECRET;

  // Sin secreto configurado la ruta no existe para nadie: no se deja abierta
  // por un olvido en el entorno.
  if (!secreto || secreto.length < 32) {
    return Response.json({ ok: false }, { status: 503 });
  }

  if (!secretoCorrecto(request.headers.get("authorization"), secreto)) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const resultado = await actualizarTasas();

  // Un rechazo de la fuente NO es un fallo de la ruta: la tarea corrio, y el
  // motivo ya quedo anotado y notificado. Se responde 200 para que la
  // plataforma no la de por rota y la reintente en bucle.
  return Response.json(resultado);
}
