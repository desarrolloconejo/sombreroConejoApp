"use server";

import { revalidatePath } from "next/cache";

import { anotar } from "@/lib/auditoria";
import { conSesion } from "@/lib/db";
import { subirArchivo } from "@/lib/externos/archivos";
import { piezaGestionada } from "@/lib/portal/acceso";
import {
  enlacePermitido,
  nombreEstandar,
  TAMANO_MAXIMO,
  tipoPorFirma,
} from "@/lib/portal/archivos";
import { hoyEnCaracas } from "@/lib/portal/fases";
import { rutaPieza } from "@/lib/portal/rutas";
import { requerirCargo, requerirRol } from "@/lib/sesion";
import { comoIdentificador, LIMITES, limpiarTexto } from "@/lib/validaciones";
import * as piezas from "@/models/piezas";
import * as proyectos from "@/models/proyectos";
import * as versiones from "@/models/versiones";
import type { EstadoFormulario, NumeroFase } from "@/types";

/**
 * Las versiones de una pieza: lo que el equipo produce y lo que el cliente
 * acaba revisando.
 *
 * Sube quien trabaja en la pieza o la gestiona; la base lo vuelve a comprobar
 * al escribir la fila. Marcar la que vera el cliente es del ejecutivo, en la
 * fase 4.
 */

const NO_ALCANCE: EstadoFormulario = { ok: false, mensaje: "Esa pieza ya no esta a tu alcance" };

export async function subirVersion(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirRol("admin", "trabajador");

  const piezaId = comoIdentificador(datos.get("piezaId"));
  if (piezaId === null) return NO_ALCANCE;

  const origen = datos.get("origen") === "enlace" ? "enlace" : "archivo";
  const archivo = datos.get("archivo");
  const enlace = enlacePermitido(limpiarTexto(datos.get("enlace"), LIMITES.url));

  // Primero lo que no necesita la base: que lo que llega sirva.
  let bytes: Uint8Array | null = null;
  let tipo: ReturnType<typeof tipoPorFirma> = null;

  if (origen === "archivo") {
    if (!(archivo instanceof File) || archivo.size === 0) {
      return { ok: false, errores: { archivo: "Elige el archivo" } };
    }
    if (archivo.size > TAMANO_MAXIMO) {
      return {
        ok: false,
        errores: { archivo: "Como mucho 4 MB. Un video va mejor como enlace (Frame.io, Drive...)" },
      };
    }

    bytes = new Uint8Array(await archivo.arrayBuffer());
    tipo = tipoPorFirma(bytes);

    if (!tipo) {
      return { ok: false, errores: { archivo: "Solo imagenes (PNG, JPG, GIF, WEBP) o PDF" } };
    }
  } else if (!enlace) {
    return {
      ok: false,
      errores: { enlace: "Tiene que ser un enlace https de Figma, Frame.io, Dropbox, Drive, Canva, Vimeo o YouTube" },
    };
  }

  // Donde va: la pieza tiene que estar al alcance de quien sube, y activa.
  const contexto = await conSesion(usuario, async (tx) => {
    const pieza = await piezas.buscarPorId(piezaId, tx);
    if (!pieza || pieza.estado !== "activa") return null;
    if (!(await piezas.puedeTrabajar(piezaId, tx))) return null;

    const proyecto = await proyectos.buscarPorId(pieza.proyectoId, tx);
    if (!proyecto) return null;

    return {
      pieza,
      proyecto,
      numero: (await versiones.contar(piezaId, tx)) + 1,
      orden: await piezas.ordenDeTipo(piezaId, tx),
    };
  });

  if (!contexto) return NO_ALCANCE;

  const { pieza, proyecto, numero, orden } = contexto;
  const fase = (pieza.avance.faseActual ?? 5) as NumeroFase;

  const nombre =
    origen === "archivo" && tipo
      ? nombreEstandar({
          cliente: proyecto.empresaSigla,
          proyecto: proyecto.nombreCorto,
          tipo: pieza.tipo,
          orden,
          fecha: hoyEnCaracas(),
          version: numero,
          extension: tipo.extension,
        })
      : limpiarTexto(datos.get("nombre"), LIMITES.pieza) || `Version ${numero} de ${pieza.titulo}`;

  // El archivo se sube ANTES de la fila y fuera de la transaccion: un servicio
  // externo no se llama con una transaccion abierta.
  let archivoId: string | null = null;

  if (bytes && tipo) {
    try {
      archivoId = await subirArchivo({ nombre, mime: tipo.mime, bytes });
    } catch (error) {
      console.error("[versiones] no se pudo guardar el archivo:", error);
      return { ok: false, mensaje: "No se pudo guardar el archivo. Intentalo de nuevo" };
    }
  }

  await conSesion(usuario, async (tx) => {
    const id = await versiones.crear(
      {
        piezaId,
        ronda: pieza.ronda,
        fase,
        origen,
        archivoId,
        enlace: origen === "enlace" ? enlace : null,
        nombre,
        mime: tipo?.mime ?? null,
        tamano: bytes?.byteLength ?? null,
      },
      usuario.id,
      tx,
    );

    await anotar(tx, usuario, "version.subida", {
      entidad: "pieza",
      entidadId: piezaId,
      empresaId: proyecto.empresaId,
      despues: { versionId: id, numero, origen, nombre },
    });
  });

  revalidatePath(rutaPieza(proyecto.id, piezaId));

  return { ok: true, mensaje: `Version ${numero} guardada` };
}

export async function marcarVersionEnviada(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirCargo("cuentas");

  const piezaId = comoIdentificador(datos.get("piezaId"));
  const versionId = comoIdentificador(datos.get("versionId"));
  if (piezaId === null || versionId === null) return NO_ALCANCE;

  const resultado = await conSesion(usuario, async (tx) => {
    const contexto = await piezaGestionada(piezaId, tx);
    if (!contexto) return null;

    const { pieza, proyecto } = contexto;

    if (pieza.avance.faseActual !== 4) return "fase" as const;

    if (!(await versiones.marcarEnviada(versionId, piezaId, pieza.ronda, usuario.id, tx))) {
      return "version" as const;
    }

    await anotar(tx, usuario, "version.enviada", {
      entidad: "pieza",
      entidadId: piezaId,
      empresaId: proyecto.empresaId,
      despues: { versionId, ronda: pieza.ronda },
    });

    return proyecto.id;
  });

  if (resultado === null) return NO_ALCANCE;
  if (resultado === "fase") {
    return { ok: false, mensaje: "La version para el cliente se elige en la fase 4" };
  }
  if (resultado === "version") {
    return { ok: false, mensaje: "Esa version no es de esta ronda, o ya estaba marcada" };
  }

  revalidatePath(rutaPieza(resultado, piezaId));

  return { ok: true, mensaje: "Es la version que vera el cliente" };
}
