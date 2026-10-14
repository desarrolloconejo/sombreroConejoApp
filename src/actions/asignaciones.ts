"use server";

import { revalidatePath } from "next/cache";

import { anotar } from "@/lib/auditoria";
import { conSesion } from "@/lib/db";
import { notificarA } from "@/lib/notificaciones";
import { requerirAdmin } from "@/lib/sesion";
import { comoIdentificador } from "@/lib/validaciones";
import * as asignaciones from "@/models/asignaciones";
import * as empresas from "@/models/empresas";
import type { EstadoFormulario } from "@/types";

/**
 * Que ejecutivo atiende a que empresa. Solo lo decide un administrador.
 *
 * Asignar o quitar NO revoca sesiones: la base consulta la asignacion en cada
 * peticion (`portal.gestiona_empresa`), y no hay nada guardado en el token que
 * quede viejo. El cambio vale desde el siguiente clic.
 */

const RUTA = "/dashboard/empresas";

export async function asignarEjecutivo(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const admin = await requerirAdmin();

  const empresaId = comoIdentificador(datos.get("empresaId"));
  const usuarioId = comoIdentificador(datos.get("usuarioId"));

  if (empresaId === null) {
    return { ok: false, mensaje: "No se pudo identificar la empresa" };
  }

  if (usuarioId === null) {
    return { ok: false, errores: { usuarioId: "Elige a quien asignar" } };
  }

  const empresa = await empresas.buscarPorId(empresaId);

  if (!empresa) return { ok: false, mensaje: "Esa empresa ya no existe" };

  if (!empresa.activo) {
    return { ok: false, mensaje: "La empresa esta desactivada: reactivala antes" };
  }

  const resultado = await conSesion(admin, async (tx) => {
    // Solo un ejecutivo activo de cuentas. La lista sale de la base, no del
    // formulario: un id escrito a mano no cuela a nadie de otro cargo.
    const ejecutivo = (await asignaciones.candidatos(tx)).find(
      (candidato) => candidato.id === usuarioId,
    );

    if (!ejecutivo) return "no_es_ejecutivo" as const;

    const id = await asignaciones.crear(usuarioId, empresaId, admin.id, tx);

    if (id === null) return "ya_estaba" as const;

    await anotar(tx, admin, "empresa.ejecutivo_asignado", {
      entidad: "empresa",
      entidadId: empresaId,
      empresaId,
      despues: { ejecutivo: ejecutivo.nombre },
    });

    await notificarA(tx, [usuarioId], {
      tipo: "empresa.asignada",
      titulo: `Te asignaron ${empresa.nombre}`,
      cuerpo: "Desde ahora ves sus proyectos y puedes abrirle nuevos.",
      href: `/dashboard/proyectos?empresa=${empresaId}`,
      empresaId,
    });

    return ejecutivo.nombre;
  });

  if (resultado === "no_es_ejecutivo") {
    return {
      ok: false,
      errores: { usuarioId: "Solo se asignan personas activas del cargo Cuentas" },
    };
  }

  if (resultado === "ya_estaba") {
    return { ok: false, mensaje: "Esa persona ya atiende a esta empresa" };
  }

  revalidatePath(RUTA);

  return { ok: true, mensaje: `${resultado} atiende ahora a ${empresa.nombre}` };
}

export async function quitarEjecutivo(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const admin = await requerirAdmin();

  const id = comoIdentificador(datos.get("id"));

  if (id === null) {
    return { ok: false, mensaje: "No se pudo identificar la asignacion" };
  }

  const quitada = await conSesion(admin, async (tx) => {
    const fila = await asignaciones.quitar(id, tx);

    if (!fila) return null;

    await anotar(tx, admin, "empresa.ejecutivo_quitado", {
      entidad: "empresa",
      entidadId: fila.empresaId,
      empresaId: fila.empresaId,
      antes: { ejecutivo: fila.usuarioNombre },
    });

    return fila;
  });

  if (quitada === null) {
    return { ok: false, mensaje: "Esa asignacion ya no existe" };
  }

  revalidatePath(RUTA);

  return {
    ok: true,
    mensaje: `${quitada.usuarioNombre} deja de atender a ${quitada.empresaNombre}`,
  };
}
