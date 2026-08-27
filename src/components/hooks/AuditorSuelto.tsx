"use client";

import { useActionState, useState } from "react";
import { Eraser, Zap } from "lucide-react";

import { auditarTexto } from "@/actions/hooks";
import { Boton, Selector } from "@/components/ui";
import { contarPalabras } from "@/lib/hooks/auditor";
import { MINIMO_PALABRAS } from "@/lib/hooks/listas";
import { ESTADO_AUDITORIA } from "@/types";
import type { Empresa } from "@/types";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";

import { ResultadoAuditoria, ResultadoNeutro } from "./ResultadoAuditoria";

/**
 * El auditor sobre un texto suelto, sin ficha.
 *
 * Es el uso que el documento senala como el de mas valor por si solo: entra
 * un texto, sale una nota explicada. No guarda nada, y por eso sirve para
 * probar cinco aperturas seguidas sin llenar el historial de basura.
 *
 * El cliente es opcional: solo decide con que limites se mide. Sin el se usa
 * el estandar de la casa, 12/6.
 */
export function AuditorSuelto({
  empresas,
  limiteVoz,
  limiteInsert,
}: {
  empresas: Empresa[];
  limiteVoz: number;
  limiteInsert: number;
}) {
  const [estado, enviar, enviando] = useActionState(auditarTexto, ESTADO_AUDITORIA);

  // El resultado sale como aviso flotante.
  useAvisoDeAccion(estado);

  const [hablado, setHablado] = useState("");
  const [insertTitulo, setInsertTitulo] = useState("");
  const [empresaId, setEmpresaId] = useState("");

  const errores = estado.errores ?? {};
  const palabras = contarPalabras(hablado);
  const palabrasInsert = contarPalabras(insertTitulo);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
      <form
        action={enviar}
        noValidate
        className="surge flex flex-col gap-5 rounded-[15px] border border-borde bg-superficie px-[26px] py-6 shadow-[var(--sombra)]"
      >
        <input type="hidden" name="empresaId" value={empresaId} />

        <Selector
          id="suelto-empresa"
          nombre="_empresaId"
          etiqueta="Cliente"
          marcador="Estandar de agencia (12/6)"
          valorInicial={empresaId}
          onCambio={setEmpresaId}
          opciones={empresas.map((e) => ({
            valor: String(e.id),
            texto: e.nombre,
            detalle: e.sector ?? undefined,
          }))}
          ayuda="Solo decide con que limites se mide. Sin cliente se usa el estandar de la casa."
        />

        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
            <label htmlFor="suelto-hablado" className="text-xs font-semibold">
              Hook hablado
            </label>
            <span className="text-[11.5px] font-medium text-suave">
              <b className="font-bold text-acento">{palabras}</b> palabras · minimo{" "}
              {MINIMO_PALABRAS}, recomendado 7&ndash;{limiteVoz}
            </span>
          </div>

          <textarea
            id="suelto-hablado"
            name="hablado"
            value={hablado}
            onChange={(e) => setHablado(e.target.value)}
            rows={4}
            maxLength={400}
            placeholder="Pega o escribe el hook que quieres revisar."
            className={[
              "suave w-full rounded-xl border-[1.5px] border-borde bg-campo px-3.5 py-3",
              "text-[15px] leading-relaxed text-texto placeholder:text-suave",
              "focus:border-acento focus:bg-superficie focus:shadow-[var(--foco)] focus:outline-none",
              errores.hablado ? "border-blackberry" : "",
            ].join(" ")}
          />

          {errores.hablado && (
            <p role="alert" className="mt-1.5 text-[11.5px] font-medium text-blackberry dark-tema:text-[#e9a9cd]">
              {errores.hablado}
            </p>
          )}
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
            <label htmlFor="suelto-insert" className="text-xs font-semibold">
              Insert-Titulo{" "}
              <span className="font-normal text-suave">(opcional)</span>
            </label>
            <span className="text-[11.5px] font-medium text-suave">
              <b className="font-bold text-acento">{palabrasInsert}</b> palabras ·
              maximo {limiteInsert}
            </span>
          </div>

          <input
            id="suelto-insert"
            name="insertTitulo"
            value={insertTitulo}
            onChange={(e) => setInsertTitulo(e.target.value)}
            maxLength={160}
            placeholder="El nucleo de la promesa"
            className="suave min-h-11 w-full rounded-xl border-[1.5px] border-borde bg-campo px-3.5 py-3 text-[13.5px] text-texto placeholder:text-suave focus:border-acento focus:bg-superficie focus:shadow-[var(--foco)] focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-2.5 pt-1">
          <Boton type="submit" disabled={enviando}>
            <Zap aria-hidden="true" />
            {enviando ? "Auditando…" : "Auditar hook"}
          </Boton>

          <Boton
            type="button"
            variante="fantasma"
            onClick={() => {
              setHablado("");
              setInsertTitulo("");
            }}
          >
            <Eraser aria-hidden="true" />
            Limpiar
          </Boton>
        </div>
      </form>

      <div className="surge [--retraso:0.06s]">
        {estado.resultado ? (
          <ResultadoAuditoria resultado={estado.resultado} />
        ) : (
          <ResultadoNeutro />
        )}
      </div>
    </div>
  );
}
