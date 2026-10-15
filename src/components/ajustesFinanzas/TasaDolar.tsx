"use client";

import { useActionState, useState } from "react";
import { Save } from "lucide-react";

import { registrarTasa } from "@/actions/tasas";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { Boton, Campo } from "@/components/ui";
import { ESTADO_INICIAL, type TasaDeCambio } from "@/types";

/**
 * La tasa del dolar del BCV: las ultimas, de donde salio cada una, y el
 * formulario para registrarla a mano cuando la lectura diaria falla.
 */

function legible(valor: string): string {
  const [entera, fraccion = ""] = valor.split(".");
  return `${entera.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${fraccion.replace(/0+$/, "").padEnd(2, "0")}`;
}

function dia(fecha: string): string {
  const [ano, mes, numero] = fecha.split("-");
  return `${numero}/${mes}/${ano}`;
}

export function TasaDolar({ recientes, hoy }: { recientes: TasaDeCambio[]; hoy: string }) {
  const [estado, enviar, enviando] = useActionState(registrarTasa, ESTADO_INICIAL);
  useAvisoDeAccion(estado);
  const [fecha, setFecha] = useState(hoy);
  const [valor, setValor] = useState("");
  const [confirmo, setConfirmo] = useState(false);
  const errores = estado.errores ?? {};

  // Al guardar bien, el formulario queda limpio para la proxima.
  const [visto, setVisto] = useState(estado);
  if (estado !== visto) {
    setVisto(estado);
    if (estado.ok) {
      setValor("");
      setConfirmo(false);
    }
  }

  const vigente = recientes[0];
  const deHoy = vigente?.fechaValor === hoy;

  return (
    <div className="flex flex-col gap-5">
      {vigente ? (
        <div>
          <p className="text-[12px] font-semibold text-suave">La que se usa al facturar hoy</p>
          <p className="mt-1 text-[20px] font-extrabold tabular-nums tracking-[-0.02em]">
            Bs. {legible(vigente.valor)} <span className="text-[13px] font-semibold text-suave">por dolar</span>
          </p>
          <p className="text-[12px] text-suave">
            Del {dia(vigente.fechaValor)} · {vigente.origen === "manual" ? "registrada a mano" : "leida del BCV"}
            {deHoy ? "" : " · no hay una de hoy: se usa la ultima publicada"}
          </p>
        </div>
      ) : (
        <p role="status" className="rounded-xl bg-acento-tenue px-3.5 py-3 text-[13px]">
          No hay ninguna tasa registrada: no se puede facturar hasta tener una.
        </p>
      )}

      <form action={enviar} noValidate className="grid grid-cols-[minmax(0,1fr)] gap-3 border-t border-borde pt-4 sm:grid-cols-2">
        <p className="text-[14px] font-bold sm:col-span-2">Registrar a mano</p>
        <Campo
          id="tasa-fecha"
          etiqueta="Fecha de la tasa"
          name="fechaValor"
          type="date"
          max={hoy}
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          error={errores.fechaValor}
        />
        <Campo
          id="tasa-valor"
          etiqueta="Bolivares por dolar"
          name="valor"
          inputMode="decimal"
          placeholder="40,5012"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          error={errores.valor}
        />
        {errores.confirmoSalto && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-acento-tenue px-3.5 py-3 text-[13px] sm:col-span-2">
            <input
              type="checkbox"
              name="confirmoSalto"
              value="si"
              checked={confirmo}
              onChange={(e) => setConfirmo(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[var(--acento)]"
            />
            <span role="alert">{errores.confirmoSalto}</span>
          </label>
        )}
        <p className="text-[12px] leading-relaxed text-suave sm:col-span-2">
          Una fecha que ya tiene tasa no se cambia: queda como historico, y las facturas emitidas guardan la suya.
        </p>
        <div className="flex justify-end sm:col-span-2">
          <Boton type="submit" variante="fantasma" disabled={enviando}>
            <Save aria-hidden="true" />
            {enviando ? "Guardando..." : "Registrar la tasa"}
          </Boton>
        </div>
      </form>

      {recientes.length > 0 && (
        <div className="border-t border-borde pt-4">
          <p className="mb-2 text-[12px] font-semibold text-suave">Ultimas tasas</p>
          <ul aria-label="Ultimas tasas del dolar" className="flex flex-col text-[13px]">
            {recientes.map((tasa) => (
              <li key={tasa.id} className="flex justify-between gap-4 border-b border-borde/70 py-1.5 last:border-0">
                <span>{dia(tasa.fechaValor)}</span>
                <span className="tabular-nums">
                  Bs. {legible(tasa.valor)}
                  <span className="ml-2 text-[11.5px] text-suave">{tasa.origen === "manual" ? "a mano" : "BCV"}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
