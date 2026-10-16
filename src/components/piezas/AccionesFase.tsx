"use client";

import { createContext, useActionState, useContext, useState, type ReactNode } from "react";
import { CalendarCheck, CheckCheck, Undo2 } from "lucide-react";

import { completarFase, planificarFase, regresarFase } from "@/actions/piezas";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { Boton, CLASE_CONTROL, Selector } from "@/components/ui";
import { ESTADO_INICIAL, type FasePieza, type PersonaDeEquipo } from "@/types";

import { opcionesDeEquipo } from "./opcionesEquipo";

/**
 * Lo que el ejecutivo hace con una fase: completarla, regresarla y
 * planificarla. Solo se pinta para quien gestiona la pieza; la action lo
 * vuelve a comprobar.
 *
 * Completar y regresar guardan su estado en un proveedor que envuelve todas
 * las fases: al completar una, su boton desaparece con la revalidacion, y si
 * el estado viviera en el boton se llevaria el aviso antes de mostrarlo.
 */

type Movimientos = {
  completar: (datos: FormData) => void;
  completando: boolean;
  regresar: (datos: FormData) => void;
  regresando: boolean;
};

const ContextoMovimientos = createContext<Movimientos | null>(null);

function useMovimientos(): Movimientos {
  const movimientos = useContext(ContextoMovimientos);
  if (!movimientos) throw new Error("Falta MovimientosDeFase alrededor de las fases");
  return movimientos;
}

export function MovimientosDeFase({ children }: { children: ReactNode }) {
  const [completado, completar, completando] = useActionState(completarFase, ESTADO_INICIAL);
  const [regresado, regresar, regresando] = useActionState(regresarFase, ESTADO_INICIAL);

  useAvisoDeAccion(completado);
  useAvisoDeAccion(regresado);

  return (
    <ContextoMovimientos.Provider value={{ completar, completando, regresar, regresando }}>
      {children}
    </ContextoMovimientos.Provider>
  );
}

export function CompletarFase({
  piezaId,
  fase,
  pendientes,
}: {
  piezaId: number;
  fase: number;
  /** Tareas de la fase que faltan por marcar. */
  pendientes: number;
}) {
  const { completar: enviar, completando: enviando } = useMovimientos();

  return (
    <form action={enviar} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="piezaId" value={piezaId} />
      <input type="hidden" name="fase" value={fase} />
      <Boton type="submit" tamano="chico" disabled={enviando || pendientes > 0}>
        <CheckCheck aria-hidden="true" />
        {enviando ? "Completando…" : "Completar fase"}
      </Boton>
      {pendientes > 0 && (
        <span className="text-[12px] text-suave">
          {pendientes === 1
            ? "Falta una tarea por marcar como lista."
            : `Faltan ${pendientes} tareas por marcar como listas.`}
        </span>
      )}
    </form>
  );
}

export function RegresarFase({ piezaId }: { piezaId: number }) {
  const { regresar: enviar, regresando: enviando } = useMovimientos();

  return (
    <form action={enviar}>
      <input type="hidden" name="piezaId" value={piezaId} />
      <Boton type="submit" variante="fantasma" tamano="chico" disabled={enviando}>
        <Undo2 aria-hidden="true" />
        {enviando ? "Regresando…" : "Regresar a esta fase"}
      </Boton>
    </form>
  );
}

export function PlanificarFase({
  piezaId,
  fase,
  equipo,
}: {
  piezaId: number;
  fase: FasePieza;
  equipo: PersonaDeEquipo[];
}) {
  const [estado, enviar, enviando] = useActionState(planificarFase, ESTADO_INICIAL);
  useAvisoDeAccion(estado);

  const id = `fase-${fase.fase}`;

  // Controlados: React vacia los campos no controlados al terminar la action.
  const [fecha, setFecha] = useState(fase.fechaEstimada ?? "");
  const [responsable, setResponsable] = useState(String(fase.responsableId ?? ""));

  return (
    <form action={enviar} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="piezaId" value={piezaId} />
      <input type="hidden" name="fase" value={fase.fase} />

      <div>
        <label htmlFor={`${id}-fecha`} className="mb-1 block text-[11px] font-semibold text-suave">
          Fecha estimada
        </label>
        <input
          id={`${id}-fecha`}
          type="date"
          name="fechaEstimada"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className={`${CLASE_CONTROL} min-h-10 w-[160px] py-2`}
        />
      </div>

      <div className="min-w-0 flex-1">
        <span aria-hidden="true" className="mb-1 block text-[11px] font-semibold text-suave">
          Responsable
        </span>
        <Selector
          id={`${id}-responsable`}
          nombre="responsableId"
          etiqueta="Responsable"
          etiquetaOculta
          compacto
          valor={responsable}
          onCambio={setResponsable}
          opciones={opcionesDeEquipo(equipo)}
        />
      </div>

      <Boton type="submit" variante="fantasma" tamano="chico" disabled={enviando}>
        <CalendarCheck aria-hidden="true" />
        {enviando ? "Guardando…" : "Guardar"}
      </Boton>

      {estado.errores?.fechaEstimada && (
        <p role="alert" className="w-full text-[11.5px] font-medium text-blackberry dark-tema:text-gold">
          {estado.errores.fechaEstimada}
        </p>
      )}
    </form>
  );
}
