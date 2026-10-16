"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Check, Circle, ExternalLink, Pencil, Plus, Trash2, X } from "lucide-react";

import {
  crearTarea,
  editarTarea,
  marcarTareaLista,
  quitarTarea,
  reabrirTarea,
} from "@/actions/tareas";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { fechaCorta } from "@/components/proyectos/ColumnasProyectos";
import { Boton, CampoFecha, claseLinea, Selector } from "@/components/ui";
import { herramientaPorSlug } from "@/lib/herramientas";
import {
  ESTADO_INICIAL,
  type EstadoFormulario,
  type FaseDeTrabajo,
  type PersonaDeEquipo,
  type Tarea,
} from "@/types";

import { opcionesDeEquipo } from "./opcionesEquipo";

/**
 * Las tareas de una fase de trabajo.
 *
 * Todas las acciones guardan su estado aqui y no en cada fila: al quitar una
 * tarea su fila desaparece con la revalidacion, y se llevaria el aviso antes
 * de mostrarlo.
 */

const ICONO =
  "suave grid size-9 shrink-0 place-items-center rounded-[10px] border border-transparent text-suave " +
  "hover:border-acento hover:bg-acento hover:text-acento-contraste disabled:pointer-events-none disabled:opacity-40 " +
  "[&>svg]:size-4";

/** Los campos de una tarea, para el alta y para la edicion. */
function CamposTarea({
  prefijo,
  tarea,
  equipo,
  errores,
}: {
  prefijo: string;
  tarea?: Tarea;
  equipo: PersonaDeEquipo[];
  errores: EstadoFormulario["errores"];
}) {
  const [titulo, setTitulo] = useState(tarea?.titulo ?? "");
  const [responsable, setResponsable] = useState(String(tarea?.responsableId ?? ""));
  const [fecha, setFecha] = useState(tarea?.fechaEstimada ?? "");

  return (
    // Como en planificar: la rejilla mira el ancho de la tarjeta, no la pantalla.
    <div className="@container">
      <div className="grid gap-2.5 @lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_170px]">
        <div className="min-w-0">
          <label htmlFor={`${prefijo}-titulo`} className="sr-only">
            Que hay que hacer
          </label>
          <input
            id={`${prefijo}-titulo`}
            name="titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Que hay que hacer"
            maxLength={160}
            aria-invalid={errores?.titulo ? true : undefined}
            className={claseLinea("compacto")}
          />
        </div>

        <div className="min-w-0">
          <Selector
            id={`${prefijo}-responsable`}
            nombre="responsableId"
            etiqueta="Quien la hace"
            etiquetaOculta
            compacto
            valor={responsable}
            onCambio={setResponsable}
            opciones={opcionesDeEquipo(equipo)}
          />
        </div>

        <div>
          <CampoFecha
            id={`${prefijo}-fecha`}
            nombre="fechaEstimada"
            etiqueta="Para cuando"
            etiquetaOculta
            compacto
            opcional
            valor={fecha}
            onCambio={setFecha}
          />
        </div>

        {(errores?.titulo || errores?.responsableId || errores?.fechaEstimada) && (
          <p role="alert" className="text-[11.5px] font-medium text-blackberry @lg:col-span-3 dark-tema:text-gold">
            {errores.titulo ?? errores.responsableId ?? errores.fechaEstimada}
          </p>
        )}
      </div>
    </div>
  );
}

export function TareasFase({
  piezaId,
  fase,
  tareas,
  gestiona,
  usuarioId,
  equipo,
  faseEnCurso,
  faseCompletada,
  piezaActiva,
}: {
  piezaId: number;
  fase: FaseDeTrabajo;
  tareas: Tarea[];
  gestiona: boolean;
  usuarioId: number;
  equipo: PersonaDeEquipo[];
  faseEnCurso: boolean;
  faseCompletada: boolean;
  piezaActiva: boolean;
}) {
  const [marcado, marcar, marcando] = useActionState(marcarTareaLista, ESTADO_INICIAL);
  const [reabierto, reabrir, reabriendo] = useActionState(reabrirTarea, ESTADO_INICIAL);
  const [quitado, quitar, quitando] = useActionState(quitarTarea, ESTADO_INICIAL);
  const [editado, editar, editando] = useActionState(editarTarea, ESTADO_INICIAL);
  const [creado, crear, creando] = useActionState(crearTarea, ESTADO_INICIAL);

  useAvisoDeAccion(marcado);
  useAvisoDeAccion(reabierto);
  useAvisoDeAccion(quitado);
  useAvisoDeAccion(editado);
  useAvisoDeAccion(creado);

  const [enEdicion, setEnEdicion] = useState<number | null>(null);
  const [anadiendo, setAnadiendo] = useState(false);

  const ocupado = marcando || reabriendo || quitando || editando || creando;
  const puedeAnadir = gestiona && piezaActiva && !faseCompletada;

  return (
    <div className="mt-4">
      {tareas.length === 0 ? (
        <p className="text-[12px] text-suave">
          Sin tareas: la fase se completa directamente.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {tareas.map((tarea) => {
            const mia = tarea.responsableId === usuarioId;
            const puedeMarcar = (gestiona || mia) && piezaActiva;
            const lista = tarea.estado === "lista";
            const herramienta = herramientaPorSlug(tarea.herramienta);

            if (enEdicion === tarea.id) {
              return (
                <li key={tarea.id} className="rounded-xl border border-acento px-4 py-4">
                  <form
                    action={(datos) => {
                      editar(datos);
                      setEnEdicion(null);
                    }}
                    className="flex flex-col gap-3"
                  >
                    <input type="hidden" name="tareaId" value={tarea.id} />
                    <CamposTarea
                      prefijo={`tarea-${tarea.id}`}
                      tarea={tarea}
                      equipo={equipo}
                      errores={editado.errores}
                    />
                    <div className="flex justify-end gap-2">
                      <Boton type="button" variante="fantasma" tamano="chico" onClick={() => setEnEdicion(null)}>
                        Cancelar
                      </Boton>
                      <Boton type="submit" tamano="chico" disabled={ocupado}>
                        <Check aria-hidden="true" />
                        Guardar
                      </Boton>
                    </div>
                  </form>
                </li>
              );
            }

            return (
              <li
                key={tarea.id}
                className={[
                  "flex min-h-[56px] items-center gap-3 rounded-xl border px-3.5 py-2.5",
                  mia ? "border-acento/40 bg-acento-tenue" : "border-borde",
                ].join(" ")}
              >
                <form action={lista ? reabrir : marcar}>
                  <input type="hidden" name="tareaId" value={tarea.id} />
                  <button
                    type="submit"
                    disabled={!puedeMarcar || ocupado || (lista && faseCompletada)}
                    aria-label={
                      lista ? `Reabrir la tarea ${tarea.titulo}` : `Marcar como lista la tarea ${tarea.titulo}`
                    }
                    title={lista ? "Reabrir" : "Marcar como lista"}
                    className={[
                      "suave grid size-8 shrink-0 place-items-center rounded-full border-2 [&>svg]:size-4",
                      lista
                        ? "border-blackberry bg-blackberry text-white dark-tema:border-gold dark-tema:bg-gold dark-tema:text-navy"
                        : "border-borde text-transparent hover:border-acento hover:text-acento",
                      "disabled:cursor-default",
                    ].join(" ")}
                  >
                    {lista ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}
                  </button>
                </form>

                <div className="min-w-0 flex-1">
                  <p className={["truncate text-[13px] font-semibold", lista ? "text-suave line-through" : ""].join(" ")}>
                    {tarea.titulo}
                  </p>
                  <p className="truncate text-[11.5px] text-suave">
                    {tarea.responsableNombre ?? "Sin asignar"}
                    {mia && " (tu)"}
                    {tarea.fechaEstimada && ` · ${fechaCorta(tarea.fechaEstimada)}`}
                  </p>
                </div>

                {herramienta && (gestiona || mia) && !lista && faseEnCurso && (
                  <Link
                    href={herramienta.href(tarea.id)}
                    className="suave hidden items-center gap-1.5 rounded-[10px] border border-borde px-2.5 py-1.5 text-[12px] font-semibold hover:border-acento hover:bg-acento hover:text-acento-contraste sm:inline-flex [&>svg]:size-3.5"
                  >
                    {herramienta.titulo}
                    <ExternalLink aria-hidden="true" />
                  </Link>
                )}

                {gestiona && piezaActiva && (
                  <button
                    type="button"
                    onClick={() => setEnEdicion(tarea.id)}
                    aria-label={`Editar la tarea ${tarea.titulo}`}
                    title="Editar"
                    disabled={ocupado}
                    className={ICONO}
                  >
                    <Pencil aria-hidden="true" />
                  </button>
                )}

                {gestiona && !lista && (
                  <form action={quitar}>
                    <input type="hidden" name="tareaId" value={tarea.id} />
                    <button
                      type="submit"
                      aria-label={`Quitar la tarea ${tarea.titulo}`}
                      title="Quitar"
                      disabled={ocupado}
                      className={ICONO}
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {puedeAnadir && !anadiendo && (
        <div className="mt-3">
          <Boton type="button" variante="fantasma" tamano="chico" onClick={() => setAnadiendo(true)}>
            <Plus aria-hidden="true" />
            Anadir tarea
          </Boton>
        </div>
      )}

      {puedeAnadir && anadiendo && (
        <form
          key={creado.ok ? creado.mensaje + String(tareas.length) : "nueva"}
          action={crear}
          className="mt-3 flex flex-col gap-3 rounded-xl border border-dashed border-borde px-4 py-4"
        >
          <input type="hidden" name="piezaId" value={piezaId} />
          <input type="hidden" name="fase" value={fase} />
          <CamposTarea prefijo={`nueva-${fase}`} equipo={equipo} errores={creado.errores} />
          <div className="flex justify-end gap-2">
            <Boton type="button" variante="fantasma" tamano="chico" onClick={() => setAnadiendo(false)}>
              <X aria-hidden="true" />
              Cerrar
            </Boton>
            <Boton type="submit" tamano="chico" disabled={ocupado}>
              <Plus aria-hidden="true" />
              {creando ? "Anadiendo…" : "Anadir"}
            </Boton>
          </div>
        </form>
      )}

    </div>
  );
}
