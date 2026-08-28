"use client";

import { useActionState, useState } from "react";
import { Pencil, Save } from "lucide-react";

import { guardarResultados } from "@/actions/hooksDocumentacion";
import { PanelCuerpo, PanelPie, SeparadorPanel } from "@/components/listado";
import { Boton, BotonEnlace } from "@/components/ui";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { metricaDe, objetivoDe } from "@/lib/hooks/catalogo";
import { ESTADO_INICIAL } from "@/types";
import type { FichaHook } from "@/types";

import { aNumero, CamposMetricas, DiagnosticoHookRate } from "./CamposMetricas";

/**
 * Registrar las metricas de UNA pieza concreta, sin salir del auditor.
 *
 * POR QUE NO SE REUTILIZA EL MODULO DE METRICAS
 * ---------------------------------------------
 * Aquel empieza eligiendo la ficha en un desplegable, y eso esta bien cuando
 * se entra a cerrar lo que haya pendiente. Pero llegando desde el auditor la
 * pieza ya esta decidida: mandar alli obligaria a buscar en una lista la misma
 * que se acaba de auditar, y a soltar el hilo justo cuando se tenia delante.
 *
 * Aqui la ficha viene fija y no se puede cambiar, y eso es lo que convierte
 * esto en el paso siguiente de una conversacion y no en otro formulario.
 *
 * Los campos y el diagnostico salen de `CamposMetricas`, compartidos con el
 * modulo: la lista de metricas existe en un solo sitio a proposito.
 */
export function PanelMetricasFicha({
  ficha,
  hrefCorregir,
  hrefCerrar,
}: {
  ficha: FichaHook;
  /** Volver al canvas a arreglar la pieza antes de medirla. */
  hrefCorregir: string;
  hrefCerrar: string;
}) {
  const [estado, enviar, enviando] = useActionState(guardarResultados, ESTADO_INICIAL);

  // Como en el resto de paneles: el resultado sale como aviso flotante y el
  // panel se queda abierto. Registrar dos veces actualiza, no duplica.
  useAvisoDeAccion(estado);

  const [impresiones, setImpresiones] = useState("");
  const [vistas, setVistas] = useState("");

  const imp = aNumero(impresiones);
  const vis = aNumero(vistas);
  const cruzados = vis > imp;

  return (
    <form action={enviar} noValidate className="flex min-h-0 flex-1 flex-col">
      {/* La ficha va fija: llegar hasta aqui ya es haberla elegido. */}
      <input type="hidden" name="fichaId" value={ficha.id} />

      <PanelCuerpo>
        <div className="rounded-xl bg-campo px-4 py-3.5">
          <p className="text-[13.5px] leading-snug font-semibold">
            &laquo;{ficha.hablado}&raquo;
          </p>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-suave">
            {ficha.empresaNombre !== null && `${ficha.empresaNombre} · `}
            {objetivoDe(ficha.objetivo).nombre} · se lee con{" "}
            {metricaDe(ficha.objetivo).toLowerCase()}
            {ficha.notaAuditor !== null && ` · auditada con ${ficha.notaAuditor}`}
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-[#d77474] bg-[#fff2f1] px-4 py-3 text-[12px] leading-relaxed text-[#7f2b2b] dark-tema:bg-[rgb(215_116_116/0.12)] dark-tema:text-[#f0b8b8]">
          La lectura organica es direccional; no conviertas pequenas diferencias
          en certezas.
        </div>

        <SeparadorPanel>Lo que paso</SeparadorPanel>

        <CamposMetricas
          prefijo="panel-metricas"
          impresiones={impresiones}
          alCambiarImpresiones={setImpresiones}
          vistas={vistas}
          alCambiarVistas={setVistas}
          cruzados={cruzados}
          errorVistas={estado.errores?.vistas3s}
        />

        <div className="mt-[18px]">
          <DiagnosticoHookRate impresiones={imp} vistas={vis} compacto />
        </div>
      </PanelCuerpo>

      <PanelPie>
        {/* Cancelar esta en todos los paneles del proyecto: el aspa de la
            cabecera es la misma salida, pero no todo el mundo la busca ahi. */}
        <BotonEnlace href={hrefCerrar} variante="fantasma" scroll={false}>
          Cancelar
        </BotonEnlace>

        {/*
          Corregir tambien vive aqui. Al escribir las cifras es cuando se ve que
          la pieza no funciono, y en ese momento lo que se quiere es volver a
          escribirla — no cerrar el panel, buscar la ficha y entrar otra vez.
        */}
        <BotonEnlace href={hrefCorregir} variante="fantasma" scroll={false}>
          <Pencil aria-hidden="true" />
          Corregir
        </BotonEnlace>

        <Boton type="submit" disabled={enviando || cruzados}>
          {enviando ? "Guardando…" : "Guardar resultados"}
          {!enviando && <Save aria-hidden="true" />}
        </Boton>
      </PanelPie>
    </form>
  );
}
