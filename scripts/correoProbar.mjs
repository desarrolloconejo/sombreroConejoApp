/**
 * Envia un correo de prueba por la API de Gmail, sin pasar por la aplicacion.
 *
 *   npm run correo:probar -- destino@ejemplo.com
 *
 * Sirve para comprobar la autorizacion de Google antes de poner
 * CORREO_MODO=real: si este correo llega, la aplicacion tambien podra enviar.
 * Sale desde la cuenta que autorizo `npm run google:autorizar`.
 *
 * Envia UN mensaje, solo a la direccion que se le pasa. No lee el buzon ni
 * guarda nada. Se ejecuta en el HOST, con las variables del .env.
 */

const destino = process.argv[2]?.trim() ?? "";

/** Lo minimo para no mandar a algo que no es un correo, ni colar cabeceras. */
const CORREO = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

async function token() {
  const clientId = process.env.DRIVE_CLIENT_ID;
  const secreto = process.env.SECRET_DRIVE_KEY1;
  const renovacion = process.env.DRIVE_REFRESH_TOKEN;

  if (!clientId || !secreto || !renovacion) {
    throw new Error(
      "Faltan DRIVE_CLIENT_ID, SECRET_DRIVE_KEY1 o DRIVE_REFRESH_TOKEN: ejecuta antes npm run google:autorizar",
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
  });

  if (!respuesta.ok) throw new Error(`Google no renovo el acceso (${respuesta.status})`);

  return (await respuesta.json()).access_token;
}

/** El mensaje en el formato que pide Gmail, como lo arma la aplicacion. */
function mensaje(para) {
  const asunto = "Prueba de correo de Conejo App";
  const cuerpo = [
    "Hola:",
    "",
    "Este es un correo de prueba de Conejo App. Si lo lees, la aplicacion",
    "puede enviar correos con esta cuenta de Google.",
    "",
    `Enviado el ${new Date().toLocaleString("es-VE", { timeZone: "America/Caracas" })}.`,
  ].join("\n");

  return [
    `To: ${para}`,
    `Subject: =?UTF-8?B?${Buffer.from(asunto, "utf8").toString("base64")}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(cuerpo, "utf8").toString("base64"),
  ].join("\r\n");
}

async function principal() {
  if (!CORREO.test(destino)) {
    throw new Error("Indica a quien: npm run correo:probar -- destino@ejemplo.com");
  }

  const respuesta = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await token()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: Buffer.from(mensaje(destino), "utf8").toString("base64url") }),
  });

  if (respuesta.status === 403) {
    throw new Error(
      "Google no deja enviar (403): la autorizacion no tiene gmail.send. Ejecuta npm run google:autorizar",
    );
  }
  if (!respuesta.ok) throw new Error(`Gmail respondio ${respuesta.status}`);

  const { id } = await respuesta.json();
  console.log(`Enviado a ${destino} (mensaje ${id}). Revisa la bandeja de entrada y el spam.`);
}

principal().catch((error) => {
  console.error("\nFallo la prueba de correo:", error instanceof Error ? error.message : error);
  process.exit(1);
});
