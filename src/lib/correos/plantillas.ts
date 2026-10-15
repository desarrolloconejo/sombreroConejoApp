import type { NuevoCorreo } from "@/types";

/**
 * Lo que dice cada correo. Funciones puras: entran datos, sale el mensaje.
 *
 * UNA REGLA SIN EXCEPCIONES
 * -------------------------
 * Ningun correo lleva una contrasena, ni un token, ni un codigo. La bandeja
 * de salida guarda el texto completo de todo lo que se envia, y un correo se
 * reenvia, se archiva y se lee en pantallas ajenas. La contrasena provisional
 * la sigue entregando en mano quien da el alta, como hasta ahora; el correo
 * solo avisa de que existe.
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
