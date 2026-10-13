/**
 * El acceso a las API de Google, compartido por los adaptadores que las usan.
 *
 * Es el mismo cliente OAuth para todo: Drive (comprobantes) y Gmail (correo).
 * Lo autoriza una vez `npm run drive:probar`, que deja en el entorno el token
 * de renovacion. Aqui solo se cambia ese token por uno de acceso de una hora,
 * cada vez que hace falta.
 *
 * No usa ninguna libreria: es una peticion HTTP y Node trae `fetch`.
 */

/** Cuanto se espera a Google antes de dar la peticion por perdida. */
export const ESPERA_GOOGLE = 12_000;

/**
 * Un token de acceso de una hora.
 *
 * No se guarda entre peticiones: en una funcion sin estado no hay donde, y
 * pedirlo es una sola llamada. Las variables se leen aqui y no al cargar el
 * modulo, para que compilar no exija tenerlas.
 */
export async function tokenDeGoogle(): Promise<string> {
  const clientId = process.env.DRIVE_CLIENT_ID;
  const secreto = process.env.SECRET_DRIVE_KEY1;
  const renovacion = process.env.DRIVE_REFRESH_TOKEN;

  if (!clientId || !secreto || !renovacion) {
    throw new Error(
      "Falta la autorizacion de Google: DRIVE_CLIENT_ID, SECRET_DRIVE_KEY1 o DRIVE_REFRESH_TOKEN",
    );
  }

  const respuesta = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: secreto,
      refresh_token: renovacion,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(ESPERA_GOOGLE),
  });

  if (!respuesta.ok) {
    // El cuerpo no se incluye en el error: puede repetir datos del cliente.
    throw new Error(`Google no renovo el acceso (${respuesta.status})`);
  }

  const datos = (await respuesta.json()) as { access_token?: unknown };

  if (typeof datos.access_token !== "string") {
    throw new Error("Google no devolvio un token de acceso");
  }

  return datos.access_token;
}
