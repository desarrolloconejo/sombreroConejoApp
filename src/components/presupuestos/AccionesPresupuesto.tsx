"use client";

import { useActionState, useState } from "react";
import { Check, FileOutput, X } from "lucide-react";

import { generarProforma, presupuestarDesdeBrief } from "@/actions/presupuestos";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { Boton, CLASE_CONTROL } from "@/components/ui";
import { ESTADO_INICIAL } from "@/types";
import { useResolucion } from "./ProveedorGuardado";

/**
 * Registrar la decision del cliente a su nombre (F14).
 *
 * Para la empresa que no tiene a nadie con cuenta, o que respondio por otro
 * medio. Queda anotado que lo registro un operador: en la ficha y en la
 * auditoria.
 *
 * Su estado lo lleva `ProveedorGuardado`: al registrarla, este formulario
 * desaparece y el aviso no debe irse con el.
 */
export function DecisionANombre({ presupuestoId }: { presupuestoId: number }) {
  const [estado, enviar, enviando] = useResolucion();

  const [decision, setDecision] = useState<"aprobar" | "rechazar">("aprobar");
  const [motivo, setMotivo] = useState("");

  return (
    <form action={enviar} noValidate className="flex flex-col gap-3.5">
      <input type="hidden" name="id" value={presupuestoId} />

      <fieldset>
        <legend className="mb-2 text-xs font-semibold">Que respondio el cliente</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { valor: "aprobar", texto: "Lo aprobo" },
              { valor: "rechazar", texto: "Lo rechazo" },
            ] as const
          ).map((opcion) => (
            <label
              key={opcion.valor}
              className={[
                "suave flex cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[13px]",
                decision === opcion.valor
                  ? "border-acento bg-acento-tenue font-semibold"
                  : "border-borde hover:border-acento",
              ].join(" ")}
            >
              <input
                type="radio"
                name="decision"
                value={opcion.valor}
                checked={decision === opcion.valor}
                onChange={() => setDecision(opcion.valor)}
                className="accent-[var(--acento)]"
              />
              {opcion.texto}
            </label>
          ))}
        </div>
      </fieldset>

      {decision === "rechazar" && (
        <label>
          <span className="mb-2 block text-xs font-semibold">Por que lo rechazo</span>
          <textarea
            name="motivo"
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            rows={3}
            maxLength={500}
            aria-invalid={estado.errores?.motivo ? true : undefined}
            className={`${CLASE_CONTROL} min-h-[84px] py-2.5`}
          />
          {estado.errores?.motivo && (
            <span role="alert" className="mt-1.5 block text-[12px] font-medium text-blackberry dark-tema:text-acento">
              {estado.errores.motivo}
            </span>
          )}
        </label>
      )}

      <div className="flex justify-end">
        <Boton type="submit" variante={decision === "rechazar" ? "peligro" : "primario"} tamano="chico" disabled={enviando}>
          {decision === "rechazar" ? <X aria-hidden="true" /> : <Check aria-hidden="true" />}
          {enviando ? "Registrando..." : "Registrar a nombre del cliente"}
        </Boton>
      </div>
    </form>
  );
}

/** Arma el presupuesto de un brief y lleva a su editor. */
export function PresupuestarBrief({ briefId, codigo }: { briefId: number; codigo: string }) {
  const [estado, enviar, enviando] = useActionState(presupuestarDesdeBrief, ESTADO_INICIAL);
  useAvisoDeAccion(estado);

  return (
    <form action={enviar}>
      <input type="hidden" name="briefId" value={briefId} />
      <Boton type="submit" tamano="chico" disabled={enviando} aria-label={`Armar el presupuesto del brief ${codigo}`}>
        <FileOutput aria-hidden="true" />
        {enviando ? "Abriendo..." : "Armar el presupuesto"}
      </Boton>
    </form>
  );
}

/** Genera la proforma de un presupuesto aprobado. */
export function GenerarProforma({ presupuestoId }: { presupuestoId: number }) {
  const [estado, enviar, enviando] = useActionState(generarProforma, ESTADO_INICIAL);
  useAvisoDeAccion(estado);

  return (
    <form action={enviar}>
      <input type="hidden" name="id" value={presupuestoId} />
      <Boton type="submit" tamano="chico" disabled={enviando}>
        <FileOutput aria-hidden="true" />
        {enviando ? "Generando..." : "Generar la proforma"}
      </Boton>
    </form>
  );
}
