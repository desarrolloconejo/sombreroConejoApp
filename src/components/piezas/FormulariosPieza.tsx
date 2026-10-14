"use client";

import { useActionState, useState } from "react";
import { Ban, Check } from "lucide-react";

import { cancelarPieza, editarPieza } from "@/actions/piezas";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { PanelCuerpo, PanelPie } from "@/components/listado";
import { Boton, BotonEnlace, Campo, Selector, useCampos } from "@/components/ui";
import {
  ESTADO_INICIAL,
  NOMBRES_DE_TIPO_PIEZA,
  type Pieza,
  type PersonaDeEquipo,
  type TipoPieza,
} from "@/types";

/** Los paneles de una pieza: editarla y cancelarla. */

export function EditarPieza({
  pieza,
  tipos,
  equipo,
  hrefCancelar,
}: {
  pieza: Pieza;
  tipos: readonly TipoPieza[];
  equipo: PersonaDeEquipo[];
  hrefCancelar: string;
}) {
  const [estado, enviar, enviando] = useActionState(editarPieza, ESTADO_INICIAL);
  useAvisoDeAccion(estado);

  const errores = estado.errores ?? {};
  const { campo } = useCampos({ titulo: pieza.titulo });

  return (
    <form action={enviar} noValidate className="flex min-h-0 flex-1 flex-col">
      <PanelCuerpo>
        <input type="hidden" name="piezaId" value={pieza.id} />
        <div className="flex flex-col gap-3.5">
          <Campo
            id="editar-pieza-titulo"
            {...campo("titulo")}
            etiqueta="Titulo"
            maxLength={120}
            required
            error={errores.titulo}
          />
          <Selector
            id="editar-pieza-tipo"
            nombre="tipo"
            etiqueta="Tipo"
            opciones={tipos.map((tipo) => ({ valor: tipo, texto: NOMBRES_DE_TIPO_PIEZA[tipo] }))}
            valorInicial={pieza.tipo}
          />
          <Selector
            id="editar-pieza-responsable"
            nombre="responsableId"
            etiqueta="A cargo de la pieza"
            marcador="Sin asignar"
            opciones={[
              { valor: "", texto: "Sin asignar" },
              ...equipo.map((persona) => ({
                valor: String(persona.id),
                texto: persona.nombre,
                detalle: persona.cargo ?? undefined,
              })),
            ]}
            valorInicial={pieza.responsableId === null ? "" : String(pieza.responsableId)}
            error={errores.responsableId}
            ayuda="Ve la pieza aunque no tenga tareas en ella."
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

export function CancelarPieza({ pieza, hrefCerrar }: { pieza: Pieza; hrefCerrar: string }) {
  const [estado, enviar, enviando] = useActionState(cancelarPieza, ESTADO_INICIAL);
  useAvisoDeAccion(estado);

  const [motivo, setMotivo] = useState("");

  return (
    <form action={enviar}>
      <input type="hidden" name="piezaId" value={pieza.id} />

      <p>
        <strong className="font-semibold text-texto">{pieza.titulo}</strong> deja de
        contar para el avance del proyecto. No se borra: queda en la matriz,
        marcada, con su motivo.
      </p>

      {!estado.ok && (
        <Campo
          id="cancelar-motivo"
          name="motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          etiqueta="Por que se cancela"
          maxLength={500}
          required
          error={estado.errores?.motivo}
          className="mt-4"
        />
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-2.5">
        <BotonEnlace href={hrefCerrar} variante="fantasma" tamano="chico">
          {estado.ok ? "Cerrar" : "Volver"}
        </BotonEnlace>
        {!estado.ok && (
          <Boton type="submit" variante="peligro" tamano="chico" disabled={enviando || !motivo.trim()}>
            <Ban aria-hidden="true" />
            {enviando ? "Cancelando…" : "Cancelar pieza"}
          </Boton>
        )}
      </div>
    </form>
  );
}
