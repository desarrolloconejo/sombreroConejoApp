import type { NuevoCorreo } from "@/types";

/**
 * Lo que dice cada correo. Funciones puras: entran datos, sale el mensaje.
 *
 * UNA REGLA, Y SU UNICA EXCEPCION
 * -------------------------------
 * Ningun correo lleva una contrasena, ni un token, ni un codigo. La bandeja
 * de salida guarda el texto completo de todo lo que se envia, y un correo se
 * reenvia, se archiva y se lee en pantallas ajenas. La contrasena provisional
 * la sigue entregando en mano quien da el alta, como hasta ahora; el correo
 * solo avisa de que existe.
 *
 * La excepcion es el enlace de «Olvide mi contrasena», y aun asi el texto que
 * sale de aqui no lo lleva: lleva `MARCADOR_ENLACE`, que es lo que guarda la
 * bandeja, y el adaptador lo cambia por el enlace solo al enviarlo.
 *
 * El texto es plano a proposito: se lee igual en cualquier cliente, y en modo
 * simulado es lo que un administrador copia para entregarlo a mano.
 */

/** A donde se entra. En desarrollo no hay dominio, y el enlace no se pone. */
function direccionDeAcceso(): string | null {
  const url = process.env.APP_URL_PUBLICA?.trim();

  return url ? `${url.replace(/\/+$/, "")}/login` : null;
}

function despedida(): string {
  return "\n\nEl Conejo del Sombrero";
}

type Destinatario = {
  id: number;
  nombre: string;
  email: string;
  empresaId: number | null;
};

/** El aviso a quien acaba de recibir una cuenta. */
export function correoDeBienvenida(persona: Destinatario): NuevoCorreo {
  const acceso = direccionDeAcceso();

  return {
    para: persona.email,
    paraUsuarioId: persona.id,
    empresaId: persona.empresaId,
    tipo: "bienvenida",
    asunto: "Tu acceso a Conejo App",
    cuerpo:
      `Hola, ${persona.nombre}:\n\n` +
      "Ya tienes una cuenta en Conejo App, la plataforma de El Conejo del Sombrero.\n\n" +
      `Entras con este correo: ${persona.email}\n` +
      (acceso ? `Desde aqui: ${acceso}\n` : "") +
      "\nLa contrasena provisional te la entrega la persona que te dio el acceso. " +
      "Al entrar por primera vez se te pedira que la cambies por una propia." +
      despedida(),
  };
}

/** El aviso a quien le restablecieron la contrasena. */
export function correoDeClaveRestablecida(persona: Destinatario): NuevoCorreo {
  return {
    para: persona.email,
    paraUsuarioId: persona.id,
    empresaId: persona.empresaId,
    tipo: "clave_restablecida",
    asunto: "Tu contrasena de Conejo App se restablecio",
    cuerpo:
      `Hola, ${persona.nombre}:\n\n` +
      "Un administrador restablecio la contrasena de tu cuenta de Conejo App. " +
      "Las sesiones que tenias abiertas se cerraron.\n\n" +
      "La contrasena provisional te la entrega esa persona. " +
      "Al entrar se te pedira que la cambies por una propia.\n\n" +
      "Si no esperabas este cambio, avisa a la agencia." +
      despedida(),
  };
}

/**
 * Lo que guarda la bandeja en el lugar del enlace de «Olvide mi contrasena».
 * El adaptador lo cambia por el enlace de verdad solo en el correo que envia.
 */
export const MARCADOR_ENLACE = "[enlace privado: solo va en el correo enviado]";

/** El enlace para poner una contrasena nueva, que se pidio desde el login. */
export function correoDeRecuperarClave(persona: Destinatario, minutos: number): NuevoCorreo {
  return {
    para: persona.email,
    paraUsuarioId: persona.id,
    empresaId: persona.empresaId,
    tipo: "clave_recuperar",
    asunto: "Elige una contrasena nueva para Conejo App",
    cuerpo:
      `Hola, ${persona.nombre}:\n\n` +
      "Pediste una contrasena nueva para tu cuenta de Conejo App. Abre este " +
      "enlace para elegirla:\n\n" +
      `${MARCADOR_ENLACE}\n\n` +
      `El enlace vence en ${minutos} minutos y sirve una sola vez. Al usarlo se ` +
      "cerraran las sesiones que tengas abiertas.\n\n" +
      "Si no lo pediste tu, ignora este correo: tu contrasena no cambia." +
      despedida(),
  };
}

/**
 * El aviso de que la contrasena cambio, por si no fue la propia persona. No
 * lleva nada privado: solo la direccion donde pedir otra.
 */
export function correoDeClaveCambiada(
  persona: Destinatario,
  como: "perfil" | "enlace",
  cuando: string,
): NuevoCorreo {
  const acceso = direccionDeAcceso();

  return {
    para: persona.email,
    paraUsuarioId: persona.id,
    empresaId: persona.empresaId,
    tipo: "clave_cambiada",
    asunto: "Tu contrasena de Conejo App cambio",
    cuerpo:
      `Hola, ${persona.nombre}:\n\n` +
      `La contrasena de tu cuenta de Conejo App cambio el ${cuando}` +
      (como === "enlace"
        ? ", con el enlace que se envio a este correo. Las sesiones que tenias abiertas se cerraron.\n\n"
        : ", desde Mi perfil.\n\n") +
      "Si no fuiste tu, avisa a la agencia cuanto antes" +
      (acceso ? ` o pide una contrasena nueva en ${acceso.replace(/\/login$/, "/recuperar")}.` : ".") +
      despedida(),
  };
}

/**
 * La copia exacta de un brief enviado: todas las respuestas, con el texto de
 * su pregunta, tal como quedaron congeladas. Sale del contenido congelado,
 * nunca del borrador.
 *
 * Va a quien lo envio, a los ejecutivos que lo atienden y al buzon del
 * estudio. El destinatario puede no tener cuenta (un prospecto, el buzon).
 */
export function correoDeBriefEnviado(
  destino: { email: string; usuarioId: number | null; empresaId: number | null; saludo: string },
  brief: {
    codigo: string;
    formato: string;
    version: number;
    solicitante: string;
    fechaAspirada: string;
    contenido: { paso: string; numero: number | null; pregunta: string; textoMostrado: string }[];
  },
): NuevoCorreo {
  const lineas: string[] = [];
  let pasoActual = "";

  for (const respuesta of brief.contenido) {
    if (respuesta.paso !== pasoActual) {
      pasoActual = respuesta.paso;
      lineas.push("", respuesta.paso.toUpperCase(), "");
    }
    const numero = respuesta.numero === null ? "" : `${respuesta.numero}. `;
    lineas.push(`${numero}${respuesta.pregunta}`, `   ${respuesta.textoMostrado}`);
  }

  const version = brief.version > 1 ? ` (version ${brief.version})` : "";

  return {
    para: destino.email,
    paraUsuarioId: destino.usuarioId,
    empresaId: destino.empresaId,
    tipo: "brief_enviado",
    asunto: `Brief ${brief.codigo}${version}: ${brief.formato}`,
    cuerpo:
      `Hola, ${destino.saludo}:\n\n` +
      `Esta es la copia del brief ${brief.codigo}${version} de ${brief.solicitante}, ` +
      `tal como se envio. Fecha de entrega que se aspira: ${brief.fechaAspirada}.\n` +
      lineas.join("\n") +
      "\n" +
      despedida(),
  };
}

/**
 * El aviso a quien ve las finanzas de una empresa: tiene un presupuesto para
 * aprobar.
 *
 * Dice cual y hasta cuando vale, sin importes: el detalle se ve dentro, con
 * su sesion. Un correo reenviado no deberia llevar lo que cuesta un trabajo.
 */
export function correoDePresupuestoEnviado(
  persona: Destinatario,
  presupuesto: { numero: string; titulo: string; validoHasta: string },
): NuevoCorreo {
  const acceso = direccionDeAcceso();

  return {
    para: persona.email,
    paraUsuarioId: persona.id,
    empresaId: persona.empresaId,
    tipo: "presupuesto_enviado",
    asunto: `Tienes un presupuesto para aprobar: ${presupuesto.titulo}`,
    cuerpo:
      `Hola, ${persona.nombre}:\n\n` +
      `Te enviamos el presupuesto ${presupuesto.numero}, «${presupuesto.titulo}». ` +
      `Vale hasta el ${presupuesto.validoHasta}.\n\n` +
      "Puedes verlo y aprobarlo o rechazarlo desde Facturacion" +
      (acceso ? `, entrando aqui: ${acceso}` : "") +
      ".\n" +
      despedida(),
  };
}

/**
 * El aviso a quien aprueba por una empresa: una pieza espera su revision.
 *
 * Solo dice cual y donde verla. No lleva la pieza ni enlaces a sus archivos:
 * eso se ve dentro, con su sesion.
 */
export function correoDePiezaEnRevision(
  persona: Destinatario,
  pieza: { titulo: string; proyecto: string },
): NuevoCorreo {
  const acceso = direccionDeAcceso();

  return {
    para: persona.email,
    paraUsuarioId: persona.id,
    empresaId: persona.empresaId,
    tipo: "pieza_en_revision",
    asunto: `Una pieza espera tu revision: ${pieza.titulo}`,
    cuerpo:
      `Hola, ${persona.nombre}:\n\n` +
      `«${pieza.titulo}», del proyecto ${pieza.proyecto}, esta lista para que la revises.\n\n` +
      "Puedes aprobarla o pedir una correccion desde Mis proyectos" +
      (acceso ? `, entrando aqui: ${acceso}` : "") +
      ".\n" +
      despedida(),
  };
}
