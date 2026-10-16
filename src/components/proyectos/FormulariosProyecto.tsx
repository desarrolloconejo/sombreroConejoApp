"use client";

import { useActionState, useState } from "react";
import { Check, Pause, Play, Plus, Power, XCircle } from "lucide-react";

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
  /** Quien puede llevarlo: administradores y ejecutivos de la empresa. */
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
            opciones={ejecutivos.map((p) => ({ valor: String(p.id), texto: p.nombre }))}
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

      <p>
        Ahora esta{" "}
        <strong className="font-semibold text-texto">
          {NOMBRES_DE_ESTADO_PROYECTO[proyecto.estado].toLowerCase()}
        </strong>
        .
      </p>

      {!estado.ok && (
        <ul className="mt-4 flex flex-col gap-2">
          {DESTINOS[proyecto.estado].map((destino) => {
            const { boton, explica, icono: Icono } = CAMBIOS[destino];

            return (
              <li
                key={destino}
                className="flex items-center justify-between gap-3 rounded-xl border border-borde px-3.5 py-2.5"
              >
                <span className="text-[12.5px] text-suave">{explica}</span>
                <Boton
                  type="submit"
                  name="estado"
                  value={destino}
                  tamano="chico"
                  variante={destino === "cancelado" ? "peligro" : "fantasma"}
                  disabled={enviando}
                >
                  <Icono aria-hidden="true" />
                  {boton}
                </Boton>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-5 flex justify-end">
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
