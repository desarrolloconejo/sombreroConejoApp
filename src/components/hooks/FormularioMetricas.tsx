"use client";

import { useActionState, useState } from "react";
import { CircleAlert, CircleCheck, Save } from "lucide-react";

import { guardarResultados } from "@/actions/hooksDocumentacion";
import { Alerta, Boton, Campo, Selector } from "@/components/ui";
import { metricaDe, objetivoDe } from "@/lib/hooks/catalogo";
import { ESTADO_INICIAL } from "@/types";
import type { FichaConResultado } from "@/types";

/**
 * El registro de metricas: el final del recorrido.
 *
 * Es de cliente porque el diagnostico de hook rate se calcula mientras se
 * teclea. Ver la tasa antes de guardar es lo que hace que alguien note que
 * cruzo dos campos, y esa es la equivocacion mas comun al copiar cifras de
 * un panel de analitica.
 */

/** Las bandas del documento. La banda en la que cae la pieza se resalta. */
const BANDAS = [
  { hasta: 15, nombre: "Matar", lectura: "La apertura no esta parando el scroll. Cambia fotograma y primer segundo." },
  { hasta: 20, nombre: "Arreglar apertura", lectura: "Prueba tres aperturas nuevas sobre el mismo cuerpo." },
  { hasta: 30, nombre: "Sano", lectura: "Mira el hold rate: si cae, el problema ya no es el hook." },
  { hasta: 35, nombre: "Bueno", lectura: "Anota territorio y mecanismo: puede ser un estandar del cliente." },
  { hasta: Infinity, nombre: "Elite", lectura: "Genera variantes del mismo territorio antes de que fatigue." },
] as const;

/** Volumen por debajo del cual la cifra es ruido, no veredicto. */
const VOLUMEN_MINIMO = 2000;

function aNumero(texto: string): number {
  const limpio = texto.replace(/[.\s]/g, "").replace(",", ".");
  const numero = Number(limpio);
  return Number.isFinite(numero) && numero > 0 ? Math.trunc(numero) : 0;
}

export function FormularioMetricas({ fichas }: { fichas: FichaConResultado[] }) {
  const [estado, enviar, enviando] = useActionState(guardarResultados, ESTADO_INICIAL);

  const [fichaId, setFichaId] = useState("");
  const [impresiones, setImpresiones] = useState("");
  const [vistas, setVistas] = useState("");

  const errores = estado.errores ?? {};
  const ficha = fichas.find((f) => String(f.id) === fichaId) ?? null;

  const imp = aNumero(impresiones);
  const vis = aNumero(vistas);
  const tasa = imp > 0 ? (vis * 100) / imp : null;
  const banda = tasa === null ? null : BANDAS.find((b) => tasa < b.hasta) ?? BANDAS[4];
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
          {estado.mensaje && (
            <Alerta
              tono={estado.ok ? "info" : "aviso"}
              icono={estado.ok ? <CircleCheck /> : <CircleAlert />}
              className="mb-5"
            >
              {estado.mensaje}
            </Alerta>
          )}

          <div className="mb-5 rounded-xl border border-[#d77474] bg-[#fff2f1] px-4 py-3.5 text-[12.5px] leading-relaxed text-[#7f2b2b] dark-tema:bg-[rgb(215_116_116/0.12)] dark-tema:text-[#f0b8b8]">
            La lectura organica es direccional; no conviertas pequenas
            diferencias en certezas.
          </div>

          <div className="grid gap-3.5 sm:grid-cols-3">
            <Campo
              id="metricas-impresiones"
              name="impresiones"
              etiqueta="Impresiones"
              inputMode="numeric"
              placeholder="0"
              value={impresiones}
              onChange={(e) => setImpresiones(e.target.value)}
            />

            <Campo
              id="metricas-vistas"
              name="vistas3s"
              etiqueta="Vistas 3 s"
              inputMode="numeric"
              placeholder="0"
              value={vistas}
              onChange={(e) => setVistas(e.target.value)}
              error={
                cruzados
                  ? "Hay mas vistas que impresiones. Revisa si se cruzaron los dos campos."
                  : errores.vistas3s
              }
            />

            {/*
              LOS ROTULOS SON FIJOS, Y ESO ES EL ARREGLO.
              Antes este primer campo tomaba su etiqueta de la metrica del
              objetivo de la ficha. Con objetivo "compartidos" ponia
              "Compartidos" —duplicando el campo siguiente— y escribia en la
              columna `guardados`; con "consideracion" ponia "Clics" y pasaba lo
              mismo. Habia datos guardados en la columna equivocada.

              Cual es la metrica que manda se dice arriba, en el resumen de la
              ficha, que es donde no puede confundirse con el nombre de un
              campo.
            */}
            <Campo
              id="metricas-me-gusta"
              name="meGusta"
              etiqueta="Me gusta"
              inputMode="numeric"
              placeholder="0"
            />

            <Campo
              id="metricas-compartidos"
              name="compartidos"
              etiqueta="Compartidos"
              inputMode="numeric"
              placeholder="0"
            />

            <Campo id="metricas-clics" name="clics" etiqueta="Clics" inputMode="numeric" placeholder="0" />

            <Campo
              id="metricas-guardados"
              name="guardados"
              etiqueta="Guardados"
              inputMode="numeric"
              placeholder="0"
            />
          </div>

          <div className="mt-[18px]">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
              <label htmlFor="metricas-aprendizaje" className="text-xs font-semibold">
                Aprendizaje de la pieza
              </label>
              <span className="text-[11.5px] font-medium text-suave">
                Lo que importa mas que el numero.
              </span>
            </div>
            <textarea
              id="metricas-aprendizaje"
              name="aprendizaje"
              rows={3}
              maxLength={600}
              placeholder="Que mecanismo repetir la proxima vez, y cual no."
              className="suave w-full rounded-xl border-[1.5px] border-borde bg-campo px-3.5 py-3 text-[13.5px] leading-relaxed text-texto placeholder:text-suave focus:border-acento focus:bg-superficie focus:shadow-[var(--foco)] focus:outline-none"
            />
          </div>

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
      <div className="surge rounded-[15px] border border-nav-borde bg-navy p-[22px] text-white [--retraso:0.06s]">
        <p className="mb-4 text-[10.5px] font-bold tracking-[0.1em] text-white/50 uppercase">
          Diagnostico de hook rate · Meta / trafico frio
        </p>

        <div className="py-1.5 pb-[18px] text-center">
          <div className="text-5xl leading-none font-extrabold tracking-[-0.04em] text-gold">
            {tasa === null ? "—" : `${tasa.toFixed(1).replace(".", ",")}%`}
          </div>
          <p className="mt-3 text-[11.5px] text-white/60">
            {tasa === null
              ? "Introduce impresiones y vistas a 3 segundos."
              : `${vis.toLocaleString("es-VE")} vistas de 3 s sobre ${imp.toLocaleString("es-VE")} impresiones`}
          </p>
        </div>

        <div>
          {BANDAS.map((b, i) => {
            const activa = banda === b;
            const rango =
              i === 0 ? "< 15%" : b.hasta === Infinity ? "≥ 35%" : `${BANDAS[i - 1]!.hasta}–${b.hasta}%`;

            return (
              <div
                key={b.nombre}
                className={[
                  "grid grid-cols-[86px_minmax(0,1fr)] items-center gap-4 border-b border-white/10 py-[11px] last:border-b-0",
                  activa ? "-mx-3 rounded-[10px] bg-white/[0.06] px-3" : "",
                ].join(" ")}
              >
                <b className={["text-[12.5px] font-bold", activa ? "text-gold" : ""].join(" ")}>
                  {rango}
                </b>
                <span className="text-[11.5px] leading-relaxed text-white/60">
                  <b className={activa ? "text-white" : ""}>{b.nombre}.</b> {b.lectura}
                </span>
              </div>
            );
          })}
        </div>

        {/*
          Por debajo del volumen minimo la cifra no significa nada, y decirlo
          antes de guardar evita que una pieza con 300 impresiones acabe
          citada en una reunion como si fuera un resultado.
        */}
        {tasa !== null && imp < VOLUMEN_MINIMO && (
          <p className="mt-4 rounded-xl border border-gold/25 bg-gold/12 px-3.5 py-2.5 text-[11.5px] leading-relaxed">
            Con menos de {VOLUMEN_MINIMO.toLocaleString("es-VE")} impresiones la
            cifra puede ser ruido. Guardala igual, pero no la defiendas todavia.
          </p>
        )}

        <p className="mt-4 rounded-xl border border-[#d77474] bg-[rgb(215_116_116/0.12)] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-[#f0b8b8]">
          <b>Aviso sobre estas cifras.</b> Ninguna plataforma publica umbrales
          oficiales de hook rate. Las bandas vienen de proveedores de analitica
          con sesgo de cartera; despues del primer mes, la referencia util es el
          historico de tu cuenta.
        </p>
      </div>
    </div>
  );
}
