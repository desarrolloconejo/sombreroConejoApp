import type { PoolClient } from "pg";

import { MARCADOR_ENLACE } from "@/lib/correos/plantillas";
import { conEnlace, conSesion, conSistema, type ActorDeBase, type Ejecutor } from "@/lib/db";
import { notificarAAdministradores } from "@/lib/notificaciones";
import * as correos from "@/models/correos";
import type { ModoExterno, NuevoCorreo } from "@/types";

import { ESPERA_GOOGLE, tokenDeGoogle } from "./google";
import { modoDe } from "./modo";

/**
 * El adaptador de correo. La aplicacion no sabe si detras hay un servicio o
 * no: escribe el correo y pide que se entregue.
 *
 * ENVIAR SON DOS PASOS, Y NO ES POR GUSTO
 * ---------------------------------------
 * 1. `encolarCorreo` escribe el mensaje en la bandeja de salida, DENTRO de la
 *    transaccion del cambio que lo provoca. Si el cambio se deshace, el correo
 *    tambien.
 * 2. `entregarCorreos` lo manda, DESPUES de que esa transaccion se confirme.
 *
 * Mandarlo dentro de la transaccion seria peor en los dos sentidos: se
 * tendria una conexion a la base abierta mientras se espera a un servicio
 * ajeno, y si el cambio fallara al final ya se habria enviado un correo
 * anunciando algo que no ocurrio.
 *
 * En modo simulado el segundo paso no hace nada: el mensaje se queda en la
 * bandeja para que un administrador lo lea y lo entregue a mano.
 */

/** El correo arranca simulado: no hay cuenta de la empresa todavia. */
export function modoDeCorreo(): ModoExterno {
  return modoDe("CORREO_MODO", "simulado");
}

/**
 * Escribe un correo en la bandeja de salida, dentro de la transaccion en
 * curso. Devuelve su identificador, que es lo que despues se le pasa a
 * `entregarCorreos`.
 *
 * El ejecutor tiene que venir de `conSesion`: la bandeja tiene seguridad por
 * fila y exige que el correo vaya a nombre de quien declaro la sesion. Sin
 * actor es un prospecto, que escribe por su enlace (`conEnlace`) sin usuario.
 */
export async function encolarCorreo(
  ejecutor: Ejecutor,
  actor: Pick<ActorDeBase, "id"> | null,
  correo: NuevoCorreo,
): Promise<number> {
  const modo = modoDeCorreo();

  return correos.registrar(
    correo,
    {
      modo,
      // El simulado ya esta en su estado final; el real espera su entrega.
      estado: modo === "simulado" ? "simulado" : "pendiente",
      creadoPor: actor?.id ?? null,
    },
    ejecutor,
  );
}

/** Quita lo que permitiria colar una cabecera dentro de otra. */
function unaLinea(texto: string): string {
  return texto.replace(/[\r\n]+/g, " ").trim();
}

/** Base64 con el alfabeto que usan las URL, que es el que pide Gmail. */
function base64Url(texto: string): string {
  return Buffer.from(texto, "utf8").toString("base64url");
}

/**
 * El mensaje tal como viaja: cabeceras, una linea en blanco y el cuerpo.
 *
 * El asunto va codificado segun RFC 2047 porque una cabecera solo admite
 * ASCII, y aqui los asuntos llevan tildes. El cuerpo va en base64 por lo
 * mismo, partido en lineas de 76 caracteres como exige el formato.
 */
function comoMensaje(para: string, asunto: string, cuerpo: string): string {
  const asuntoCodificado = `=?UTF-8?B?${Buffer.from(unaLinea(asunto), "utf8").toString("base64")}?=`;
  const cuerpoCodificado =
    Buffer.from(cuerpo, "utf8").toString("base64").match(/.{1,76}/g)?.join("\r\n") ?? "";

  return [
    `To: ${unaLinea(para)}`,
    `Subject: ${asuntoCodificado}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    cuerpoCodificado,
  ].join("\r\n");
}

/**
 * Manda un mensaje por la API de Gmail y devuelve su identificador.
 *
 * El remitente es la cuenta que autorizo el cliente OAuth
 * (`npm run google:autorizar`). Por ahora es la cuenta personal del
 * responsable; al pasar a la de la empresa basta con autorizar de nuevo con
 * ella y sustituir DRIVE_REFRESH_TOKEN (R12 de docs/pendientesIntegracion.md).
 */
async function enviarPorGmail(para: string, asunto: string, cuerpo: string): Promise<string> {
  const token = await tokenDeGoogle();

  const respuesta = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: base64Url(comoMensaje(para, asunto, cuerpo)) }),
      signal: AbortSignal.timeout(ESPERA_GOOGLE),
    },
  );

  if (!respuesta.ok) {
    throw new Error(`Gmail rechazo el envio (${respuesta.status})`);
  }

  const datos = (await respuesta.json()) as { id?: unknown };

  return typeof datos.id === "string" ? datos.id : "sin-identificador";
}

/**
 * Quien provoco los correos: una persona con sesion, un prospecto por su
 * enlace o el sistema (lo que pide quien aun no tiene sesion, como «Olvide mi
 * contrasena»). Con esa misma identidad se leen y se anotan al entregarlos.
 */
export type Remitente = ActorDeBase | { enlaceId: number } | { sistema: true };

function conRemitente<T>(remitente: Remitente, operacion: (cliente: PoolClient) => Promise<T>): Promise<T> {
  if ("sistema" in remitente) return conSistema(operacion);
  return "enlaceId" in remitente ? conEnlace(remitente.enlaceId, operacion) : conSesion(remitente, operacion);
}

/**
 * Entrega los correos pendientes de la lista. Se llama DESPUES de confirmar
 * la transaccion que los encolo.
 *
 * NUNCA LANZA. El cambio que provoco el correo ya ocurrio y esta confirmado:
 * que el correo no salga no puede convertirse en un error para quien hizo el
 * cambio. Lo que falla queda como «fallido» en la bandeja, con su motivo, y
 * desde ahi se reintenta.
 *
 * `enlaces` lleva, por correo, el enlace privado que va en el lugar de
 * `MARCADOR_ENLACE` (el de «Olvide mi contrasena»): se pone solo en lo que se
 * envia, nunca en la bandeja.
 *
 * Devuelve cuantos se enviaron.
 */
export async function entregarCorreos(
  actor: Remitente,
  ids: readonly number[],
  enlaces: Readonly<Record<number, string>> = {},
): Promise<number> {
  if (modoDeCorreo() === "simulado") {
    // En desarrollo, con el correo simulado, el enlace privado no tiene por
    // donde llegar: sale en la consola del servidor para poder probarlo.
    if (process.env.NODE_ENV !== "production") {
      for (const enlace of Object.values(enlaces)) console.info(`[correo simulado] enlace privado: ${enlace}`);
    }
    return 0;
  }

  if (ids.length === 0) return 0;

  let enviados = 0;

  for (const id of ids) {
    try {
      // La lectura y la anotacion van en transacciones cortas, y la llamada a
      // Gmail queda FUERA de las dos: no se espera a un servicio ajeno con
      // una conexion a la base tomada.
      const correo = await conRemitente(actor, (tx) => correos.paraEntregar(id, tx));

      if (!correo || (correo.estado !== "pendiente" && correo.estado !== "fallido")) {
        continue;
      }

      let resultado: Parameters<typeof correos.anotarEntrega>[1];

      try {
        const enlace = enlaces[id];
        const cuerpo = enlace ? correo.cuerpo.replace(MARCADOR_ENLACE, enlace) : correo.cuerpo;
        const idExterno = await enviarPorGmail(correo.para, correo.asunto, cuerpo);
        resultado = { enviado: true, idExterno };
        enviados++;
      } catch (error) {
        resultado = {
          enviado: false,
          error: error instanceof Error ? error.message : "Error desconocido",
        };
      }

      await conRemitente(actor, async (tx) => {
        await correos.anotarEntrega(id, resultado, tx);

        // Un correo que no salio no se arregla solo: alguien tiene que
        // reintentarlo o hacerlo llegar de otra forma.
        if (!resultado.enviado) {
          await notificarAAdministradores(tx, {
            tipo: "correo.fallido",
            titulo: "Un correo no se pudo enviar",
            cuerpo: `Para ${correo.para}: ${correo.asunto}`,
            href: `/dashboard/salida?panel=ver&id=${id}`,
          });
        }
      });
    } catch (error) {
      console.error(
        "[correo] no se pudo anotar la entrega:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  return enviados;
}
