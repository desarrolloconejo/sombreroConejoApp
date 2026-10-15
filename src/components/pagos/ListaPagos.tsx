"use client";

import { createContext, useActionState, useContext, useState, type ReactNode } from "react";
import { Check, FileText, X } from "lucide-react";

import { confirmarPago, rechazarPago } from "@/actions/pagos";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { Boton, Campo, CLASE_CONTROL } from "@/components/ui";
import { bolivares, dolares } from "@/lib/finanzas/documentos";
import { aBolivares } from "@/lib/finanzas/pagos";
import { ZONA_HORARIA } from "@/lib/fechas";
import {
  ESTADO_INICIAL,
  NOMBRES_DE_ESTADO_PAGO,
  NOMBRES_DE_TIPO_PAGO,
  type EstadoFormulario,
  type Pago,
} from "@/types";

/**
 * Los pagos y retenciones de una factura. Para el cliente, solo lectura; para
 * quien opera finanzas, cada uno por confirmar se confirma (con el monto que
 * se aplica) o se rechaza (con motivo). Al resolverlo, su formulario
 * desaparece: el estado de las dos actions vive en la lista.
 */

type Accion = [EstadoFormulario, (datos: FormData) => void, boolean];

const ContextoPagos = createContext<{ confirmar: Accion; rechazar: Accion } | null>(null);

const DIA = new Intl.DateTimeFormat("es-VE", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
const MOMENTO = new Intl.DateTimeFormat("es-VE", {
  timeZone: ZONA_HORARIA,
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

function monto(pago: Pago): string {
  return pago.moneda === "USD" ? dolares(pago.monto) : bolivares(pago.monto);
}

function Resolver({ pago, tasaSugerida }: { pago: Pago; tasaSugerida: string }) {
  const acciones = useContext(ContextoPagos);
  if (!acciones) throw new Error("Va dentro de ListaPagos");
  const { confirmar, rechazar } = acciones;

  const [modo, setModo] = useState<"confirmar" | "rechazar" | null>(null);
  const [tasa, setTasa] = useState(tasaSugerida);
  const [aplicado, setAplicado] = useState(pago.moneda === "USD" ? (aBolivares(pago.monto, tasaSugerida) ?? "") : pago.monto);
  const [motivo, setMotivo] = useState("");
  const ocupado = confirmar[2] || rechazar[2];

  if (modo === "confirmar") {
    const errores = confirmar[0].errores ?? {};
    return (
      <form action={confirmar[1]} noValidate className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
        <input type="hidden" name="id" value={pago.id} />
        {pago.moneda === "USD" && (
          <Campo
            id={`pago-${pago.id}-tasa`}
            etiqueta="Tasa usada (Bs por dolar)"
            name="tasaAplicada"
            inputMode="decimal"
            value={tasa}
            onChange={(e) => {
              setTasa(e.target.value);
              const sugerido = aBolivares(pago.monto, e.target.value);
              if (sugerido) setAplicado(sugerido);
            }}
            error={errores.tasaAplicada}
          />
        )}
        <Campo
          id={`pago-${pago.id}-aplicado`}
          etiqueta="Monto que se aplica (Bs)"
          name="montoAplicado"
          inputMode="decimal"
          value={aplicado}
          onChange={(e) => setAplicado(e.target.value)}
          error={errores.montoAplicado}
        />
        <div className="flex justify-end gap-2.5 sm:col-span-2">
          <Boton type="button" variante="fantasma" tamano="chico" onClick={() => setModo(null)}>
            Volver
          </Boton>
          <Boton type="submit" tamano="chico" disabled={ocupado}>
            <Check aria-hidden="true" />
            Confirmar
          </Boton>
        </div>
      </form>
    );
  }

  if (modo === "rechazar") {
    const error = rechazar[0].errores?.motivo;
    return (
      <form action={rechazar[1]} noValidate className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="id" value={pago.id} />
        <label>
          <span className="mb-2 block text-xs font-semibold">Por que se rechaza</span>
          <textarea
            name="motivo"
            rows={2}
            maxLength={500}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            aria-invalid={error ? true : undefined}
            className={`${CLASE_CONTROL} min-h-[64px] py-2.5`}
          />
          {error && (
            <span role="alert" className="mt-1.5 block text-[12px] text-blackberry dark-tema:text-acento">
              {error}
            </span>
          )}
        </label>
        <div className="flex justify-end gap-2.5">
          <Boton type="button" variante="fantasma" tamano="chico" onClick={() => setModo(null)}>
            Volver
          </Boton>
          <Boton type="submit" variante="peligro" tamano="chico" disabled={ocupado}>
            <X aria-hidden="true" />
            Rechazar
          </Boton>
        </div>
      </form>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2.5">
      <Boton type="button" tamano="chico" onClick={() => setModo("confirmar")} aria-label={`Confirmar el pago ${pago.id}`}>
        <Check aria-hidden="true" />
        Confirmar
      </Boton>
      <Boton
        type="button"
        variante="fantasma"
        tamano="chico"
        onClick={() => setModo("rechazar")}
        aria-label={`Rechazar el pago ${pago.id}`}
      >
        <X aria-hidden="true" />
        Rechazar
      </Boton>
    </div>
  );
}

function ProveedorPagos({ children }: { children: ReactNode }) {
  const confirmar = useActionState(confirmarPago, ESTADO_INICIAL);
  const rechazar = useActionState(rechazarPago, ESTADO_INICIAL);
  useAvisoDeAccion(confirmar[0]);
  useAvisoDeAccion(rechazar[0]);
  return <ContextoPagos.Provider value={{ confirmar, rechazar }}>{children}</ContextoPagos.Provider>;
}

export function ListaPagos({
  pagos,
  operador,
  tasaSugerida = "",
  vacio,
}: {
  pagos: Pago[];
  /** Si quien mira opera finanzas: entonces puede resolverlos. */
  operador: boolean;
  /** La tasa con la que se sugiere convertir un pago en dolares. */
  tasaSugerida?: string;
  vacio: string;
}) {
  if (pagos.length === 0) return <p className="text-[13px] text-suave">{vacio}</p>;

  const lista = (
    <ul aria-label="Pagos y retenciones" className="-my-1 flex flex-col">
      {pagos.map((pago) => (
        <li key={pago.id} className="border-b border-borde py-3 last:border-0">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <div className="min-w-0">
              <p className="text-[13.5px] font-bold">
                {NOMBRES_DE_TIPO_PAGO[pago.tipo]}
                {pago.medioNombre ? ` · ${pago.medioNombre}` : ""} · {monto(pago)}
              </p>
              <p className="mt-0.5 text-[12px] text-suave">
                Del {DIA.format(new Date(`${pago.fechaPago}T00:00:00Z`))}
                {pago.referencia ? ` · ref. ${pago.referencia}` : ""} · {pago.aNombreDelCliente ? "registrado por" : "reportado por"}{" "}
                {pago.reportadoPorNombre}, {MOMENTO.format(pago.reportadoEn)}
              </p>
            </div>
            <span
              className={[
                "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.06em]",
                pago.estado === "por_confirmar"
                  ? "border-transparent bg-acento text-acento-contraste"
                  : pago.estado === "rechazado"
                    ? "border-blackberry/40 text-blackberry dark-tema:border-gold/40 dark-tema:text-acento"
                    : "border-borde text-suave",
              ].join(" ")}
            >
              {NOMBRES_DE_ESTADO_PAGO[pago.estado]}
            </span>
          </div>

          {pago.estado === "confirmado" && pago.montoAplicado && (
            <p className="mt-1 text-[12.5px]">
              Se aplicaron {bolivares(pago.montoAplicado)}
              {pago.tasaAplicada ? ` (tasa ${pago.tasaAplicada.replace(/0+$/, "").replace(/\.$/, "")})` : ""}
            </p>
          )}
          {pago.estado === "rechazado" && pago.motivoRechazo && (
            <p className="mt-1 text-[12.5px] leading-relaxed">
              <span className="font-semibold">Motivo:</span> {pago.motivoRechazo}
            </p>
          )}
          {pago.tieneComprobante && (
            <a
              href={`/api/pagos/${pago.id}/comprobante`}
              target="_blank"
              rel="noopener"
              className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-acento hover:underline [&>svg]:size-3.5"
            >
              <FileText aria-hidden="true" />
              Ver el comprobante
            </a>
          )}

          {operador && pago.estado === "por_confirmar" && <Resolver pago={pago} tasaSugerida={tasaSugerida} />}
        </li>
      ))}
    </ul>
  );

  return operador ? <ProveedorPagos>{lista}</ProveedorPagos> : lista;
}
