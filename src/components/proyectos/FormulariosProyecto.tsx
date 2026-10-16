"use client";

import { useActionState, useState } from "react";
import { Check, ChevronRight, Pause, Play, Plus, Power, XCircle } from "lucide-react";

import { cambiarEstadoProyecto, editarProyecto } from "@/actions/proyectos";
import { crearPieza } from "@/actions/piezas";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { PanelCuerpo, PanelPie } from "@/components/listado";
import { Boton, BotonEnlace, Campo, CampoFecha, Selector, useCampos } from "@/components/ui";
import {
  ESTADO_INICIAL,
  NOMBRES_DE_ESTADO_PROYECTO,
  NOMBRES_DE_TIPO_PIEZA,
  type EstadoProyecto,
  type PersonaBreve,
  type Proyecto,
  type TipoPieza,
} from "@/types";

/**
 * Los formularios de los paneles de un proyecto: editarlo, cambiarle el
 * estado y anadirle una pieza. Cada uno es de cliente solo por
 * `useActionState`: la action puede negarse y el motivo se lee sin cerrar el
 * panel.
 */

export function EditarProyecto({
  proyecto,
  ejecutivos,
  hrefCancelar,
}: {
  proyecto: Proyecto;
  /** Quien puede llevarlo: los ejecutivos de cuentas asignados a la empresa. */
  ejecutivos: PersonaBreve[];
  hrefCancelar: string;
}) {
  const [estado, enviar, enviando] = useActionState(editarProyecto, ESTADO_INICIAL);
  useAvisoDeAccion(estado);

  const errores = estado.errores ?? {};
  const { campo, fecha } = useCampos({
    nombre: proyecto.nombre,
    descripcion: proyecto.descripcion ?? "",
    fechaInicio: proyecto.fechaInicio ?? "",
    fechaEstimadaCierre: proyecto.fechaEstimadaCierre ?? "",
  });

  return (
    <form action={enviar} noValidate className="flex min-h-0 flex-1 flex-col">
      <PanelCuerpo>
        <input type="hidden" name="id" value={proyecto.id} />

        <div className="grid grid-cols-2 gap-3.5">
          <Campo
            id="editar-nombre"
            {...campo("nombre")}
            etiqueta="Nombre"
            maxLength={120}
            required
            error={errores.nombre}
            className="col-span-2"
          />
          <Campo
            id="editar-descripcion"
            {...campo("descripcion")}
            etiqueta="Descripcion"
            opcional
            maxLength={1000}
            className="col-span-2"
          />
          <Selector
            id="editar-ejecutivo"
            nombre="ejecutivoId"
            etiqueta="Lo lleva"
            opciones={[
              // Quien lo lleva hoy sigue en la lista aunque ya no pueda elegirse
              // (un administrador de antes, alguien que dejo la cuenta).
              ...(ejecutivos.some((p) => p.id === proyecto.ejecutivoId)
                ? []
                : [
                    {
                      valor: String(proyecto.ejecutivoId),
                      texto: proyecto.ejecutivoNombre,
                      detalle: "Lo lleva hoy; ya no se puede elegir",
                    },
                  ]),
              ...ejecutivos.map((p) => ({ valor: String(p.id), texto: p.nombre })),
            ]}
            valorInicial={String(proyecto.ejecutivoId)}
            error={errores.ejecutivoId}
            className="col-span-2"
          />
          <CampoFecha
            id="editar-inicio"
            etiqueta="Inicio"
            opcional
            error={errores.fechaInicio}
            {...fecha("fechaInicio")}
          />
          <CampoFecha
            id="editar-cierre"
            etiqueta="Cierre estimado"
            opcional
            error={errores.fechaEstimadaCierre}
            {...fecha("fechaEstimadaCierre")}
          />
        </div>
      </PanelCuerpo>

      <PanelPie>
        <BotonEnlace href={hrefCancelar} variante="fantasma">
          {estado.ok ? "Cerrar" : "Cancelar"}
        </BotonEnlace>
        <Boton type="submit" disabled={enviando}>
          <Check aria-hidden="true" />
          {enviando ? "Guardando…" : "Guardar"}
        </Boton>
      </PanelPie>
    </form>
  );
}

/** Que dice cada cambio de estado, en el boton y debajo. */
const CAMBIOS: Record<
  EstadoProyecto,
  { boton: string; explica: string; icono: typeof Pause }
> = {
  activo: {
    boton: "Reanudar",
    explica: "Vuelve al tablero y a los listados de trabajo.",
    icono: Play,
  },
  pausado: {
    boton: "Pausar",
    explica: "Sigue en el tablero, marcado como pausado. Nada se pierde.",
    icono: Pause,
  },
  cerrado: {
    boton: "Cerrar el proyecto",
    explica: "Solo con todas sus piezas aprobadas. Sale del tablero.",
    icono: Power,
  },
  cancelado: {
    boton: "Cancelar el proyecto",
    explica: "Para lo que no va a salir. Se conserva, pero deja de contar.",
    icono: XCircle,
  },
};

const DESTINOS: Record<EstadoProyecto, readonly EstadoProyecto[]> = {
  activo: ["pausado", "cerrado", "cancelado"],
  pausado: ["activo", "cerrado", "cancelado"],
  cerrado: ["activo"],
  cancelado: ["activo"],
};

export function CambiarEstadoProyecto({
  proyecto,
  hrefCerrar,
}: {
  proyecto: Proyecto;
  hrefCerrar: string;
}) {
  const [estado, enviar, enviando] = useActionState(cambiarEstadoProyecto, ESTADO_INICIAL);
  useAvisoDeAccion(estado);

  return (
    <form action={enviar}>
      <input type="hidden" name="id" value={proyecto.id} />

      <p className="text-[13.5px]">
        Ahora esta{" "}
        <strong className="font-semibold text-texto">
          {NOMBRES_DE_ESTADO_PROYECTO[proyecto.estado].toLowerCase()}
        </strong>
        . Elige a que estado pasa.
      </p>

      {/*
        Cada destino es una opcion entera: se pulsa la fila, con su nombre y
        lo que significa debajo. Sigue siendo un submit con name="estado".
      */}
      {!estado.ok && (
        <ul className="mt-5 flex flex-col gap-3">
          {DESTINOS[proyecto.estado].map((destino) => {
            const { boton, explica, icono: Icono } = CAMBIOS[destino];
            const peligro = destino === "cancelado";

            return (
              <li key={destino}>
                <button
                  type="submit"
                  name="estado"
                  value={destino}
                  disabled={enviando}
                  className={[
                    "suave group flex w-full cursor-pointer items-center gap-4 rounded-[14px] border px-4 py-4 text-left",
                    "hover:-translate-y-0.5 focus-visible:outline-none focus-visible:shadow-[var(--foco)]",
                    "disabled:pointer-events-none disabled:opacity-55",
                    peligro
                      ? "border-blackberry/35 hover:border-blackberry hover:bg-blackberry hover:text-white dark-tema:border-[#e9a9cd]/40 dark-tema:hover:border-[#e9a9cd] dark-tema:hover:bg-blackberry"
                      : "border-borde hover:border-acento hover:bg-acento-tenue",
                  ].join(" ")}
                >
                  <span
                    aria-hidden="true"
                    className={[
                      "grid size-10 shrink-0 place-items-center rounded-full [&>svg]:size-[18px]",
                      peligro
                        ? "bg-blackberry/10 text-blackberry group-hover:bg-white/15 group-hover:text-white dark-tema:text-[#e9a9cd]"
                        : "bg-acento-tenue text-acento",
                    ].join(" ")}
                  >
                    <Icono />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={[
                        "block text-[14px] font-bold",
                        peligro
                          ? "text-blackberry group-hover:text-white dark-tema:text-[#e9a9cd]"
                          : "text-texto",
                      ].join(" ")}
                    >
                      {boton}
                    </span>
                    <span
                      className={[
                        "mt-0.5 block text-[12.5px] leading-relaxed",
                        peligro ? "text-suave group-hover:text-white/80" : "text-suave",
                      ].join(" ")}
                    >
                      {explica}
                    </span>
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 shrink-0 opacity-50 group-hover:translate-x-0.5 group-hover:opacity-100"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-6 flex justify-end border-t border-borde pt-4">
        <BotonEnlace href={hrefCerrar} variante="fantasma" tamano="chico">
          {estado.ok ? "Cerrar" : "Volver"}
        </BotonEnlace>
      </div>
    </form>
  );
}

export function FormularioPieza({
  proyectoId,
  tipos,
  hrefCancelar,
}: {
  proyectoId: number;
  /** Los tipos que ofrece el servicio del proyecto. */
  tipos: readonly TipoPieza[];
  hrefCancelar: string;
}) {
  const [estado, enviar, enviando] = useActionState(crearPieza, ESTADO_INICIAL);
  useAvisoDeAccion(estado);

  const errores = estado.errores ?? {};
  const [sugeridas, setSugeridas] = useState(true);
  const { campo } = useCampos({ titulo: "" });

  return (
    // La clave cambia con cada pieza creada: el formulario queda limpio para
    // la siguiente sin cerrar el panel.
    <form
      key={estado.ok ? estado.mensaje : "nueva"}
      action={enviar}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
    >
      <PanelCuerpo>
        <input type="hidden" name="proyectoId" value={proyectoId} />

        <div className="flex flex-col gap-3.5">
          <Selector
            id="pieza-tipo"
            nombre="tipo"
            etiqueta="Tipo"
            opciones={tipos.map((tipo) => ({ valor: tipo, texto: NOMBRES_DE_TIPO_PIEZA[tipo] }))}
            valorInicial={tipos[0]}
            error={errores.tipo}
          />
          <Campo
            id="pieza-titulo"
            {...campo("titulo")}
            etiqueta="Titulo"
            placeholder="Receta en 30 segundos"
            maxLength={120}
            required
            error={errores.titulo}
          />

          <label className="flex items-start gap-3 rounded-xl border border-borde px-4 py-3 text-[12.5px] leading-relaxed">
            <input
              type="checkbox"
              name="sugeridas"
              checked={sugeridas}
              onChange={(e) => setSugeridas(e.target.checked)}
              className="mt-0.5 size-[18px] shrink-0 accent-[var(--acento)]"
            />
            <span>
              <b className="font-semibold">Crear las tareas sugeridas</b>{" "}
              <span className="text-suave">de su tipo, sin asignar.</span>
            </span>
          </label>
        </div>
      </PanelCuerpo>

      <PanelPie>
        <BotonEnlace href={hrefCancelar} variante="fantasma">
          {estado.ok ? "Cerrar" : "Cancelar"}
        </BotonEnlace>
        <Boton type="submit" disabled={enviando}>
          <Plus aria-hidden="true" />
          {enviando ? "Anadiendo…" : "Anadir pieza"}
        </Boton>
      </PanelPie>
    </form>
  );
}
