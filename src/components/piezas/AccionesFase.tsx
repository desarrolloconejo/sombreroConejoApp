"use client";

import { createContext, useActionState, useContext, useEffect, useState, type ReactNode } from "react";
import { CalendarCheck, CheckCheck, Undo2 } from "lucide-react";

import { completarFase, planificarFase, regresarFase } from "@/actions/piezas";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { anunciarLogro, Boton, CampoFecha, Selector } from "@/components/ui";
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

  // Completar una fase enciende la bateria de la cabecera.
  useEffect(() => {
    if (completado.ok && completado.logro) anunciarLogro();
  }, [completado]);

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
  falta = null,
}: {
  piezaId: number;
  fase: number;
  /** Tareas de la fase que faltan por marcar. */
  pendientes: number;
  /** Otra cosa que falta para completarla (la version del cliente, en la fase 4). */
  falta?: string | null;
}) {
  const { completar: enviar, completando: enviando } = useMovimientos();
  const motivo =
    pendientes > 0
      ? pendientes === 1
        ? "Falta una tarea por marcar como lista."
        : `Faltan ${pendientes} tareas por marcar como listas.`
      : falta;

  return (
    <form action={enviar} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="piezaId" value={piezaId} />
      <input type="hidden" name="fase" value={fase} />
      <Boton type="submit" tamano="chico" disabled={enviando || motivo !== null}>
        <CheckCheck aria-hidden="true" />
        {enviando ? "Completando…" : "Completar fase"}
      </Boton>
      {motivo && <span className="text-[12px] text-suave">{motivo}</span>}
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
    // La rejilla mira el ancho de la tarjeta (@container), no el de la pantalla:
    // en la columna de fases, una pantalla ancha no garantiza sitio.
    <form action={enviar} className="@container rounded-xl border border-borde bg-campo p-4">
      <div className="grid gap-3 @md:grid-cols-[170px_minmax(0,1fr)]">
        <input type="hidden" name="piezaId" value={piezaId} />
        <input type="hidden" name="fase" value={fase.fase} />

        <div>
          <span aria-hidden="true" className="mb-1.5 block text-[11.5px] font-semibold text-suave">
            Fecha estimada
          </span>
          <CampoFecha
            id={`${id}-fecha`}
            nombre="fechaEstimada"
            etiqueta="Fecha estimada"
            etiquetaOculta
            compacto
            opcional
            valor={fecha}
            onCambio={setFecha}
          />
        </div>

        <div className="min-w-0 flex-1">
          <span aria-hidden="true" className="mb-1.5 block text-[11.5px] font-semibold text-suave">
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

        {estado.errores?.fechaEstimada && (
          <p role="alert" className="text-[11.5px] font-medium text-blackberry @md:col-span-2 dark-tema:text-gold">
            {estado.errores.fechaEstimada}
          </p>
        )}

        <div className="flex justify-end @md:col-span-2">
          <Boton type="submit" variante="fantasma" tamano="chico" disabled={enviando}>
            <CalendarCheck aria-hidden="true" />
            {enviando ? "Guardando…" : "Guardar"}
          </Boton>
        </div>
      </div>
    </form>
  );
}
