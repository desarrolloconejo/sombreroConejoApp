import type { PoolClient } from "pg";

import { anotar, type ActorAuditoria } from "@/lib/auditoria";
import { correoDeBriefEnviado } from "@/lib/correos/plantillas";
import { encolarCorreo } from "@/lib/externos/correo";
import { notificarA } from "@/lib/notificaciones";
import { congelar, erroresParaEnviar, formatoPor, pasosVisibles } from "@/lib/portal/briefs";
import { hashDelContenido } from "@/lib/portal/briefsHash";
import { rutaBrief } from "@/lib/portal/rutas";
import * as briefs from "@/models/briefs";
import type { Respuestas } from "@/types";

/**
 * Llenar y enviar un brief, sea quien sea quien lo llena: un cliente desde su
 * cuenta o un prospecto por su enlace. Las actions de cada uno ponen la
 * guardia y la transaccion con su identidad (`conSesion` o `conEnlace`), y
 * delegan aqui lo que es igual para los dos.
 */

/** Quien llena: su nombre para la firma y, si tiene cuenta, su usuario. */
export type QuienLlena = {
  actor: ActorAuditoria | null;
  usuarioId: number | null;
  nombre: string;
  email: string;
};

/** El buzon del estudio que recibe copia de cada brief, si esta configurado. */
function buzonDelEstudio(): string | null {
  const buzon = process.env.BRIEFS_MAILBOX?.trim();
  return buzon && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buzon) ? buzon : null;
}

/** Una fecha AAAA-MM-DD valida, o null. */
export function leerFecha(valor: unknown): string | null {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const fecha = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor ? valor : null;
}

/** Las respuestas que llegan del formulario, como JSON. Lo que no lo es, vacio. */
export function leerRespuestas(valor: unknown): Respuestas {
  if (typeof valor !== "string" || valor.length > 200_000) return {};
  try {
    const objeto = JSON.parse(valor) as unknown;
    return objeto && typeof objeto === "object" && !Array.isArray(objeto) ? (objeto as Respuestas) : {};
  } catch {
    return {};
  }
}

/**
 * Guarda el borrador y apunta quien lleno cada paso que cambio. Devuelve
 * false si el brief ya no admite cambios.
 */
export async function guardarBorrador(
  tx: PoolClient,
  briefId: number,
  datos: { respuestas: Respuestas; fechaAspirada: string | null },
  quien: QuienLlena,
): Promise<boolean> {
  const brief = await briefs.buscarPorId(briefId, tx);
  const previo = await briefs.borradorDe(briefId, tx);
  if (!brief || !previo || !brief.borradorAbierto) return false;

  const formato = formatoPor(brief.formato, brief.formatoVersion);
  if (!formato) return false;

  // Solo se guardan claves del formato: lo demas no es una respuesta.
  const claves = new Set(formato.pasos.flatMap((paso) => paso.preguntas.map((p) => p.clave)));
  const respuestas = Object.fromEntries(
    Object.entries(datos.respuestas).filter(([clave]) => claves.has(clave)),
  );

  const autores = { ...previo.autores };
  for (const paso of formato.pasos) {
    const cambio = paso.preguntas.some(
      (p) => JSON.stringify(respuestas[p.clave] ?? null) !== JSON.stringify(previo.respuestas[p.clave] ?? null),
    );
    if (cambio) autores[paso.id] = quien.nombre;
  }

  await briefs.guardarBorrador(briefId, { respuestas, fechaAspirada: datos.fechaAspirada, autores }, tx);
  return true;
}

export type ResultadoEnvio =
  | { ok: false; errores: Record<string, string>; mensaje?: string }
  | { ok: true; codigo: string; numero: number; correos: number[] };

/**
 * Envia el borrador: lo guarda, valida los pasos visibles, congela el
 * contenido con su hash y deja que la base ponga fecha, codigo y version.
 * Avisa a quien atiende el brief y encola la copia por correo.
 *
 * La fecha de envio nunca sale de aqui: la pone la base con su reloj.
 */
export async function enviar(
  tx: PoolClient,
  briefId: number,
  datos: { respuestas: Respuestas; fechaAspirada: string | null; hoy: string },
  quien: QuienLlena,
): Promise<ResultadoEnvio> {
  const brief = await briefs.buscarPorId(briefId, tx);
  if (!brief || !brief.borradorAbierto) {
    return { ok: false, errores: {}, mensaje: "Este brief no tiene nada que enviar" };
  }

  const formato = formatoPor(brief.formato, brief.formatoVersion);
  if (!formato) return { ok: false, errores: {}, mensaje: "El formato de este brief ya no existe" };

  if (!(await guardarBorrador(tx, briefId, datos, quien))) {
    return { ok: false, errores: {}, mensaje: "Este brief ya no se puede editar" };
  }

  const errores = erroresParaEnviar(formato, datos.respuestas);
  if (!datos.fechaAspirada) {
    errores.fechaAspirada = "Indica la fecha de entrega que aspiras";
  } else if (datos.fechaAspirada < datos.hoy) {
    errores.fechaAspirada = "La fecha de entrega no puede ser anterior a hoy";
  }
  if (Object.keys(errores).length > 0) {
    return { ok: false, errores, mensaje: "Faltan respuestas para poder enviarlo" };
  }

  const contenido = congelar(formato, datos.respuestas, quien.nombre);
  const envio = await briefs.enviar(
    briefId,
    {
      contenido,
      sha256: hashDelContenido(contenido),
      respuestas: datos.respuestas,
      fechaAspirada: datos.fechaAspirada as string,
      nombre: quien.nombre,
    },
    tx,
  );

  await anotar(tx, quien.actor, envio.numero === 1 ? "brief.enviado" : "brief.version_enviada", {
    entidadId: briefId,
    empresaId: brief.empresaId,
    despues: {
      codigo: envio.codigo,
      version: envio.numero,
      pasos: pasosVisibles(formato, datos.respuestas).length,
      fechaAspirada: datos.fechaAspirada,
    },
  });

  // Quien lo atiende se entera en la campana y recibe la copia.
  const equipo = await briefs.atienden(briefId, tx);
  await notificarA(
    tx,
    equipo.map((persona) => persona.id),
    {
      tipo: "brief.enviado",
      titulo:
        envio.numero === 1
          ? `Brief nuevo de ${brief.solicitante}: ${envio.codigo}`
          : `Version ${envio.numero} del brief ${envio.codigo}`,
      cuerpo: `${formato.nombre}. Aspira a tenerlo el ${datos.fechaAspirada}.`,
      href: rutaBrief(briefId),
      empresaId: brief.empresaId,
    },
  );

  const copia = {
    codigo: envio.codigo,
    formato: formato.nombre,
    version: envio.numero,
    solicitante: brief.solicitante,
    fechaAspirada: datos.fechaAspirada as string,
    contenido,
  };

  const destinos = [
    { email: quien.email, usuarioId: quien.usuarioId, empresaId: brief.empresaId, saludo: quien.nombre },
    ...equipo.map((persona) => ({
      email: persona.email,
      usuarioId: persona.id,
      empresaId: brief.empresaId,
      saludo: persona.nombre,
    })),
  ];
  const buzon = buzonDelEstudio();
  if (buzon) destinos.push({ email: buzon, usuarioId: null, empresaId: brief.empresaId, saludo: "equipo" });

  const correos: number[] = [];
  for (const destino of destinos) {
    correos.push(await encolarCorreo(tx, quien.actor, correoDeBriefEnviado(destino, copia)));
  }

  return { ok: true, codigo: envio.codigo, numero: envio.numero, correos };
}
