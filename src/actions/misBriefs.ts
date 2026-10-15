"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { anotar } from "@/lib/auditoria";
import { conSesion, esErrorPostgres } from "@/lib/db";
import { entregarCorreos } from "@/lib/externos/correo";
import { notificarA } from "@/lib/notificaciones";
import { formatosVigentes } from "@/lib/portal/briefs";
import { hoyEnCaracas } from "@/lib/portal/fases";
import {
  enviar,
  guardarBorrador,
  leerFecha,
  leerRespuestas,
  type QuienLlena,
} from "@/lib/portal/llenadoBrief";
import { RUTA_BRIEFS, RUTA_MIS_BRIEFS, rutaBrief, rutaMiBrief } from "@/lib/portal/rutas";
import { requerirEmpresa } from "@/lib/sesion";
import { comoIdentificador, limpiarTexto } from "@/lib/validaciones";
import * as briefs from "@/models/briefs";
import type { EstadoFormulario, Respuestas, UsuarioCompleto } from "@/types";

/**
 * Los briefs del lado del cliente: cualquier persona de la empresa los
 * empieza, los llena —varias a la vez si hace falta— y los envia (S-04).
 *
 * Lo que es igual para un prospecto vive en src/lib/portal/llenadoBrief.ts;
 * aqui va la guardia y la identidad del cliente.
 */

function quienEs(usuario: UsuarioCompleto): QuienLlena {
  return {
    actor: usuario,
    usuarioId: usuario.id,
    nombre: `${usuario.nombre} ${usuario.apellido}`.trim(),
    email: usuario.email,
  };
}

function revalidar(id: number): void {
  revalidatePath(RUTA_MIS_BRIEFS);
  revalidatePath(rutaMiBrief(id));
  revalidatePath(RUTA_BRIEFS);
  revalidatePath(rutaBrief(id));
}

/** Empieza un brief del formato elegido, con lo que ya se sabe precargado. */
export async function nuevoBrief(_estadoPrevio: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const { usuario, empresaId } = await requerirEmpresa();

  const formato = formatosVigentes().find((f) => f.clave === datos.get("formato"));
  if (!formato) return { ok: false, mensaje: "Elige un tipo de brief" };

  // Lo que el formato pide precargar sale de la cuenta, no del navegador.
  const respuestas: Respuestas = {};
  for (const pregunta of formato.pasos.flatMap((paso) => paso.preguntas)) {
    if (pregunta.prellenarDe === "cliente.nombre" && usuario.empresaNombre) {
      respuestas[pregunta.clave] = usuario.empresaNombre;
    } else if (pregunta.prellenarDe === "usuario.nombre") {
      respuestas[pregunta.clave] = `${usuario.nombre} ${usuario.apellido}`.trim();
    } else if (pregunta.prellenarDe === "usuario.email") {
      respuestas[pregunta.clave] = usuario.email;
    }
  }

  const id = await conSesion(usuario, async (tx) => {
    const nuevo = await briefs.crear(
      {
        formato: formato.clave,
        formatoVersion: formato.version,
        empresaId,
        prospectoId: null,
        enlaceId: null,
        creadoPor: usuario.id,
        respuestas,
      },
      tx,
    );

    await anotar(tx, usuario, "brief.creado", {
      entidadId: nuevo,
      empresaId,
      despues: { formato: formato.clave, version: formato.version },
    });

    return nuevo;
  });

  revalidatePath(RUTA_MIS_BRIEFS);
  redirect(rutaMiBrief(id));
}

/**
 * Guarda el borrador. La llama el formulario cada poco mientras se escribe,
 * y el boton de guardar. No revalida: el formulario ya tiene lo que guardo.
 */
export async function guardarMiBrief(
  briefId: number,
  respuestasJson: string,
  fechaAspirada: string,
): Promise<{ ok: boolean; mensaje?: string }> {
  const { usuario } = await requerirEmpresa();

  try {
    const guardado = await conSesion(usuario, (tx) =>
      guardarBorrador(
        tx,
        briefId,
        { respuestas: leerRespuestas(respuestasJson), fechaAspirada: leerFecha(fechaAspirada) },
        quienEs(usuario),
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
export async function enviarMiBrief(_estadoPrevio: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const { usuario } = await requerirEmpresa();

  const id = comoIdentificador(datos.get("id"));
  if (id === null) return { ok: false, mensaje: "No se encontro el brief" };

  let resultado;
  try {
    resultado = await conSesion(usuario, (tx) =>
      enviar(
        tx,
        id,
        {
          respuestas: leerRespuestas(datos.get("respuestas")),
          fechaAspirada: leerFecha(datos.get("fechaAspirada")),
          hoy: hoyEnCaracas(),
        },
        quienEs(usuario),
      ),
    );
  } catch (error) {
    if (esErrorPostgres(error, "23514")) {
      return { ok: false, mensaje: "No se pudo enviar: revisa la fecha de entrega" };
    }
    throw error;
  }

  if (!resultado.ok) return { ok: false, errores: resultado.errores, mensaje: resultado.mensaje };

  // La copia sale despues de confirmar el envio, nunca dentro.
  await entregarCorreos(usuario, resultado.correos);
  revalidar(id);

  return {
    ok: true,
    mensaje:
      resultado.numero === 1
        ? `Brief enviado. Su codigo es ${resultado.codigo}`
        : `Version ${resultado.numero} del brief ${resultado.codigo} enviada`,
  };
}

/** Abre una version nueva del brief, con lo ultimo enviado (S-08). */
export async function abrirVersionMiBrief(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const { usuario } = await requerirEmpresa();

  const id = comoIdentificador(datos.get("id"));
  if (id === null) return { ok: false, mensaje: "No se encontro el brief" };

  try {
    await conSesion(usuario, (tx) => briefs.abrirVersion(id, tx));
  } catch (error) {
    if (esErrorPostgres(error, "23514")) {
      return { ok: false, mensaje: "Este brief ya no admite cambios: van por el proyecto" };
    }
    throw error;
  }

  revalidar(id);
  return { ok: true, mensaje: "Version nueva abierta. Cambia lo que haga falta y enviala" };
}

/** Escribe en el hilo de aclaraciones del brief. */
export async function aclararMiBrief(_estadoPrevio: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const { usuario } = await requerirEmpresa();

  const id = comoIdentificador(datos.get("id"));
  const texto = limpiarTexto(datos.get("texto"), 2000);
  if (id === null) return { ok: false, mensaje: "No se encontro el brief" };
  if (!texto) return { ok: false, errores: { texto: "Escribe tu mensaje" } };

  const resultado = await conSesion(usuario, async (tx) => {
    const brief = await briefs.buscarPorId(id, tx);
    if (!brief || brief.estado === "borrador") return { error: "Este brief todavia no se ha enviado" };

    const nombre = `${usuario.nombre} ${usuario.apellido}`.trim();
    await briefs.aclarar(id, { autorId: usuario.id, autorNombre: nombre, delEquipo: false, texto }, tx);
    await anotar(tx, usuario, "brief.aclaracion", { entidadId: id, empresaId: brief.empresaId });

    const equipo = await briefs.atienden(id, tx);
    await notificarA(
      tx,
      equipo.map((persona) => persona.id),
      {
        tipo: "brief.aclaracion",
        titulo: `${nombre} escribio en el brief ${brief.codigo}`,
        cuerpo: texto.slice(0, 140),
        href: rutaBrief(id),
        empresaId: brief.empresaId,
      },
    );

    return { ok: true as const };
  });

  if ("error" in resultado) return { ok: false, mensaje: resultado.error };

  revalidar(id);
  return { ok: true, mensaje: "Mensaje enviado" };
}
