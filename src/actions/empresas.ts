"use server";

import { revalidatePath } from "next/cache";

import { CODIGO_ERROR, esErrorPostgres } from "@/lib/db";
import { requerirCargo } from "@/lib/sesion";
import { validarEmpresa } from "@/lib/validaciones";
import * as empresas from "@/models/empresas";
import type { EstadoFormulario } from "@/types";

/**
 * Alta de empresas cliente.
 *
 * POR QUE ESTO EXISTE
 * -------------------
 * `empresas.crear` llevaba escrito desde el principio en el modelo y no lo
 * llamaba nadie: la unica forma de que existiera una empresa era el seed. Eso
 * dejaba dos callejones sin salida en la interfaz:
 *
 * - El alta de usuarios avisa de que "hay que registrar la empresa antes de
 *   dar de alta a su persona de contacto" y deshabilita el boton. No existia
 *   el sitio donde registrarla.
 * - La ficha de un hook pide un cliente obligatorio. Sin empresas, el
 *   desplegable salia vacio y no habia forma de guardar nada.
 *
 * QUIEN PUEDE
 * -----------
 * Cargo `redes` o administrador. No es solo comodidad: quien escribe hooks es
 * quien se encuentra con que falta el cliente, y mandarla a pedirselo a un
 * administrador para poder seguir es justo la friccion que bloquea el trabajo.
 * Una empresa no da acceso a nada por si misma; lo que si da permisos es
 * vincularle un usuario, y eso sigue siendo cosa del administrador.
 */

const RUTAS_A_REVALIDAR = ["/dashboard/hooks", "/dashboard/usuarios"] as const;

export async function crearEmpresa(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  await requerirCargo("redes");

  const { valores, errores, valido } = validarEmpresa(datos);

  if (!valido) {
    return { ok: false, errores };
  }

  try {
    await empresas.crear(valores);
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
      return { ok: false, errores: { rif: "Ya hay una empresa con ese RIF" } };
    }

    throw error;
  }

  // Las dos rutas donde se elige una empresa desde un desplegable.
  for (const ruta of RUTAS_A_REVALIDAR) {
    revalidatePath(ruta, "layout");
  }

  return {
    ok: true,
    mensaje: `Empresa "${valores.nombre}" registrada. Ya se puede elegir como cliente.`,
  };
}
