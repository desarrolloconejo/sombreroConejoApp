"use client";

import { createContext, useActionState, useContext, useState, type ReactNode } from "react";
import { Check, X } from "lucide-react";

import { resolverPresupuesto } from "@/actions/facturacion";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { Boton, CLASE_CONTROL } from "@/components/ui";
import { ESTADO_INICIAL, type EstadoFormulario } from "@/types";

/**
 * La decision del cliente sobre un presupuesto: aprobarlo o rechazarlo.
 *
 * Al decidir, el formulario desaparece: el presupuesto ya no espera nada.
 * Por eso el estado de la action vive en `ProveedorDecision`, que envuelve
 * toda la ficha, y el aviso de confirmacion no se pierde con el formulario.
 */

type Accion = [EstadoFormulario, (datos: FormData) => void, boolean];

const ContextoDecision = createContext<Accion | null>(null);

export function ProveedorDecision({ children }: { children: ReactNode }) {
  const accion = useActionState(resolverPresupuesto, ESTADO_INICIAL);
  useAvisoDeAccion(accion[0]);

  return <ContextoDecision.Provider value={accion}>{children}</ContextoDecision.Provider>;
}

export function DecisionPresupuesto({ presupuestoId }: { presupuestoId: number }) {
  const accion = useContext(ContextoDecision);
  if (!accion) throw new Error("DecisionPresupuesto va dentro de ProveedorDecision");

  const [estado, enviar, enviando] = accion;
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");

  if (!rechazando) {
    return (
      <form action={enviar} className="flex flex-col gap-2.5">
        <input type="hidden" name="id" value={presupuestoId} />
        <input type="hidden" name="decision" value="aprobar" />
        <Boton type="submit" disabled={enviando} className="w-full">
          <Check aria-hidden="true" />
          {enviando ? "Aprobando..." : "Aprobar el presupuesto"}
        </Boton>
        <Boton
          type="button"
          variante="fantasma"
          disabled={enviando}
          onClick={() => setRechazando(true)}
          className="w-full"
        >
          <X aria-hidden="true" />
          Rechazar
        </Boton>
      </form>
    );
  }

  return (
    <form action={enviar} noValidate className="flex flex-col gap-3">
      <input type="hidden" name="id" value={presupuestoId} />
      <input type="hidden" name="decision" value="rechazar" />

      <label>
        <span className="mb-2 block text-xs font-semibold">¿Por que lo rechazas?</span>
        <textarea
          name="motivo"
          value={motivo}
          onChange={(evento) => setMotivo(evento.target.value)}
          rows={4}
          maxLength={500}
          placeholder="Lo que cambiarias, o lo que no encaja"
          aria-invalid={estado.errores?.motivo ? true : undefined}
          className={`${CLASE_CONTROL} min-h-[104px]`}
        />
        {estado.errores?.motivo && (
          <span role="alert" className="mt-1.5 block text-[12px] font-medium text-blackberry dark-tema:text-acento">
            {estado.errores.motivo}
          </span>
        )}
      </label>

      <div className="flex flex-wrap justify-end gap-2.5">
        <Boton type="button" variante="fantasma" tamano="chico" onClick={() => setRechazando(false)}>
          Volver
        </Boton>
        <Boton type="submit" variante="peligro" tamano="chico" disabled={enviando}>
          <X aria-hidden="true" />
          {enviando ? "Enviando..." : "Rechazar el presupuesto"}
        </Boton>
      </div>
    </form>
  );
}
