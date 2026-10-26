"use client";

import { useActionState, useState } from "react";
import { Ban, CalendarCheck, FileSpreadsheet, FolderPlus } from "lucide-react";

import { decidirFechaBrief } from "@/actions/briefs";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { Boton, BotonEnlace, CampoFecha, claseLinea, PIE_TARJETA } from "@/components/ui";
import { ESTADO_INICIAL, type DecisionBrief } from "@/types";

/**
 * Las decisiones de la bandeja sobre un brief.
 *
 * Los botones no deciden: abren la ventana de confirmacion por la URL
 * (`?decision=…`), que explica que va a pasar antes de hacerlo y muestra el
 * resultado despues (`ConfirmarDecisionBrief`).
 */

/** Los botones de decision ocupan el ancho que les toca, todos del mismo alto. */
const ANCHO = "w-full justify-center whitespace-nowrap";

/** Crece desde su contenido: reparten la fila sin partir el texto. */
const EN_FILA = "grow basis-auto";

/** Las tres decisiones: aceptar y abrir proyecto, presupuestar o descartar. */
export function BotonesDecision({
  hrefBase,
  aceptar: puedeAceptar,
  presupuestar: puedePresupuestar,
  descartar: puedeDescartar,
}: {
  /** La ruta del brief: cada boton le anade su `?decision=`. */
  hrefBase: string;
  aceptar: boolean;
  presupuestar: boolean;
  descartar: boolean;
}) {
  const href = (decision: DecisionBrief) => `${hrefBase}?decision=${decision}`;

  // Presupuesto y descarte comparten fila y la llenan entre los dos. Si no
  // caben sin partir el texto, bajan uno bajo el otro, cada uno a todo el ancho.

  return (
    <div className="flex flex-col gap-2.5">
      {puedeAceptar && (
        <BotonEnlace href={href("aceptar")} className={ANCHO}>
          <FolderPlus aria-hidden="true" />
          Aceptar y abrir proyecto
        </BotonEnlace>
      )}
      {(puedePresupuestar || puedeDescartar) && (
        <div className="flex flex-wrap gap-2.5">
          {puedePresupuestar && (
            <BotonEnlace href={href("presupuestar")} variante="fantasma" className={`justify-center whitespace-nowrap ${EN_FILA}`}>
              <FileSpreadsheet aria-hidden="true" />
              Convertir en presupuesto
            </BotonEnlace>
          )}
          {puedeDescartar && (
            <BotonEnlace href={href("descartar")} variante="fantasma" className={`justify-center whitespace-nowrap ${EN_FILA}`}>
              <Ban aria-hidden="true" />
              Descartar
            </BotonEnlace>
          )}
        </div>
      )}
    </div>
  );
}

/** ¿Es viable la fecha que aspira el cliente? Si no, se propone otra con su motivo. */
export function FechaViable({
  briefId,
  fechaAspirada,
  fechaPropuesta,
  motivo,
  hoy,
}: {
  briefId: number;
  fechaAspirada: string;
  fechaPropuesta: string | null;
  motivo: string | null;
  hoy: string;
}) {
  const [estado, enviar, enviando] = useActionState(decidirFechaBrief, ESTADO_INICIAL);
  useAvisoDeAccion(estado);
  const [viable, setViable] = useState(fechaPropuesta === null);
  const [fecha, setFecha] = useState(fechaPropuesta ?? "");
  const [porque, setPorque] = useState(motivo ?? "");
  const errores = estado.errores ?? {};

  return (
    <form action={enviar} noValidate className="flex flex-col gap-3">
      <input type="hidden" name="id" value={briefId} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[13px] text-suave">¿Es viable la fecha que aspira el cliente?</legend>
        {[
          { valor: true, texto: `Si, es viable: ${fechaAspirada}` },
          { valor: false, texto: "No, proponer otra fecha" },
        ].map((opcion) => (
          <label
            key={String(opcion.valor)}
            className={[
              "suave flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13px]",
              viable === opcion.valor ? "border-acento bg-acento-tenue font-semibold" : "border-borde hover:border-acento",
            ].join(" ")}
          >
            <input
              type="radio"
              name="viable"
              value={opcion.valor ? "si" : "no"}
              checked={viable === opcion.valor}
              onChange={() => setViable(opcion.valor)}
              className="accent-[var(--acento)]"
            />
            {opcion.texto}
          </label>
        ))}
      </fieldset>

      {!viable && (
        <div className="flex flex-col gap-3">
          <CampoFecha
            id={`brief-${briefId}-fecha-propuesta`}
            nombre="fechaPropuesta"
            etiqueta="Fecha que propones"
            min={hoy}
            valor={fecha}
            onCambio={setFecha}
            error={errores.fechaPropuesta}
          />
          <label>
            <span className="mb-1.5 block text-xs font-semibold">Por que</span>
            <input
              name="motivoFecha"
              value={porque}
              onChange={(evento) => setPorque(evento.target.value)}
              maxLength={500}
              aria-invalid={errores.motivoFecha ? true : undefined}
              className={claseLinea()}
            />
            {errores.motivoFecha && (
              <span role="alert" className="mt-1 block text-[12px] text-blackberry dark-tema:text-acento">
                {errores.motivoFecha}
              </span>
            )}
          </label>
        </div>
      )}

      <div className={PIE_TARJETA}>
        <Boton type="submit" variante="fantasma" tamano="chico" disabled={enviando}>
          <CalendarCheck aria-hidden="true" />
          {enviando ? "Guardando..." : "Guardar la fecha"}
        </Boton>
      </div>
    </form>
  );
}
