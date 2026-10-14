"use client";

import { createContext, useActionState, useContext, type ReactNode } from "react";

import { guardarPresupuesto, resolverPresupuestoANombre } from "@/actions/presupuestos";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { ESTADO_INICIAL, type EstadoFormulario } from "@/types";

/**
 * El estado de las actions que cambian en que punto esta un presupuesto, por
 * encima de los formularios que las lanzan.
 *
 * Al enviar, el presupuesto deja de ser borrador y la page cambia el editor
 * por el documento; al registrar la respuesta del cliente, desaparece su
 * formulario. Si el `useActionState` viviera en esos componentes, el aviso se
 * perderia con ellos. Vive aqui, que envuelve toda la ficha y sigue en
 * pantalla.
 */

type Accion = [EstadoFormulario, (datos: FormData) => void, boolean];

const ContextoAcciones = createContext<{ guardar: Accion; resolver: Accion } | null>(null);

export function ProveedorGuardado({ children }: { children: ReactNode }) {
  const guardar = useActionState(guardarPresupuesto, ESTADO_INICIAL);
  const resolver = useActionState(resolverPresupuestoANombre, ESTADO_INICIAL);

  useAvisoDeAccion(guardar[0]);
  useAvisoDeAccion(resolver[0]);

  return <ContextoAcciones.Provider value={{ guardar, resolver }}>{children}</ContextoAcciones.Provider>;
}

function useAcciones() {
  const acciones = useContext(ContextoAcciones);
  if (!acciones) throw new Error("Va dentro de ProveedorGuardado");
  return acciones;
}

/** Guardar el borrador, o guardarlo y enviarlo. */
export function useGuardado(): Accion {
  return useAcciones().guardar;
}

/** Registrar la respuesta del cliente a su nombre. */
export function useResolucion(): Accion {
  return useAcciones().resolver;
}
