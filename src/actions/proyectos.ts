"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { anotar, soloCambios } from "@/lib/auditoria";
import { conSesion, type Ejecutor } from "@/lib/db";
import { notificarA } from "@/lib/notificaciones";
import { servicioPorSlug } from "@/lib/portal/catalogo";
import { RUTA_PROYECTOS, rutaProyecto } from "@/lib/portal/rutas";
import { requerirCargo } from "@/lib/sesion";
import {
  comoIdentificador,
  LIMITES,
  limpiarTexto,
  validarProyecto,
} from "@/lib/validaciones";
import * as piezas from "@/models/piezas";
import * as proyectos from "@/models/proyectos";
import * as tareas from "@/models/tareas";
import {
  NOMBRES_DE_TIPO_PIEZA,
  type DatosNuevaPieza,
  type EstadoFormulario,
  type EstadoProyecto,
  type TipoPieza,
  type UsuarioCompleto,
} from "@/types";

/**
 * Proyectos: crearlos, editarlos y cambiarles el estado.
 *
 * Los gestiona el admin o un ejecutivo de cuentas asignado a la empresa. La
 * guardia deja pasar a los dos, y la base decide sobre que empresa: un
 * ejecutivo que intente tocar una empresa ajena no vera el proyecto, y su
 * escritura la rechazan las politicas.
 */

/** Crea las piezas de un proyecto, con sus tareas sugeridas si se piden. */
async function crearPiezas(
  proyectoId: number,
  lista: DatosNuevaPieza[],
  sugeridas: boolean,
  servicio: NonNullable<ReturnType<typeof servicioPorSlug>>,
  autor: number,
  tx: Ejecutor,
): Promise<void> {
  for (const datos of lista) {
    const piezaId = await piezas.crear(proyectoId, datos, autor, tx);

    if (!sugeridas) continue;

    for (const tarea of servicio.tareasSugeridas(datos.tipo)) {
      await tareas.crear(piezaId, tarea, autor, tx);
    }
  }
}

/** Las piezas que llegan del formulario, en filas de tipo y titulo. */
function leerPiezas(
  datos: FormData,
  permitidos: readonly TipoPieza[],
): { piezas: DatosNuevaPieza[]; error: string | null } {
  const tipos = datos.getAll("piezaTipo");
  const titulos = datos.getAll("piezaTitulo");

  const lista: DatosNuevaPieza[] = [];

  for (const [indice, valor] of tipos.entries()) {
    const tipo = permitidos.find((permitido) => permitido === valor);

    if (!tipo) return { piezas: [], error: "Hay una pieza de un tipo que no se ofrece" };

    const titulo =
      limpiarTexto(titulos[indice], LIMITES.pieza) ||
      `${NOMBRES_DE_TIPO_PIEZA[tipo]} ${indice + 1}`;

    lista.push({ tipo, titulo });
  }

  if (lista.length === 0) return { piezas: [], error: "Anade al menos una pieza" };

  if (lista.length > LIMITES.piezasPorProyecto) {
    return {
      piezas: [],
      error: `Como mucho ${LIMITES.piezasPorProyecto} piezas por proyecto`,
    };
  }

  return { piezas: lista, error: null };
}

export async function crearProyecto(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirCargo("cuentas");

  const validacion = validarProyecto(datos);
  const empresaId = comoIdentificador(datos.get("empresaId"));
  const servicio = servicioPorSlug(String(datos.get("servicio") ?? ""));

  const errores = { ...validacion.errores };
  if (empresaId === null) errores.empresaId = "Elige la empresa";
  if (!servicio) errores.servicio = "Elige el servicio";

  const lista = servicio?.piezaUnica
    ? { piezas: [servicio.piezaUnica], error: null }
    : leerPiezas(datos, servicio?.tiposDePieza ?? []);

  if (servicio && lista.error) errores.piezas = lista.error;

  if (Object.keys(errores).length > 0 || !servicio || empresaId === null) {
    return { ok: false, errores };
  }

  const { nombre, descripcion, ejecutivoId, fechaInicio, fechaEstimadaCierre } =
    validacion.valores;

  const sugeridas = datos.get("sugeridas") === "on";

  const resultado = await conSesion(usuario, async (tx) => {
    const gestionables = await proyectos.empresasGestionables(tx);
    const empresa = gestionables.find((candidata) => candidata.id === empresaId);

    if (!empresa) return { error: "empresa" as const };

    const posibles = await proyectos.ejecutivosPosibles(empresaId, tx);
    const ejecutivo = posibles.find((persona) => persona.id === ejecutivoId);

    if (!ejecutivo) return { error: "ejecutivo" as const };

    const proyectoId = await proyectos.crear(
      {
        empresaId,
        ejecutivoId: ejecutivo.id,
        servicio: servicio.slug,
        tipo: servicio.tipo,
        nombre,
        descripcion,
        fechaInicio,
        fechaEstimadaCierre,
      },
      usuario.id,
      tx,
    );

    await crearPiezas(proyectoId, lista.piezas, sugeridas, servicio, usuario.id, tx);

    await anotar(tx, usuario, "proyecto.creado", {
      entidadId: proyectoId,
      empresaId,
      despues: {
        nombre,
        servicio: servicio.slug,
        ejecutivo: ejecutivo.nombre,
        piezas: lista.piezas.length,
        tareasSugeridas: sugeridas,
      },
    });

    if (ejecutivo.id !== usuario.id) {
      await notificarA(tx, [ejecutivo.id], {
        tipo: "proyecto.asignado",
        titulo: `Llevas el proyecto ${nombre}`,
        cuerpo: `De ${empresa.nombre}.`,
        href: rutaProyecto(proyectoId),
        empresaId,
      });
    }

    return { proyectoId };
  });

  if ("error" in resultado) {
    return resultado.error === "empresa"
      ? { ok: false, errores: { empresaId: "No puedes abrir proyectos en esa empresa" } }
      : {
          ok: false,
          errores: {
            ejecutivoId: "Tiene que ser un ejecutivo de cuentas asignado a la empresa",
          },
        };
  }

  revalidatePath(RUTA_PROYECTOS);
  redirect(rutaProyecto(resultado.proyectoId));
}

/** Lo que se anota de un proyecto cuando cambia. */
function paraAuditoria(datos: {
  nombre: string;
  descripcion: string | null;
  ejecutivoId: number;
  fechaInicio: string | null;
  fechaEstimadaCierre: string | null;
}) {
  return {
    nombre: datos.nombre,
    descripcion: datos.descripcion,
    ejecutivoId: datos.ejecutivoId,
    fechaInicio: datos.fechaInicio,
    fechaEstimadaCierre: datos.fechaEstimadaCierre,
  };
}

export async function editarProyecto(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirCargo("cuentas");

  const id = comoIdentificador(datos.get("id"));
  if (id === null) return { ok: false, mensaje: "No se pudo identificar el proyecto" };

  const validacion = validarProyecto(datos);
  if (!validacion.valido) return { ok: false, errores: validacion.errores };

  const cambios = { ...validacion.valores, ejecutivoId: validacion.valores.ejecutivoId as number };

  const resultado = await conSesion(usuario, async (tx) => {
    const proyecto = await proyectos.buscarPorId(id, tx);

    if (!proyecto || !(await proyectos.gestiona(id, tx))) return "no_existe" as const;

    // Quien lo lleva hoy puede seguir llevandolo aunque ya no se pudiera elegir
    // (un administrador de antes): editar otra cosa no obliga a cambiarlo.
    // Un ejecutivo NUEVO, en cambio, tiene que ser de cuentas y de la empresa.
    const posibles = await proyectos.ejecutivosPosibles(proyecto.empresaId, tx);
    const ejecutivo =
      cambios.ejecutivoId === proyecto.ejecutivoId
        ? { id: proyecto.ejecutivoId }
        : posibles.find((persona) => persona.id === cambios.ejecutivoId);

    if (!ejecutivo) return "ejecutivo" as const;

    const diferencia = soloCambios(paraAuditoria(proyecto), paraAuditoria(cambios));

    if (!diferencia) return "sin_cambios" as const;

    await proyectos.actualizar(id, cambios, tx);
    await anotar(tx, usuario, "proyecto.editado", {
      entidadId: id,
      empresaId: proyecto.empresaId,
      ...diferencia,
    });

    if (ejecutivo.id !== proyecto.ejecutivoId && ejecutivo.id !== usuario.id) {
      await notificarA(tx, [ejecutivo.id], {
        tipo: "proyecto.asignado",
        titulo: `Llevas el proyecto ${cambios.nombre}`,
        cuerpo: `De ${proyecto.empresaNombre}.`,
        href: rutaProyecto(id),
        empresaId: proyecto.empresaId,
      });
    }

    return "ok" as const;
  });

  if (resultado === "no_existe") return { ok: false, mensaje: "Ese proyecto ya no esta a tu alcance" };
  if (resultado === "ejecutivo") {
    return {
      ok: false,
      errores: {
        ejecutivoId: "Tiene que ser un ejecutivo de cuentas asignado a la empresa",
      },
    };
  }
  if (resultado === "sin_cambios") return { ok: true, mensaje: "No habia nada que cambiar" };

  revalidatePath(rutaProyecto(id));
  revalidatePath(RUTA_PROYECTOS);

  return { ok: true, mensaje: "Los cambios quedaron guardados" };
}

/** A que estados se puede pasar desde cada uno. */
const TRANSICIONES: Record<EstadoProyecto, readonly EstadoProyecto[]> = {
  activo: ["pausado", "cerrado", "cancelado"],
  pausado: ["activo", "cerrado", "cancelado"],
  cerrado: ["activo"],
  cancelado: ["activo"],
};

export async function cambiarEstadoProyecto(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario: UsuarioCompleto = await requerirCargo("cuentas");

  const id = comoIdentificador(datos.get("id"));
  const destino = String(datos.get("estado") ?? "") as EstadoProyecto;

  if (id === null) return { ok: false, mensaje: "No se pudo identificar el proyecto" };

  const resultado = await conSesion(usuario, async (tx) => {
    const proyecto = await proyectos.buscarPorId(id, tx);

    if (!proyecto || !(await proyectos.gestiona(id, tx))) return "no_existe" as const;

    if (!TRANSICIONES[proyecto.estado].includes(destino)) return "transicion" as const;

    // P8: un proyecto se cierra cuando todas sus piezas estan aprobadas.
    if (
      destino === "cerrado" &&
      proyecto.avance.piezasAprobadas < proyecto.avance.totalPiezas
    ) {
      return "sin_aprobar" as const;
    }

    await proyectos.cambiarEstado(id, destino, tx);
    await anotar(tx, usuario, "proyecto.estado_cambiado", {
      entidadId: id,
      empresaId: proyecto.empresaId,
      antes: { estado: proyecto.estado },
      despues: { estado: destino },
    });

    return "ok" as const;
  });

  if (resultado === "no_existe") return { ok: false, mensaje: "Ese proyecto ya no esta a tu alcance" };
  if (resultado === "transicion") return { ok: false, mensaje: "Ese cambio de estado no es posible" };
  if (resultado === "sin_aprobar") {
    return {
      ok: false,
      mensaje: "Solo se cierra con todas sus piezas aprobadas. Cancela las que no vayan a salir.",
    };
  }

  revalidatePath(rutaProyecto(id));
  revalidatePath(RUTA_PROYECTOS);

  return { ok: true, mensaje: "El estado del proyecto cambio" };
}
