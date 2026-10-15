"use server";

import { revalidatePath } from "next/cache";

import { anotar } from "@/lib/auditoria";
import { conEnlace, esErrorPostgres } from "@/lib/db";
import { entregarCorreos } from "@/lib/externos/correo";
import { notificarA } from "@/lib/notificaciones";
import { formatoPor } from "@/lib/portal/briefs";
import { enlaceValido, rutaDelEnlace, type EnlaceValido } from "@/lib/portal/enlaceBrief";
import { hoyEnCaracas } from "@/lib/portal/fases";
import {
  enviar,
  guardarBorrador,
  leerFecha,
  leerRespuestas,
  type QuienLlena,
} from "@/lib/portal/llenadoBrief";
import { RUTA_BRIEFS, rutaBrief } from "@/lib/portal/rutas";
import { comoIdentificador, limpiarTexto } from "@/lib/validaciones";
import * as briefs from "@/models/briefs";
import * as enlaces from "@/models/enlacesBrief";
import type { EstadoFormulario, Respuestas } from "@/types";

/**
 * El brief de un prospecto, por su enlace privado (S-05).
 *
 * Estas actions NO llevan guardia de sesion, a proposito: quien llega por el
 * enlace no tiene cuenta. Su guardia es el token, que cada una comprueba
 * antes de nada (`enlaceValido`), y su identidad ante la base es el enlace
 * (`conEnlace`): las politicas le dejan su brief y nada mas.
 *
 * El token llega como primer argumento, atado con `bind` en la page.
 */

const ENLACE_NO_VALIDO: EstadoFormulario = {
  ok: false,
  mensaje: "Este enlace ya no es valido. Pide uno nuevo a tu ejecutivo de cuentas",
};

/** El prospecto que llena: firma con su nombre, sin usuario. */
async function quienEs(enlace: EnlaceValido): Promise<QuienLlena | null> {
  const prospecto = await conEnlace(enlace.id, (tx) => enlaces.prospectoDe(enlace.id, tx));
  if (!prospecto) return null;
  return { actor: null, usuarioId: null, nombre: prospecto.contactoNombre, email: prospecto.email };
}

function revalidar(token: string, id: number | null): void {
  revalidatePath(rutaDelEnlace(token));
  revalidatePath(RUTA_BRIEFS);
  if (id !== null) revalidatePath(rutaBrief(id));
}

/** Empieza el brief del enlace, con lo que se sabe del prospecto precargado. */
export async function empezarBriefPorEnlace(token: string): Promise<EstadoFormulario> {
  const enlace = await enlaceValido(token);
  if (!enlace) return ENLACE_NO_VALIDO;

  const formato = formatoPor(enlace.formato, enlace.formatoVersion);
  if (!formato) return { ok: false, mensaje: "Este tipo de brief ya no existe" };

  try {
    await conEnlace(enlace.id, async (tx) => {
      // Un enlace, un brief: si ya se empezo, se sigue con ese.
      if ((await briefs.deEnlace(enlace.id, tx)) !== null) return;

      const prospecto = await enlaces.prospectoDe(enlace.id, tx);
      if (!prospecto) throw new Error("El enlace no tiene prospecto");

      const respuestas: Respuestas = {};
      for (const pregunta of formato.pasos.flatMap((paso) => paso.preguntas)) {
        if (pregunta.prellenarDe === "cliente.nombre") respuestas[pregunta.clave] = prospecto.empresaNombre;
        else if (pregunta.prellenarDe === "usuario.nombre") respuestas[pregunta.clave] = prospecto.contactoNombre;
        else if (pregunta.prellenarDe === "usuario.email") respuestas[pregunta.clave] = prospecto.email;
      }

      const id = await briefs.crear(
        {
          formato: formato.clave,
          formatoVersion: formato.version,
          empresaId: null,
          prospectoId: prospecto.id,
          enlaceId: enlace.id,
          creadoPor: null,
          respuestas,
        },
        tx,
      );

      await anotar(tx, null, "brief.creado", {
        entidadId: id,
        despues: { formato: formato.clave, version: formato.version, enlace: enlace.id },
      });
    });
  } catch (error) {
    // Dos pestanas a la vez: el indice deja un solo brief por enlace.
    if (!esErrorPostgres(error, "23505")) throw error;
  }

  revalidatePath(rutaDelEnlace(token));
  return { ok: true, mensaje: "Brief listo para llenar" };
}

/** Guarda el borrador. Lo llama el formulario mientras se escribe. */
export async function guardarPorEnlace(
  token: string,
  briefId: number,
  respuestasJson: string,
  fechaAspirada: string,
): Promise<{ ok: boolean; mensaje?: string }> {
  const enlace = await enlaceValido(token);
  if (!enlace) return { ok: false, mensaje: ENLACE_NO_VALIDO.mensaje };

  const quien = await quienEs(enlace);
  if (!quien) return { ok: false, mensaje: ENLACE_NO_VALIDO.mensaje };

  try {
    const guardado = await conEnlace(enlace.id, (tx) =>
      guardarBorrador(
        tx,
        briefId,
        { respuestas: leerRespuestas(respuestasJson), fechaAspirada: leerFecha(fechaAspirada) },
        quien,
      ),
    );
    return guardado ? { ok: true } : { ok: false, mensaje: "Este brief ya no se puede editar" };
  } catch (error) {
    if (esErrorPostgres(error, "23514") || esErrorPostgres(error, "42501")) {
      return { ok: false, mensaje: "Este brief ya no se puede editar" };
    }
    throw error;
  }
}

/** Envia el brief: la primera vez, o una version nueva. */
export async function enviarPorEnlace(
  token: string,
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const enlace = await enlaceValido(token);
  if (!enlace) return ENLACE_NO_VALIDO;

  const id = comoIdentificador(datos.get("id"));
  if (id === null) return { ok: false, mensaje: "No se encontro el brief" };

  const quien = await quienEs(enlace);
  if (!quien) return ENLACE_NO_VALIDO;

  let resultado;
  try {
    resultado = await conEnlace(enlace.id, (tx) =>
      enviar(
        tx,
        id,
        {
          respuestas: leerRespuestas(datos.get("respuestas")),
          fechaAspirada: leerFecha(datos.get("fechaAspirada")),
          hoy: hoyEnCaracas(),
        },
        quien,
      ),
    );
  } catch (error) {
    if (esErrorPostgres(error, "23514")) {
      return { ok: false, mensaje: "No se pudo enviar: revisa la fecha de entrega" };
    }
    if (esErrorPostgres(error, "42501")) return ENLACE_NO_VALIDO;
    throw error;
  }

  if (!resultado.ok) return { ok: false, errores: resultado.errores, mensaje: resultado.mensaje };

  // La copia sale despues de confirmar el envio, nunca dentro.
  await entregarCorreos({ enlaceId: enlace.id }, resultado.correos);
  revalidar(token, id);

  return {
    ok: true,
    mensaje:
      resultado.numero === 1
        ? `Brief enviado. Su codigo es ${resultado.codigo}`
        : `Version ${resultado.numero} del brief ${resultado.codigo} enviada`,
  };
}

/** Abre una version nueva del brief, con lo ultimo enviado (S-08). */
export async function abrirVersionPorEnlace(
  token: string,
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const enlace = await enlaceValido(token);
  if (!enlace) return ENLACE_NO_VALIDO;

  const id = comoIdentificador(datos.get("id"));
  if (id === null) return { ok: false, mensaje: "No se encontro el brief" };

  try {
    await conEnlace(enlace.id, (tx) => briefs.abrirVersion(id, tx));
  } catch (error) {
    if (esErrorPostgres(error, "23514") || esErrorPostgres(error, "42501")) {
      return { ok: false, mensaje: "Este brief ya no admite cambios" };
    }
    throw error;
  }

  revalidar(token, id);
  return { ok: true, mensaje: "Version nueva abierta. Cambia lo que haga falta y enviala" };
}

/** Escribe en el hilo de aclaraciones, a nombre del prospecto. */
export async function aclararPorEnlace(
  token: string,
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const enlace = await enlaceValido(token);
  if (!enlace) return ENLACE_NO_VALIDO;

  const id = comoIdentificador(datos.get("id"));
  const texto = limpiarTexto(datos.get("texto"), 2000);
  if (id === null) return { ok: false, mensaje: "No se encontro el brief" };
  if (!texto) return { ok: false, errores: { texto: "Escribe tu mensaje" } };

  const quien = await quienEs(enlace);
  if (!quien) return ENLACE_NO_VALIDO;

  const resultado = await conEnlace(enlace.id, async (tx) => {
    const brief = await briefs.buscarPorId(id, tx);
    if (!brief || brief.estado === "borrador") return { error: "Este brief todavia no se ha enviado" };

    await briefs.aclarar(id, { autorId: null, autorNombre: quien.nombre, delEquipo: false, texto }, tx);
    await anotar(tx, null, "brief.aclaracion", { entidadId: id, empresaId: brief.empresaId });

    const equipo = await briefs.atienden(id, tx);
    await notificarA(
      tx,
      equipo.map((persona) => persona.id),
      {
        tipo: "brief.aclaracion",
        titulo: `${quien.nombre} escribio en el brief ${brief.codigo}`,
        cuerpo: texto.slice(0, 140),
        href: rutaBrief(id),
        empresaId: brief.empresaId,
      },
    );

    return { ok: true as const };
  });

  if ("error" in resultado) return { ok: false, mensaje: resultado.error };

  revalidar(token, id);
  return { ok: true, mensaje: "Mensaje enviado" };
}
