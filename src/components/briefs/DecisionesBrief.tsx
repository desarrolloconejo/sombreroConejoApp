"use client";

import { createContext, useActionState, useContext, useState, type ReactNode } from "react";
import { Ban, CalendarCheck, FileSpreadsheet, FolderPlus } from "lucide-react";

import {
  aceptarBrief,
  decidirFechaBrief,
  descartarBrief,
  presupuestarBrief,
} from "@/actions/briefs";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { Boton, CLASE_CONTROL } from "@/components/ui";
import { CredencialProvisional } from "@/components/usuarios/CredencialProvisional";
import { ESTADO_INICIAL, type EstadoFormulario } from "@/types";

/**
 * Las decisiones de la bandeja sobre un brief.
 *
 * Aceptar, presupuestar y descartar cambian el estado del brief: al terminar,
 * los botones desaparecen. Su estado vive en `ProveedorDecisiones`, que
 * envuelve la ficha, para que el aviso no se pierda y para mostrar, una sola
 * vez, la contrasena provisional del prospecto que se acaba de convertir.
 */

type Accion = [EstadoFormulario, (datos: FormData) => void, boolean];

const ContextoDecisiones = createContext<{ aceptar: Accion; presupuestar: Accion; descartar: Accion } | null>(null);

export function ProveedorDecisiones({ children }: { children: ReactNode }) {
  const aceptar = useActionState(aceptarBrief, ESTADO_INICIAL);
  const presupuestar = useActionState(presupuestarBrief, ESTADO_INICIAL);
  const descartar = useActionState(descartarBrief, ESTADO_INICIAL);

  useAvisoDeAccion(aceptar[0]);
  useAvisoDeAccion(presupuestar[0]);
  useAvisoDeAccion(descartar[0]);

  const credencial = aceptar[0].credencial;

  return (
    <ContextoDecisiones.Provider value={{ aceptar, presupuestar, descartar }}>
      {credencial && (
        <div className="mb-6">
          <CredencialProvisional
            email={credencial.email}
            password={credencial.password}
            titulo="Cuenta creada para el prospecto"
            descripcion="Ya es cliente. Entregale esta contrasena en mano: al entrar tendra que elegir otra. No se vuelve a mostrar."
          />
        </div>
      )}
      {children}
    </ContextoDecisiones.Provider>
  );
}

function useDecisiones() {
  const decisiones = useContext(ContextoDecisiones);
  if (!decisiones) throw new Error("Va dentro de ProveedorDecisiones");
  return decisiones;
}

/** Las tres decisiones: aceptar y abrir proyecto, presupuestar o descartar. */
export function BotonesDecision({
  briefId,
  aceptar: puedeAceptar,
  presupuestar: puedePresupuestar,
  descartar: puedeDescartar,
}: {
  briefId: number;
  aceptar: boolean;
  presupuestar: boolean;
  descartar: boolean;
}) {
  const { aceptar, presupuestar, descartar } = useDecisiones();
  const [descartando, setDescartando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const ocupado = aceptar[2] || presupuestar[2] || descartar[2];

  if (descartando) {
    return (
      <form action={descartar[1]} noValidate className="flex flex-col gap-3">
        <input type="hidden" name="id" value={briefId} />
        <label>
          <span className="mb-2 block text-xs font-semibold">Por que no seguimos</span>
          <textarea
            name="motivo"
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            rows={3}
            maxLength={1000}
            aria-invalid={descartar[0].errores?.motivo ? true : undefined}
            className={`${CLASE_CONTROL} min-h-[84px] py-2.5`}
          />
          {descartar[0].errores?.motivo && (
            <span role="alert" className="mt-1.5 block text-[12px] font-medium text-blackberry dark-tema:text-acento">
              {descartar[0].errores.motivo}
            </span>
          )}
        </label>
        <p className="text-[12px] leading-relaxed text-suave">
          El cliente recibe el motivo. El brief queda archivado: no se borra.
        </p>
        <div className="flex flex-wrap justify-end gap-2.5">
          <Boton type="button" variante="fantasma" tamano="chico" onClick={() => setDescartando(false)}>
            Volver
          </Boton>
          <Boton type="submit" variante="peligro" tamano="chico" disabled={ocupado}>
            <Ban aria-hidden="true" />
            Descartar el brief
          </Boton>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {puedeAceptar && (
        <form action={aceptar[1]}>
          <input type="hidden" name="id" value={briefId} />
          <Boton type="submit" disabled={ocupado}>
            <FolderPlus aria-hidden="true" />
            {aceptar[2] ? "Abriendo..." : "Aceptar y abrir proyecto"}
          </Boton>
        </form>
      )}
      {puedePresupuestar && (
        <form action={presupuestar[1]}>
          <input type="hidden" name="id" value={briefId} />
          <Boton type="submit" variante="fantasma" disabled={ocupado}>
            <FileSpreadsheet aria-hidden="true" />
            Convertir en presupuesto
          </Boton>
        </form>
      )}
      {puedeDescartar && (
        <Boton type="button" variante="fantasma" tamano="chico" onClick={() => setDescartando(true)}>
          <Ban aria-hidden="true" />
          Descartar
        </Boton>
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
        <legend className="mb-2 text-[13px] font-bold">¿Es viable la fecha que aspira el cliente?</legend>
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
        <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
          <label>
            <span className="mb-1.5 block text-xs font-semibold">Fecha que propones</span>
            <input
              type="date"
              name="fechaPropuesta"
              min={hoy}
              value={fecha}
              onChange={(evento) => setFecha(evento.target.value)}
              aria-invalid={errores.fechaPropuesta ? true : undefined}
              className={CLASE_CONTROL}
            />
            {errores.fechaPropuesta && (
              <span role="alert" className="mt-1 block text-[12px] text-blackberry dark-tema:text-acento">
                {errores.fechaPropuesta}
              </span>
            )}
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-semibold">Por que</span>
            <input
              name="motivoFecha"
              value={porque}
              onChange={(evento) => setPorque(evento.target.value)}
              maxLength={500}
              aria-invalid={errores.motivoFecha ? true : undefined}
              className={CLASE_CONTROL}
            />
            {errores.motivoFecha && (
              <span role="alert" className="mt-1 block text-[12px] text-blackberry dark-tema:text-acento">
                {errores.motivoFecha}
              </span>
            )}
          </label>
        </div>
      )}

      <div className="flex justify-end">
        <Boton type="submit" variante="fantasma" tamano="chico" disabled={enviando}>
          <CalendarCheck aria-hidden="true" />
          {enviando ? "Guardando..." : "Guardar la fecha"}
        </Boton>
      </div>
    </form>
  );
}
