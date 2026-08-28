"use client";

import { useActionState, useState } from "react";
import { Save } from "lucide-react";

import { guardarResultados } from "@/actions/hooksDocumentacion";
import { Boton, Selector } from "@/components/ui";
import { metricaDe, objetivoDe } from "@/lib/hooks/catalogo";
import { ESTADO_INICIAL } from "@/types";
import type { FichaConResultado } from "@/types";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";

import { aNumero, CamposMetricas, DiagnosticoHookRate } from "./CamposMetricas";

/**
 * El registro de metricas: el final del recorrido.
 *
 * Es de cliente porque el diagnostico de hook rate se calcula mientras se
 * teclea. Ver la tasa antes de guardar es lo que hace que alguien note que
 * cruzo dos campos, y esa es la equivocacion mas comun al copiar cifras de
 * un panel de analitica.
 *
 * Los campos y el diagnostico viven en `CamposMetricas`, compartidos con el
 * panel del auditor. Este formulario aporta lo suyo: elegir la ficha.
 */
export function FormularioMetricas({
  fichas,
  fichaInicial = "",
  guardadas = [],
}: {
  fichas: FichaConResultado[];

  /**
   * Que fichas ya estan en el banco de referencias.
   *
   * Llega resuelto desde la page, como arreglo y no como Set porque cruza la
   * frontera de servidor a cliente y un Set no viaja por ahi.
   */
  guardadas?: number[];

  /**
   * La ficha que llega ya elegida desde la lista de pendientes.
   *
   * Viaja por la URL y no por estado compartido porque la lista es de
   * servidor: asi el enlace "Registrar" de una fila deja el formulario listo
   * para escribir cifras, en lugar de obligar a buscarla otra vez en el
   * desplegable.
   */
  fichaInicial?: string;
}) {
  const [estado, enviar, enviando] = useActionState(guardarResultados, ESTADO_INICIAL);

  // El resultado sale como aviso flotante: en un formulario largo, una alerta
  // arriba queda fuera de la vista de quien acaba de pulsar el boton.
  useAvisoDeAccion(estado);

  const [fichaId, setFichaId] = useState(fichaInicial);
  const [impresiones, setImpresiones] = useState("");
  const [vistas, setVistas] = useState("");

  const ficha = fichas.find((f) => String(f.id) === fichaId) ?? null;

  const imp = aNumero(impresiones);
  const vis = aNumero(vistas);
  const cruzados = vis > imp;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
      <form
        action={enviar}
        noValidate
        className="surge overflow-hidden rounded-[15px] border border-borde bg-superficie shadow-[var(--sombra)]"
      >
        <input type="hidden" name="fichaId" value={fichaId} />

        <div className="border-b border-borde px-[22px] py-[18px]">
          <Selector
            id="metricas-ficha"
            nombre="_fichaId"
            etiqueta="Ficha que se mide"
            marcador="Elige una ficha publicada"
            requerido
            valorInicial={fichaId}
            onCambio={setFichaId}
            opciones={fichas.map((f) => ({
              valor: String(f.id),
              texto: f.hablado.length > 58 ? `${f.hablado.slice(0, 58)}…` : f.hablado,
              detalle: `${f.empresaNombre} · ${objetivoDe(f.objetivo).nombre}`,
            }))}
            ayuda={
              ficha
                ? `Objetivo ${objetivoDe(ficha.objetivo).nombre} · se lee con ${metricaDe(ficha.objetivo)}${ficha.notaAuditor !== null ? ` · auditada con ${ficha.notaAuditor}` : ""}.`
                : "Solo aparecen las fichas que aun no tienen resultado registrado."
            }
          />
        </div>

        <div className="px-[22px] py-[22px]">
          <div className="mb-5 rounded-xl border border-[#d77474] bg-[#fff2f1] px-4 py-3.5 text-[12.5px] leading-relaxed text-[#7f2b2b] dark-tema:bg-[rgb(215_116_116/0.12)] dark-tema:text-[#f0b8b8]">
            La lectura organica es direccional; no conviertas pequenas
            diferencias en certezas.
          </div>

          <CamposMetricas
            prefijo="metricas"
            impresiones={impresiones}
            alCambiarImpresiones={setImpresiones}
            vistas={vistas}
            alCambiarVistas={setVistas}
            cruzados={cruzados}
            errorVistas={estado.errores?.vistas3s}
            errorTerritorio={estado.errores?.territorioReferencia}
            errorAprendizaje={estado.errores?.aprendizaje}
            banco={
              ficha
                ? {
                    yaGuardada: guardadas.includes(ficha.id),
                    territorioSugerido:
                      objetivoDe(ficha.objetivo).territorios[0] ?? "",
                  }
                : null
            }
          />

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <Boton type="submit" disabled={enviando || !fichaId || cruzados}>
              <Save aria-hidden="true" />
              {enviando ? "Guardando…" : "Guardar resultados"}
            </Boton>
            <p className="text-[11.5px] font-medium text-suave">
              Registrar dos veces la misma ficha actualiza, no duplica.
            </p>
          </div>
        </div>
      </form>

      {/* ================= el diagnostico, en vivo ================= */}
      <div className="surge [--retraso:0.06s]">
        <DiagnosticoHookRate impresiones={imp} vistas={vis} />
      </div>
    </div>
  );
}
