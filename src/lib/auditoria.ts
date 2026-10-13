import { headers } from "next/headers";

import type { Ejecutor } from "./db";
import * as auditoria from "@/models/auditoria";
import type {
  AccionAuditoria,
  UsuarioCompleto,
  ValoresAuditoria,
} from "@/types";

/**
 * Lo que las actions usan para dejar constancia de lo que hacen.
 *
 * La regla es una sola: la linea va en la MISMA transaccion que el cambio.
 * Por eso `anotar` exige el ejecutor de esa transaccion y no ofrece otro.
 */

/**
 * Desde donde llega la peticion.
 *
 * Detras de Vercel la conexion directa es la de su red, y la direccion real
 * viaja en `x-forwarded-for`: una lista en la que el primero es el navegador.
 * Sirve como dato de contexto, no como prueba: la cabecera la puede escribir
 * cualquiera que llegue sin pasar por la plataforma.
 */
export async function ipDeLaPeticion(): Promise<string | null> {
  const cabeceras = await headers();
  const reenviada = cabeceras.get("x-forwarded-for")?.split(",")[0]?.trim();

  return (reenviada || cabeceras.get("x-real-ip") || null)?.slice(0, 64) ?? null;
}

/** Quien actua, con el rol y el cargo que tiene AHORA, que es lo que se copia. */
export type ActorAuditoria = Pick<UsuarioCompleto, "id" | "rol" | "cargoSlug">;

/** Sobre que se actua. */
type Objeto = {
  entidad?: string;
  entidadId?: number;
  empresaId?: number | null;
  antes?: ValoresAuditoria | null;
  despues?: ValoresAuditoria | null;
};

/**
 * Anota una accion dentro de la transaccion en curso.
 *
 * `actor` es nulo solo cuando no hay nadie identificado, que hoy es un unico
 * caso: un intento de entrar con un correo que no existe.
 */
export async function anotar(
  ejecutor: Ejecutor,
  actor: ActorAuditoria | null,
  accion: AccionAuditoria,
  objeto: Objeto = {},
): Promise<void> {
  await auditoria.registrar(
    {
      actorId: actor?.id ?? null,
      actorRol: actor?.rol ?? null,
      actorCargo: actor?.cargoSlug ?? null,
      accion,
      entidad: objeto.entidad ?? accion.split(".")[0],
      entidadId: objeto.entidadId ?? null,
      empresaId: objeto.empresaId ?? null,
      antes: objeto.antes ?? null,
      despues: objeto.despues ?? null,
      ip: await ipDeLaPeticion(),
    },
    ejecutor,
  );
}

/**
 * Deja de dos objetos solo los campos que cambiaron.
 *
 * Una linea de «usuario editado» con veinte campos iguales y uno distinto
 * obliga a buscar la diferencia a ojo. Asi el antes y el despues traen solo
 * lo que de verdad cambio, y si no cambio nada devuelve null para no anotar
 * una edicion que no lo fue.
 */
export function soloCambios<T extends ValoresAuditoria>(
  antes: T,
  despues: T,
): { antes: ValoresAuditoria; despues: ValoresAuditoria } | null {
  const viejo: ValoresAuditoria = {};
  const nuevo: ValoresAuditoria = {};

  for (const campo of Object.keys(despues)) {
    if (antes[campo] !== despues[campo]) {
      viejo[campo] = antes[campo] ?? null;
      nuevo[campo] = despues[campo] ?? null;
    }
  }

  return Object.keys(nuevo).length > 0 ? { antes: viejo, despues: nuevo } : null;
}
