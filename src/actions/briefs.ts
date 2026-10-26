"use server";

import { revalidatePath } from "next/cache";

import { anotar } from "@/lib/auditoria";
import { correoDeBienvenida } from "@/lib/correos/plantillas";
import { conSesion, esErrorPostgres, type Ejecutor } from "@/lib/db";
import { encolarCorreo, entregarCorreos } from "@/lib/externos/correo";
import { RUTA_PRESUPUESTOS } from "@/lib/finanzas/rutas";
import { notificarA } from "@/lib/notificaciones";
import { generarPasswordProvisional } from "@/lib/claveProvisional";
import { hashear } from "@/lib/password";
import { formatoPor, formatosVigentes } from "@/lib/portal/briefs";
import { rutaDelEnlace } from "@/lib/portal/enlaceBrief";
import { servicioPorSlug } from "@/lib/portal/catalogo";
import { leerFecha } from "@/lib/portal/llenadoBrief";
import {
  RUTA_BRIEFS,
  RUTA_MIS_BRIEFS,
  rutaBrief,
  rutaMiBrief,
  rutaProyecto,
} from "@/lib/portal/rutas";
import { requerirCargo } from "@/lib/sesion";
import { generarToken, hashDeToken } from "@/lib/tokens";
import { comoIdentificador, esEmail, limpiarOpcional, limpiarTexto } from "@/lib/validaciones";
import * as briefs from "@/models/briefs";
import * as clientes from "@/models/clientes";
import * as enlaces from "@/models/enlacesBrief";
import * as piezas from "@/models/piezas";
import * as proyectos from "@/models/proyectos";
import * as tareas from "@/models/tareas";
import * as usuarios from "@/models/usuarios";
import type { Brief, EstadoFormulario, UsuarioCompleto } from "@/types";

/**
 * La bandeja de briefs: lo que decide el ejecutivo de cuentas (o el admin)
 * sobre cada brief recibido. Reglas: appFacturas/docs/05, con S-05 a S-09.
 *
 * Quien decide lo dice la base (`gestiona_brief`): el ejecutivo de la
 * empresa, quien genero el enlace del prospecto, o el admin. Cada decision
 * exige el estado del que parte y, si el brief ya no estaba ahi, no hace nada.
 */

const NO_ENCONTRADO: EstadoFormulario = { ok: false, mensaje: "No se encontro el brief" };

function revalidar(id: number): void {
  revalidatePath(RUTA_BRIEFS);
  revalidatePath(rutaBrief(id));
  revalidatePath(RUTA_MIS_BRIEFS);
  revalidatePath(rutaMiBrief(id));
}

/** Avisa a las personas de la empresa del brief, si ya tiene empresa. */
async function avisarALaEmpresa(
  tx: Ejecutor,
  brief: Brief,
  aviso: {
    tipo: "brief.aceptado" | "brief.a_presupuesto" | "brief.descartado" | "brief.aclaracion" | "brief.fecha_propuesta";
    titulo: string;
    cuerpo?: string | null;
  },
): Promise<void> {
  if (brief.empresaId === null) return;
  const personas = await clientes.activosDe(brief.empresaId, tx);
  await notificarA(
    tx,
    personas.map((persona) => persona.id),
    { ...aviso, href: rutaMiBrief(brief.id), empresaId: brief.empresaId },
  );
}

/**
 * Si el brief es de un prospecto, lo convierte: nace su empresa (asignada al
 * ejecutivo que decide) y su cuenta de cliente, con una contrasena
 * provisional que se entrega en mano. Devuelve la empresa y, si se creo la
 * cuenta, su credencial y el correo de bienvenida encolado.
 *
 * La usan las dos decisiones que lo hacen cliente, aceptar y pasar a
 * presupuesto. Decide por la cuenta y no por la empresa: un brief que ya paso
 * a presupuesto tiene empresa, y su prospecto puede seguir sin cuenta.
 *
 * Quien lleno el brief es quien pidio el trabajo: su cuenta nace pudiendo
 * aprobar piezas y ver las finanzas, o no podria aprobar ni su presupuesto.
 */
async function convertirSiEsProspecto(
  tx: Ejecutor,
  brief: Brief,
  usuario: UsuarioCompleto,
): Promise<{ empresaId: number; credencial: { email: string; password: string } | null; correo: number | null }> {
  if (brief.prospectoId === null) {
    if (brief.empresaId === null) throw new Error("Un brief sin prospecto tiene empresa");
    return { empresaId: brief.empresaId, credencial: null, correo: null };
  }

  // Si ya tiene empresa, la devuelve tal cual: convertir es idempotente.
  const empresaId = await briefs.convertirProspecto(brief.id, tx);
  const prospecto = await briefs.prospectoDe(brief.id, tx);
  if (!prospecto || (await usuarios.existeEmail(prospecto.email))) {
    return { empresaId, credencial: null, correo: null };
  }

  const [nombre, ...resto] = prospecto.contactoNombre.trim().split(/\s+/);
  const provisional = generarPasswordProvisional();
  const creado = await usuarios.crear(
    {
      nombre,
      apellido: resto.join(" ") || "-",
      email: prospecto.email,
      passwordHash: await hashear(provisional),
      telefono: prospecto.telefono,
      debeCambiarClave: true,
    },
    tx,
  );
  await clientes.crear(
    { usuarioId: creado.id, empresaId, cargo: null, puedeAprobar: true, puedeVerFinanzas: true },
    tx,
  );
  await anotar(tx, usuario, "usuario.creado", {
    entidadId: creado.id,
    empresaId,
    despues: { email: creado.email, origen: `brief ${brief.codigo}` },
  });

  const correo = await encolarCorreo(
    tx,
    usuario,
    correoDeBienvenida({ id: creado.id, nombre: creado.nombre, email: creado.email, empresaId }),
  );

  return { empresaId, credencial: { email: creado.email, password: provisional }, correo };
}

/**
 * Aceptar: nace el proyecto (servicio de desarrollo de producto, una pieza
 * con sus cinco fases y las tareas sugeridas) con la fase 1 en curso, y el
 * brief pasa a validacion. Tambien desde «en presupuesto» cuando su
 * presupuesto se aprobo (S-05).
 */
export async function aceptarBrief(_estadoPrevio: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const usuario = await requerirCargo("cuentas");

  const id = comoIdentificador(datos.get("id"));
  if (id === null) return NO_ENCONTRADO;

  const servicio = servicioPorSlug("desarrollo_producto");
  if (!servicio?.piezaUnica) return { ok: false, mensaje: "El servicio de desarrollo de producto no esta en el catalogo" };

  const resultado = await conSesion(usuario, async (tx) => {
    const brief = await briefs.buscarPorId(id, tx);
    if (!brief || brief.codigo === null) return { error: "No se encontro el brief" };

    const puede =
      brief.estado === "enviado" ||
      (brief.estado === "en_presupuesto" && brief.presupuestoEstado === "aprobado");
    if (!puede || brief.proyectoId !== null) return { error: "Este brief ya no esta para aceptarse" };

    const conversion = await convertirSiEsProspecto(tx, brief, usuario);
    const formato = formatoPor(brief.formato, brief.formatoVersion);

    const proyectoId = await proyectos.crear(
      {
        empresaId: conversion.empresaId,
        ejecutivoId: usuario.id,
        servicio: servicio.slug,
        tipo: servicio.tipo,
        nombre: `${formato?.nombre ?? "Brief"} ${brief.codigo}`,
        descripcion: `Nace del brief ${brief.codigo}.`,
        fechaInicio: null,
        fechaEstimadaCierre: brief.fechaPropuesta ?? brief.fechaAspirada,
      },
      usuario.id,
      tx,
    );
    await briefs.ligarProyecto(proyectoId, id, tx);

    const piezaId = await piezas.crear(proyectoId, servicio.piezaUnica!, usuario.id, tx);
    for (const tarea of servicio.tareasSugeridas(servicio.piezaUnica!.tipo)) {
      await tareas.crear(piezaId, tarea, usuario.id, tx);
    }

    if (!(await briefs.aceptar(id, proyectoId, usuario.id, tx))) {
      throw new Error("El brief cambio mientras se aceptaba");
    }

    await anotar(tx, usuario, "brief.aceptado", {
      entidadId: id,
      empresaId: conversion.empresaId,
      despues: { proyecto: proyectoId, prospectoConvertido: brief.prospectoId !== null && brief.empresaId === null },
    });

    const actualizado = { ...brief, empresaId: conversion.empresaId };
    await avisarALaEmpresa(tx, actualizado, {
      tipo: "brief.aceptado",
      titulo: `Aceptamos tu brief ${brief.codigo}`,
      cuerpo: "Ya es un proyecto. Ahora lo validamos contigo.",
    });

    return { proyectoId, credencial: conversion.credencial, correos: conversion.correo ? [conversion.correo] : [] };
  });

  if ("error" in resultado) return { ok: false, mensaje: resultado.error };

  await entregarCorreos(usuario, resultado.correos);
  revalidar(id);
  revalidatePath(rutaProyecto(resultado.proyectoId));

  return {
    ok: true,
    mensaje: resultado.credencial
      ? "Proyecto abierto y cuenta creada para el prospecto. Entregale su contrasena provisional"
      : "Proyecto abierto. Completar su fase 1 valida el brief",
    credencial: resultado.credencial ?? undefined,
    destino: rutaProyecto(resultado.proyectoId),
  };
}

/**
 * Pasarlo a presupuesto: entra en la cola de administracion, que arma el
 * presupuesto. Si es de un prospecto, nace antes su empresa: un presupuesto
 * siempre es de una empresa (S-05).
 */
export async function presupuestarBrief(_estadoPrevio: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const usuario = await requerirCargo("cuentas");

  const id = comoIdentificador(datos.get("id"));
  if (id === null) return NO_ENCONTRADO;

  const resultado = await conSesion(usuario, async (tx) => {
    const brief = await briefs.buscarPorId(id, tx);
    if (!brief || brief.codigo === null) return { error: "No se encontro el brief" };

    // Desde «enviado», o de nuevo si el presupuesto anterior se rechazo o vencio (S-09).
    const denuevo =
      brief.estado === "en_presupuesto" &&
      (brief.presupuestoEstado === "rechazado" || brief.presupuestoVencido);
    if (brief.estado !== "enviado" && !denuevo) return { error: "Este brief ya no esta para presupuestarse" };

    // Pasar a presupuesto ya lo hace cliente: nacen su empresa y su cuenta.
    const conversion = await convertirSiEsProspecto(tx, brief, usuario);
    if (!(await briefs.aPresupuesto(id, usuario.id, tx))) throw new Error("El brief cambio mientras se presupuestaba");

    await anotar(tx, usuario, "brief.a_presupuesto", { entidadId: id, empresaId: conversion.empresaId });

    await notificarA(tx, await usuarios.operadoresDeFinanzas(tx), {
      tipo: "brief.a_presupuesto",
      titulo: `Hay que presupuestar el brief ${brief.codigo}`,
      cuerpo: `De ${brief.solicitante}.`,
      href: RUTA_PRESUPUESTOS,
      empresaId: conversion.empresaId,
    });

    await avisarALaEmpresa(tx, { ...brief, empresaId: conversion.empresaId }, {
      tipo: "brief.a_presupuesto",
      titulo: `Preparamos el presupuesto de tu brief ${brief.codigo}`,
      cuerpo: "Te avisamos cuando este listo para que lo revises.",
    });

    return { credencial: conversion.credencial, correos: conversion.correo ? [conversion.correo] : [] };
  });

  if ("error" in resultado) return { ok: false, mensaje: resultado.error };

  await entregarCorreos(usuario, resultado.correos);
  revalidar(id);
  revalidatePath(RUTA_PRESUPUESTOS);
  return {
    ok: true,
    mensaje: resultado.credencial
      ? "Pasado a administracion y cuenta creada para el prospecto. Entregale su contrasena provisional"
      : "Pasado a administracion para su presupuesto",
    credencial: resultado.credencial ?? undefined,
  };
}

/** Descartar con motivo. No se borra: queda archivado, y el cliente ve por que. */
export async function descartarBrief(_estadoPrevio: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const usuario = await requerirCargo("cuentas");

  const id = comoIdentificador(datos.get("id"));
  const motivo = limpiarTexto(datos.get("motivo"), 1000);
  if (id === null) return NO_ENCONTRADO;
  if (!motivo) return { ok: false, errores: { motivo: "Escribe el motivo: el cliente lo vera" } };

  const resultado = await conSesion(usuario, async (tx) => {
    const brief = await briefs.buscarPorId(id, tx);
    if (!brief) return { error: "No se encontro el brief" };
    if (!(await briefs.descartar(id, motivo, usuario.id, tx))) return { error: "Este brief ya no se puede descartar" };

    await anotar(tx, usuario, "brief.descartado", { entidadId: id, empresaId: brief.empresaId, despues: { motivo } });
    await avisarALaEmpresa(tx, brief, {
      tipo: "brief.descartado",
      titulo: `No seguiremos con el brief ${brief.codigo}`,
      cuerpo: motivo,
    });

    return { ok: true as const };
  });

  if ("error" in resultado) return { ok: false, mensaje: resultado.error };

  revalidar(id);
  return { ok: true, mensaje: "Brief descartado" };
}

/**
 * La fecha de entrega: viable la que aspira el cliente, o se propone otra con
 * su motivo. El cliente ve las dos.
 */
export async function decidirFechaBrief(_estadoPrevio: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const usuario = await requerirCargo("cuentas");

  const id = comoIdentificador(datos.get("id"));
  if (id === null) return NO_ENCONTRADO;

  const viable = datos.get("viable") === "si";
  const fecha = viable ? null : leerFecha(datos.get("fechaPropuesta"));
  const motivo = viable ? null : limpiarTexto(datos.get("motivoFecha"), 500) || null;

  if (!viable) {
    const errores: Record<string, string> = {};
    if (!fecha) errores.fechaPropuesta = "Indica la fecha que propones";
    if (!motivo) errores.motivoFecha = "Explica por que: el cliente lo vera";
    if (Object.keys(errores).length > 0) return { ok: false, errores };
  }

  const resultado = await conSesion(usuario, async (tx) => {
    const brief = await briefs.buscarPorId(id, tx);
    if (!brief) return { error: "No se encontro el brief" };
    if (!(await briefs.proponerFecha(id, fecha, motivo, tx))) return { error: "Este brief ya no admite cambios de fecha" };

    await anotar(tx, usuario, "brief.fecha_propuesta", {
      entidadId: id,
      empresaId: brief.empresaId,
      antes: { fechaPropuesta: brief.fechaPropuesta },
      despues: { fechaPropuesta: fecha, motivo },
    });

    if (fecha) {
      await avisarALaEmpresa(tx, brief, {
        tipo: "brief.fecha_propuesta",
        titulo: `Te proponemos otra fecha para el brief ${brief.codigo}`,
        cuerpo: motivo,
      });
    }

    return { ok: true as const };
  });

  if ("error" in resultado) return { ok: false, mensaje: resultado.error };

  revalidar(id);
  return { ok: true, mensaje: viable ? "La fecha que aspira el cliente es viable" : "Fecha propuesta al cliente" };
}

/**
 * Escribe en el hilo como equipo. Si el brief es de un prospecto, su enlace se
 * renueva 7 dias para que pueda responder (S-06).
 */
export async function aclararBrief(_estadoPrevio: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const usuario = await requerirCargo("cuentas", "administracion");

  const id = comoIdentificador(datos.get("id"));
  const texto = limpiarTexto(datos.get("texto"), 2000);
  if (id === null) return NO_ENCONTRADO;
  if (!texto) return { ok: false, errores: { texto: "Escribe tu mensaje" } };

  try {
    const resultado = await conSesion(usuario, async (tx) => {
      const brief = await briefs.buscarPorId(id, tx);
      if (!brief || brief.estado === "borrador") return { error: "Este brief todavia no se ha enviado" };

      const nombre = `${usuario.nombre} ${usuario.apellido}`.trim();
      await briefs.aclarar(id, { autorId: usuario.id, autorNombre: nombre, delEquipo: true, texto }, tx);
      await anotar(tx, usuario, "brief.aclaracion", { entidadId: id, empresaId: brief.empresaId });

      const enlace = await briefs.enlaceDe(id, tx);
      if (enlace !== null && brief.empresaId === null) await enlaces.renovar(enlace, 7, tx);

      await avisarALaEmpresa(tx, brief, {
        tipo: "brief.aclaracion",
        titulo: `El equipo te escribio sobre el brief ${brief.codigo}`,
        cuerpo: texto.slice(0, 140),
      });

      return { ok: true as const };
    });

    if ("error" in resultado) return { ok: false, mensaje: resultado.error };
  } catch (error) {
    if (esErrorPostgres(error, "42501")) return { ok: false, mensaje: "No atiendes este brief" };
    throw error;
  }

  revalidar(id);
  return { ok: true, mensaje: "Mensaje enviado" };
}

/** Dias que vale un enlace nuevo; cada mensaje del ejecutivo lo renueva (S-06). */
const DIAS_DEL_ENLACE = 7;

/**
 * Genera el enlace privado de un prospecto para un formato (S-05).
 *
 * La ruta se devuelve UNA vez, para copiarla y hacersela llegar: la base solo
 * guarda el hash del token, y no sale por correo porque ningun correo lleva
 * tokens.
 */
export async function crearEnlace(_estadoPrevio: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const usuario = await requerirCargo("cuentas");

  const empresaNombre = limpiarTexto(datos.get("empresaNombre"), 150);
  const contactoNombre = limpiarTexto(datos.get("contactoNombre"), 150);
  const email = limpiarTexto(datos.get("email"), 254).toLowerCase();
  const telefono = limpiarOpcional(datos.get("telefono"), 40);
  const formato = formatosVigentes().find((f) => f.clave === datos.get("formato"));

  const errores: Record<string, string> = {};
  if (!empresaNombre) errores.empresaNombre = "Indica la empresa";
  if (!contactoNombre) errores.contactoNombre = "Indica la persona de contacto";
  if (!esEmail(email)) errores.email = "Indica un correo valido";
  if (!formato) errores.formato = "Elige el tipo de brief";
  if (Object.keys(errores).length > 0 || !formato) {
    return { ok: false, errores, mensaje: "Revisa los datos del prospecto" };
  }

  const token = generarToken();

  await conSesion(usuario, async (tx) => {
    const prospectoId = await enlaces.crearProspecto({ empresaNombre, contactoNombre, email, telefono }, usuario.id, tx);
    const id = await enlaces.crear(
      {
        tokenHash: hashDeToken(token),
        prospectoId,
        formato: formato.clave,
        formatoVersion: formato.version,
        dias: DIAS_DEL_ENLACE,
      },
      usuario.id,
      tx,
    );

    // El correo del prospecto no se anota: basta con su ficha.
    await anotar(tx, usuario, "enlace_brief.creado", {
      entidadId: id,
      despues: { prospecto: prospectoId, empresa: empresaNombre, formato: formato.clave, dias: DIAS_DEL_ENLACE },
    });
  });

  revalidatePath(RUTA_BRIEFS);
  return {
    ok: true,
    mensaje: `Enlace creado para ${empresaNombre}. Copialo ahora: no se vuelve a mostrar`,
    enlace: rutaDelEnlace(token),
  };
}

/** Deja sin efecto un enlace: quien lo abra vera que ya no es valido. */
export async function revocarEnlace(_estadoPrevio: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const usuario = await requerirCargo("cuentas");

  const id = comoIdentificador(datos.get("id"));
  if (id === null) return { ok: false, mensaje: "No se encontro el enlace" };

  const revocado = await conSesion(usuario, async (tx) => {
    const enlace = await enlaces.buscarPorId(id, tx);
    if (!enlace || !(await enlaces.revocar(id, tx))) return false;

    await anotar(tx, usuario, "enlace_brief.revocado", {
      entidadId: id,
      antes: { empresa: enlace.empresaNombre },
    });
    return true;
  });

  if (!revocado) return { ok: false, mensaje: "Ese enlace ya estaba revocado" };

  revalidatePath(RUTA_BRIEFS);
  return { ok: true, mensaje: "Enlace revocado" };
}
