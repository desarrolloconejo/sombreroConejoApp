"use client";

import { useActionState, useState } from "react";
import { Save } from "lucide-react";

import { guardarDatosFiscales } from "@/actions/ajustesFinanzas";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { Boton, CLASE_CONTROL } from "@/components/ui";
import { ESTADO_INICIAL, type DatosFiscalesEmpresa } from "@/types";

/**
 * Por empresa: si es agente de retencion de IVA (y cuanto retiene) y sus dias
 * de credito. Cada fila es su propio formulario y no desaparece al guardar.
 */

function FilaFiscal({ empresa, diasPorDefecto }: { empresa: DatosFiscalesEmpresa; diasPorDefecto: number }) {
  const [estado, enviar, enviando] = useActionState(guardarDatosFiscales, ESTADO_INICIAL);
  useAvisoDeAccion(estado);
  const [retencion, setRetencion] = useState(String(empresa.retencionIvaPct ?? "no"));
  const [dias, setDias] = useState(empresa.diasCredito === null ? "" : String(empresa.diasCredito));
  const error = estado.errores?.diasCredito;

  return (
    <li className="border-b border-borde py-3 last:border-0">
      <form action={enviar} noValidate className="grid grid-cols-[minmax(0,1fr)] items-end gap-3 sm:grid-cols-[minmax(0,1fr)_170px_120px_auto]">
        <input type="hidden" name="id" value={empresa.id} />
        <div className="min-w-0 self-center">
          <p className="truncate text-[14px] font-bold">{empresa.nombre}</p>
          <p className="text-[12px] text-suave">{empresa.rif ?? "Sin RIF en su ficha"}</p>
        </div>
        <label>
          <span className="mb-1.5 block text-xs font-semibold">Retencion de IVA</span>
          <select
            name="retencion"
            value={retencion}
            onChange={(e) => setRetencion(e.target.value)}
            aria-label={`Retencion de IVA de ${empresa.nombre}`}
            className={CLASE_CONTROL}
          >
            <option value="no">No retiene</option>
            <option value="75">Retiene el 75 %</option>
            <option value="100">Retiene el 100 %</option>
          </select>
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-semibold">Dias de credito</span>
          <input
            name="diasCredito"
            inputMode="numeric"
            value={dias}
            placeholder={String(diasPorDefecto)}
            onChange={(e) => setDias(e.target.value)}
            aria-label={`Dias de credito de ${empresa.nombre}`}
            aria-invalid={error ? true : undefined}
            className={CLASE_CONTROL}
          />
        </label>
        <Boton
          type="submit"
          variante="fantasma"
          tamano="chico"
          disabled={enviando}
          aria-label={`Guardar los datos de facturacion de ${empresa.nombre}`}
        >
          <Save aria-hidden="true" />
          Guardar
        </Boton>
        {error && (
          <p role="alert" className="text-[12px] font-medium text-blackberry dark-tema:text-acento sm:col-span-4">
            {error}
          </p>
        )}
      </form>
    </li>
  );
}

export function DatosFiscales({
  empresas,
  diasPorDefecto,
}: {
  empresas: DatosFiscalesEmpresa[];
  diasPorDefecto: number;
}) {
  if (empresas.length === 0) return <p className="text-[13px] text-suave">No hay empresas activas.</p>;

  return (
    <ul aria-label="Datos de facturacion de las empresas" className="-my-1 flex flex-col">
      {empresas.map((empresa) => (
        <FilaFiscal key={empresa.id} empresa={empresa} diasPorDefecto={diasPorDefecto} />
      ))}
    </ul>
  );
}
