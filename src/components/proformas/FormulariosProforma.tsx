"use client";

import { createContext, useActionState, useContext, useState, type ReactNode } from "react";
import { Ban, FileCheck2, Repeat, Save } from "lucide-react";

import {
  anularProforma,
  cambiarRecurrencia,
  guardarProforma,
  prepararSiguiente,
} from "@/actions/proformas";
import { EditorRenglones } from "@/components/finanzas/EditorRenglones";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { Boton, Campo, CLASE_CONTROL, useCampos } from "@/components/ui";
import {
  ESTADO_INICIAL,
  type EstadoFormulario,
  type Proforma,
  type ProyectoDeProforma,
  type Renglon,
} from "@/types";

/**
 * Los formularios de la ficha de una proforma.
 *
 * Guardar y emitir, y anular, cambian en que punto esta la proforma: al
 * terminar, el formulario que las lanzo desaparece de la pagina. Por eso su
 * estado vive en `ProveedorProforma`, que envuelve toda la ficha, y el aviso
 * no se pierde con el formulario.
 */

type Accion = [EstadoFormulario, (datos: FormData) => void, boolean];

const ContextoProforma = createContext<{ guardar: Accion; anular: Accion } | null>(null);

export function ProveedorProforma({ children }: { children: ReactNode }) {
  const guardar = useActionState(guardarProforma, ESTADO_INICIAL);
  const anular = useActionState(anularProforma, ESTADO_INICIAL);

  useAvisoDeAccion(guardar[0]);
  useAvisoDeAccion(anular[0]);

  return <ContextoProforma.Provider value={{ guardar, anular }}>{children}</ContextoProforma.Provider>;
}

function useAcciones() {
  const acciones = useContext(ContextoProforma);
  if (!acciones) throw new Error("Va dentro de ProveedorProforma");
  return acciones;
}

/** El editor de un borrador: titulo, notas, proyectos y renglones. */
export function EditorProforma({
  proforma,
  renglones,
  ligados,
  ligables,
}: {
  proforma: Proforma;
  renglones: Renglon[];
  ligados: ProyectoDeProforma[];
  ligables: ProyectoDeProforma[];
}) {
  const [estado, enviar, enviando] = useAcciones().guardar;
  const errores = estado.errores ?? {};

  const { campo } = useCampos({ titulo: proforma.titulo, notas: proforma.notas ?? "" });
  const [elegidos, setElegidos] = useState<number[]>(ligados.map((p) => p.id));

  function alternar(id: number) {
    setElegidos((actuales) =>
      actuales.includes(id) ? actuales.filter((otro) => otro !== id) : [...actuales, id],
    );
  }

  return (
    <form action={enviar} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="id" value={proforma.id} />

      <div className="grid gap-3.5">
        <Campo id="proforma-titulo" etiqueta="Titulo" maxLength={120} error={errores.titulo} {...campo("titulo")} />
        <Campo
          id="proforma-notas"
          etiqueta="Notas para el cliente"
          opcional
          maxLength={1000}
          {...campo("notas")}
        />
      </div>

      <fieldset>
        <legend className="mb-2 text-xs font-semibold">Proyectos a los que corresponde</legend>
        {ligables.length === 0 ? (
          <p className="text-[12.5px] text-suave">La empresa no tiene proyectos en curso.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {ligables.map((proyecto) => {
              const marcado = elegidos.includes(proyecto.id);

              return (
                <label
                  key={proyecto.id}
                  className={[
                    "suave flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-[12.5px]",
                    marcado ? "border-acento bg-acento-tenue font-semibold" : "border-borde hover:border-acento",
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    name="proyectoId"
                    value={proyecto.id}
                    checked={marcado}
                    onChange={() => alternar(proyecto.id)}
                    className="accent-[var(--acento)]"
                  />
                  {proyecto.nombre}
                </label>
              );
            })}
          </div>
        )}
      </fieldset>

      <div>
        <h3 className="mb-3 text-[15px] font-bold tracking-[-0.01em]">Renglones</h3>
        <EditorRenglones iniciales={renglones} ivaPct={proforma.ivaPct} error={errores.renglones} />
      </div>

      <div className="flex flex-wrap justify-end gap-2.5 border-t border-borde pt-4">
        <Boton type="submit" variante="fantasma" disabled={enviando}>
          <Save aria-hidden="true" />
          Guardar borrador
        </Boton>
        <Boton type="submit" name="emitir" value="si" disabled={enviando}>
          <FileCheck2 aria-hidden="true" />
          {enviando ? "Guardando..." : "Guardar y emitir"}
        </Boton>
      </div>
    </form>
  );
}

/** Anular con motivo. Pide confirmarlo escribiendo por que. */
export function AnularProforma({ proformaId }: { proformaId: number }) {
  const [estado, enviar, enviando] = useAcciones().anular;
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");

  if (!abierto) {
    return (
      <Boton type="button" variante="fantasma" tamano="chico" onClick={() => setAbierto(true)}>
        <Ban aria-hidden="true" />
        Anular la proforma
      </Boton>
    );
  }

  return (
    <form action={enviar} noValidate className="flex flex-col gap-3">
      <input type="hidden" name="id" value={proformaId} />
      <label>
        <span className="mb-2 block text-xs font-semibold">Por que se anula</span>
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
      <p className="text-[12px] leading-relaxed text-suave">
        Una proforma anulada se conserva, pero no vuelve a emitirse ni a repetirse.
      </p>
      <div className="flex flex-wrap justify-end gap-2.5">
        <Boton type="button" variante="fantasma" tamano="chico" onClick={() => setAbierto(false)}>
          Volver
        </Boton>
        <Boton type="submit" variante="peligro" tamano="chico" disabled={enviando}>
          <Ban aria-hidden="true" />
          {enviando ? "Anulando..." : "Anular"}
        </Boton>
      </div>
    </form>
  );
}

/** Si se repite cada mes, y cuando toca la siguiente. */
export function RecurrenciaProforma({
  proforma,
  sugerida,
}: {
  proforma: Proforma;
  /** La fecha que se propone al marcarla: dentro de un mes. */
  sugerida: string;
}) {
  const [estado, enviar, enviando] = useActionState(cambiarRecurrencia, ESTADO_INICIAL);
  useAvisoDeAccion(estado);

  const [recurrente, setRecurrente] = useState(proforma.recurrente);
  const [proxima, setProxima] = useState(proforma.proximaEmision ?? sugerida);

  return (
    <form action={enviar} noValidate className="flex flex-col gap-3.5">
      <input type="hidden" name="id" value={proforma.id} />

      <label className="flex items-start gap-3 text-[12.5px] leading-relaxed">
        <input
          type="checkbox"
          name="recurrente"
          checked={recurrente}
          onChange={(evento) => setRecurrente(evento.target.checked)}
          className="mt-0.5 size-[18px] shrink-0 accent-[var(--acento)]"
        />
        <span>
          <b className="font-semibold">Se repite cada mes.</b>{" "}
          <span className="text-suave">
            Para contratos mensuales. Cuando llegue la fecha, aparece en la portada de
            Proformas para preparar la siguiente. Nunca se emite sola.
          </span>
        </span>
      </label>

      {recurrente && (
        <Campo
          id="proforma-proxima"
          etiqueta="Toca la siguiente el"
          type="date"
          name="proximaEmision"
          value={proxima}
          onChange={(evento) => setProxima(evento.target.value)}
          error={estado.errores?.proximaEmision}
        />
      )}

      <div className="flex justify-end">
        <Boton type="submit" variante="fantasma" tamano="chico" disabled={enviando}>
          <Repeat aria-hidden="true" />
          {enviando ? "Guardando..." : "Guardar la recurrencia"}
        </Boton>
      </div>
    </form>
  );
}

/** Prepara la siguiente de una recurrente y lleva a ella. */
export function PrepararSiguiente({ proformaId, etiqueta }: { proformaId: number; etiqueta: string }) {
  const [estado, enviar, enviando] = useActionState(prepararSiguiente, ESTADO_INICIAL);
  useAvisoDeAccion(estado);

  return (
    <form action={enviar}>
      <input type="hidden" name="id" value={proformaId} />
      <Boton type="submit" tamano="chico" disabled={enviando} aria-label={etiqueta}>
        <Repeat aria-hidden="true" />
        {enviando ? "Preparando..." : "Preparar la siguiente"}
      </Boton>
    </form>
  );
}
