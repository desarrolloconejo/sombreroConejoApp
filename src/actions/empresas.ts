"use server";

import { revalidatePath } from "next/cache";

import { anotar, soloCambios } from "@/lib/auditoria";
import { CODIGO_ERROR, esErrorPostgres, transaccion } from "@/lib/db";
import { requerirAdmin } from "@/lib/sesion";
import { comoIdentificador, validarEmpresa } from "@/lib/validaciones";
import * as empresas from "@/models/empresas";
import * as sesiones from "@/models/sesiones";
import type { Empresa, ErroresCampo, EstadoFormulario, ValoresAuditoria } from "@/types";

/** Lo que de una empresa se anota cuando cambia. */
function paraAuditoria(empresa: Empresa): ValoresAuditoria {
  return {
    nombre: empresa.nombre,
    sigla: empresa.sigla,
    rif: empresa.rif,
    sector: empresa.sector,
    telefono: empresa.telefono,
    direccion: empresa.direccion,
    sitioWeb: empresa.sitioWeb,
    instagram: empresa.instagram,
    tiktok: empresa.tiktok,
    facebook: empresa.facebook,
    youtube: empresa.youtube,
    linkedin: empresa.linkedin,
  };
}

/** El RIF y la sigla son unicos: el indice que choco dice cual de los dos se repite. */
function choqueDeUnicidad(error: unknown): ErroresCampo {
  const indice = (error as { constraint?: unknown }).constraint;

  return indice === "empresas_sigla_unica"
    ? { sigla: "Otra empresa ya usa esa sigla" }
    : { rif: "Ya hay otra empresa con ese RIF" };
}

/**
 * Gestion de las empresas cliente de la agencia.
 *
 * QUIEN PUEDE, Y POR QUE CAMBIO
 * -----------------------------
 * Solo ADMINISTRADORES. El alta nacio abierta al cargo `redes` porque no
 * existia ningun otro sitio donde registrar una empresa, y quien escribe hooks
 * era quien se topaba con que faltaba el cliente. Ahora que hay un modulo
 * propio, la cartera de clientes vuelve a donde le corresponde: es informacion
 * de la agencia, no material de trabajo de un cargo.
 *
 * Redes conserva lo que necesita —elegir entre las empresas que existen— y
 * cuando falta una, la pide. Es la misma regla que ya rige para las cuentas de
 * usuario.
 *
 * QUE NO SE PUEDE HACER AQUI
 * --------------------------
 * Borrar. `clientes` y `fichas_hook` referencian a `empresas` con ON DELETE
 * RESTRICT, asi que una empresa con personas o con piezas no se puede borrar
 * sin perder su historia. Se desactiva, igual que un usuario.
 */

/*
 * Las rutas que dependen de esta informacion.
 *
 * El propio modulo, y las dos donde se elige una empresa desde un desplegable:
 * el canvas de hooks y el alta de usuarios. Sin revalidar esas dos, una empresa
 * recien creada no aparece hasta que caduque la cache.
 */
const RUTAS_A_REVALIDAR = [
  "/dashboard/empresas",
  "/dashboard/hooks",
  "/dashboard/usuarios",
] as const;

function revalidar(): void {
  for (const ruta of RUTAS_A_REVALIDAR) revalidatePath(ruta, "layout");
}

export async function crearEmpresa(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const admin = await requerirAdmin();

  const { valores, errores, valido } = validarEmpresa(datos);

  if (!valido) return { ok: false, errores };

  try {
    await transaccion(async (tx) => {
      const creada = await empresas.crear(valores, tx);

      await anotar(tx, admin, "empresa.creada", {
        entidadId: creada.id,
        empresaId: creada.id,
        despues: { nombre: creada.nombre, rif: creada.rif },
      });
    });
  } catch (error) {
    /*
     * El RIF es UNIQUE en la base.
     *
     * Se deja que sea PostgreSQL quien lo diga en lugar de consultarlo antes:
     * entre la consulta y la insercion cabe otra alta con el mismo RIF, y esa
     * comprobacion previa daria una falsa sensacion de seguridad. La base no
     * tiene esa carrera.
     */
    if (esErrorPostgres(error, CODIGO_ERROR.VIOLACION_UNICIDAD)) {
      return { ok: false, errores: choqueDeUnicidad(error) };
    }

    throw error;
  }

  revalidar();

  return {
    ok: true,
    mensaje: `Empresa "${valores.nombre}" registrada. Ya se puede elegir como cliente.`,
  };
}

export async function editarEmpresa(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const admin = await requerirAdmin();

  const id = comoIdentificador(datos.get("id"));

  if (id === null) {
    return { ok: false, mensaje: "No se pudo identificar la empresa" };
  }

  const { valores, errores, valido } = validarEmpresa(datos);

  if (!valido) return { ok: false, errores };

  try {
    const actualizada = await transaccion(async (tx) => {
      const anterior = await empresas.buscarPorId(id, tx);
      const nueva = await empresas.actualizar(id, valores, tx);

      if (!anterior || !nueva) return null;

      const cambios = soloCambios(paraAuditoria(anterior), paraAuditoria(nueva));

      if (cambios) {
        await anotar(tx, admin, "empresa.editada", {
          entidadId: id,
          empresaId: id,
          ...cambios,
        });
      }

      return nueva;
    });

    if (!actualizada) return { ok: false, mensaje: "Esa empresa ya no existe" };
  } catch (error) {
    if (esErrorPostgres(error, CODIGO_ERROR.VIOLACION_UNICIDAD)) {
      return { ok: false, errores: choqueDeUnicidad(error) };
    }

    throw error;
  }

  revalidar();

  return { ok: true, mensaje: "Empresa actualizada." };
}

/**
 * Activa o desactiva una empresa.
 *
 * Desactivar NO borra ni oculta lo que ya existe: sus piezas siguen en el
 * historial y sus personas de contacto conservan la cuenta. Lo que hace es
 * sacarla de los desplegables, para que no se escriban piezas nuevas de una
 * cuenta que ya no se atiende.
 */
export async function cambiarEstadoEmpresa(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const admin = await requerirAdmin();

  const id = comoIdentificador(datos.get("id"));

  if (id === null) {
    return { ok: false, mensaje: "No se pudo identificar la empresa" };
  }

  const empresa = await empresas.buscarPorId(id);

  if (!empresa) return { ok: false, mensaje: "Esa empresa ya no existe" };

  const activar = !empresa.activo;

  const cambiada = await transaccion(async (tx) => {
    if (!(await empresas.cambiarEstado(id, activar, tx))) return false;

    // Sus personas de contacto entran en nombre de la empresa: si se deja de
    // atender, las sesiones que tengan abiertas se cierran.
    const cerradas = activar
      ? 0
      : await sesiones.revocarDeEmpresa(id, "empresa_desactivada", tx);

    await anotar(tx, admin, activar ? "empresa.activada" : "empresa.desactivada", {
      entidadId: id,
      empresaId: id,
      antes: { activo: !activar },
      despues: activar
        ? { activo: true }
        : { activo: false, sesionesCerradas: cerradas },
    });

    return true;
  });

  if (!cambiada) return { ok: false, mensaje: "No se pudo cambiar el estado" };

  revalidar();

  return {
    ok: true,
    mensaje: activar
      ? `"${empresa.nombre}" vuelve a estar activa y se puede elegir como cliente.`
      : `"${empresa.nombre}" queda desactivada. Sus piezas y sus contactos se conservan, pero deja de aparecer al escribir.`,
  };
}
