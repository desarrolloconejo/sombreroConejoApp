"use client";

import { Save, Send } from "lucide-react";

import { EditorRenglones } from "@/components/finanzas/EditorRenglones";
import { Boton, Campo, CampoFecha, Selector, useCampos } from "@/components/ui";
import type { Presupuesto, ProyectoDeProforma, Renglon } from "@/types";
import { useGuardado } from "./ProveedorGuardado";

/**
 * El editor de un presupuesto en borrador: su cabecera y sus renglones, en un
 * solo formulario.
 *
 * Dos botones: guardar, o guardar y enviar. Enviar siempre guarda antes, en la
 * misma transaccion: lo que recibe el cliente es exactamente lo que hay en
 * pantalla, sin un «olvide guardar» de por medio.
 *
 * El estado de la action lo lleva `ProveedorGuardado`, por encima: al
 * enviar, este editor desaparece y el aviso no debe irse con el.
 */
export function EditorPresupuesto({
  presupuesto,
  renglones,
  proyectos,
}: {
  presupuesto: Presupuesto;
  renglones: Renglon[];
  proyectos: ProyectoDeProforma[];
}) {
  const [estado, enviar, enviando] = useGuardado();

  const errores = estado.errores ?? {};

  const { campo, fecha } = useCampos({
    titulo: presupuesto.titulo,
    validoHasta: presupuesto.validoHasta,
    notas: presupuesto.notas ?? "",
  });

  return (
    <form action={enviar} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="id" value={presupuesto.id} />

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Campo
          id="editor-titulo"
          etiqueta="Titulo"
          maxLength={120}
          error={errores.titulo}
          className="sm:col-span-2"
          {...campo("titulo")}
        />
        <CampoFecha
          id="editor-validez"
          etiqueta="Vale hasta"
          error={errores.validoHasta}
          {...fecha("validoHasta")}
        />
        <Selector
          id="editor-proyecto"
          nombre="proyectoId"
          etiqueta="Proyecto (opcional)"
          opciones={[
            { valor: "", texto: "Sin proyecto" },
            ...proyectos.map((p) => ({ valor: String(p.id), texto: p.nombre })),
          ]}
          valorInicial={presupuesto.proyectoId === null ? "" : String(presupuesto.proyectoId)}
          error={errores.proyectoId}
        />
        <Campo
          id="editor-notas"
          etiqueta="Notas para el cliente"
          opcional
          maxLength={1000}
          className="sm:col-span-2"
          {...campo("notas")}
        />
      </div>

      <div>
        <h3 className="mb-3 text-[15px] font-bold tracking-[-0.01em]">Renglones</h3>
        <EditorRenglones iniciales={renglones} ivaPct={presupuesto.ivaPct} error={errores.renglones} />
      </div>

      <div className="flex flex-wrap justify-end gap-2.5 border-t border-borde pt-4">
        <Boton type="submit" variante="fantasma" disabled={enviando}>
          <Save aria-hidden="true" />
          Guardar borrador
        </Boton>
        <Boton type="submit" name="enviar" value="si" disabled={enviando}>
          <Send aria-hidden="true" />
          {enviando ? "Guardando..." : "Guardar y enviar al cliente"}
        </Boton>
      </div>
    </form>
  );
}
