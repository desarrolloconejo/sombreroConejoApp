"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { BotonIcono, CLASE_CONTROL, Selector } from "@/components/ui";
import { importesDe, subtotalDe } from "@/lib/finanzas/calculo";
import { dolares } from "@/lib/finanzas/documentos";
import type { Renglon, RenglonNuevo } from "@/types";

const OPCIONES_IVA = [
  { valor: "no", texto: "Gravado" },
  { valor: "si", texto: "Exento" },
];

/**
 * Los renglones de un borrador, editables, con su vista previa.
 *
 * Cada fila envia cuatro campos con el mismo nombre (`descripcion`,
 * `cantidad`, `precio`, `exento`): la action los lee como listas paralelas,
 * en orden. Las filas viven en el estado de React, asi que sobreviven al
 * vaciado de React 19 cuando la action devuelve un error.
 *
 * Los subtotales y los importes de abajo son una vista previa calculada aqui
 * con las mismas reglas que la base. Lo que vale es lo que la base guarda: al
 * guardar, la pagina se repinta con sus numeros.
 */

type Fila = RenglonNuevo & { clave: number };

let siguienteClave = 1;

function filaVacia(): Fila {
  return { clave: siguienteClave++, descripcion: "", cantidad: "1", precioUnitario: "", exento: false };
}

/** 1.000 -> «1»; 2.500 -> «2.5». Lo que se escribiria a mano. */
function sinCeros(valor: string): string {
  return valor.includes(".") ? valor.replace(/\.?0+$/, "") : valor;
}

export function EditorRenglones({
  iniciales,
  ivaPct,
  error,
}: {
  iniciales: Renglon[];
  ivaPct: string;
  error?: string;
}) {
  const [filas, setFilas] = useState<Fila[]>(() =>
    iniciales.length > 0
      ? iniciales.map((renglon) => ({
          clave: siguienteClave++,
          descripcion: renglon.descripcion,
          cantidad: sinCeros(renglon.cantidad),
          precioUnitario: renglon.precioUnitario,
          exento: renglon.exento,
        }))
      : [filaVacia()],
  );

  function cambiar(clave: number, cambios: Partial<RenglonNuevo>) {
    setFilas((actuales) =>
      actuales.map((fila) => (fila.clave === clave ? { ...fila, ...cambios } : fila)),
    );
  }

  function quitar(clave: number) {
    setFilas((actuales) => {
      const quedan = actuales.filter((fila) => fila.clave !== clave);
      return quedan.length > 0 ? quedan : [filaVacia()];
    });
  }

  const importes = importesDe(filas, ivaPct);

  return (
    <div>
      <div className="flex flex-col gap-3">
        {filas.map((fila, indice) => {
          const subtotal = subtotalDe(fila.cantidad, fila.precioUnitario);
          const numero = indice + 1;

          return (
            <fieldset
              key={fila.clave}
              className="grid grid-cols-2 gap-2.5 rounded-xl border border-borde p-3 sm:grid-cols-[minmax(0,1fr)_88px_112px_124px_96px_44px] sm:items-end sm:border-0 sm:p-0"
            >
              <legend className="sr-only">Renglon {numero}</legend>

              <label className="col-span-2 sm:col-span-1">
                <span className={`mb-1.5 block text-[11.5px] font-semibold ${indice > 0 ? "sm:sr-only" : ""}`}>
                  Descripcion
                </span>
                <input
                  name="descripcion"
                  value={fila.descripcion}
                  onChange={(evento) => cambiar(fila.clave, { descripcion: evento.target.value })}
                  maxLength={300}
                  placeholder="Que se cobra"
                  aria-label={`Descripcion del renglon ${numero}`}
                  className={CLASE_CONTROL}
                />
              </label>

              <label>
                <span className={`mb-1.5 block text-[11.5px] font-semibold ${indice > 0 ? "sm:sr-only" : ""}`}>
                  Cantidad
                </span>
                <input
                  name="cantidad"
                  value={fila.cantidad}
                  onChange={(evento) => cambiar(fila.clave, { cantidad: evento.target.value })}
                  inputMode="decimal"
                  aria-label={`Cantidad del renglon ${numero}`}
                  className={`${CLASE_CONTROL} text-right tabular-nums`}
                />
              </label>

              <label>
                <span className={`mb-1.5 block text-[11.5px] font-semibold ${indice > 0 ? "sm:sr-only" : ""}`}>
                  Precio (USD)
                </span>
                <input
                  name="precio"
                  value={fila.precioUnitario}
                  onChange={(evento) => cambiar(fila.clave, { precioUnitario: evento.target.value })}
                  inputMode="decimal"
                  placeholder="0,00"
                  aria-label={`Precio del renglon ${numero}`}
                  className={`${CLASE_CONTROL} text-right tabular-nums`}
                />
              </label>

              <div className="col-span-2 sm:col-span-1">
                <span
                  aria-hidden="true"
                  className={`mb-1.5 block text-[11.5px] font-semibold ${indice > 0 ? "sm:sr-only" : ""}`}
                >
                  IVA
                </span>
                <Selector
                  id={`renglon-${fila.clave}-iva`}
                  nombre="exento"
                  etiqueta={`IVA del renglon ${numero}`}
                  etiquetaOculta
                  valor={fila.exento ? "si" : "no"}
                  onCambio={(valor) => cambiar(fila.clave, { exento: valor === "si" })}
                  opciones={OPCIONES_IVA}
                />
              </div>

              {/* En movil, subtotal y quitar comparten fila; en escritorio cada
                  uno ocupa su columna (`sm:contents` deshace la envoltura). */}
              <div className="col-span-2 flex items-center justify-between gap-3 sm:contents">
                <p className="text-right text-[13px] font-semibold tabular-nums sm:self-end sm:leading-[44px]">
                  <span className="mr-1.5 text-[11.5px] font-normal text-suave sm:hidden">Subtotal</span>
                  {subtotal === null ? <span className="text-suave">—</span> : dolares(subtotal)}
                </p>

                <BotonIcono
                  type="button"
                  etiqueta={`Quitar el renglon ${numero}`}
                  onClick={() => quitar(fila.clave)}
                  className="sm:self-end sm:justify-self-end"
                >
                  <Trash2 aria-hidden="true" />
                </BotonIcono>
              </div>
            </fieldset>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-[12px] font-medium text-blackberry dark-tema:text-acento">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => setFilas((actuales) => [...actuales, filaVacia()])}
        className="suave mt-3 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-[12.5px] font-semibold text-acento hover:-translate-y-px [&>svg]:size-4"
      >
        <Plus aria-hidden="true" />
        Anadir renglon
      </button>

      <div className="mt-5 border-t border-borde pt-4">
        <dl className="ml-auto w-full max-w-[320px] text-[13px]" aria-label="Vista previa de los importes">
          <div className="flex justify-between gap-4 py-1">
            <dt className="text-suave">Base imponible</dt>
            <dd className="tabular-nums">{dolares(importes.baseImponible)}</dd>
          </div>
          <div className="flex justify-between gap-4 py-1">
            <dt className="text-suave">Exento</dt>
            <dd className="tabular-nums">{dolares(importes.montoExento)}</dd>
          </div>
          <div className="flex justify-between gap-4 py-1">
            <dt className="text-suave">IVA ({ivaPct.replace(/\.00$/, "")} %)</dt>
            <dd className="tabular-nums">{dolares(importes.ivaMonto)}</dd>
          </div>
          <div className="mt-1.5 flex justify-between gap-4 border-t border-borde pt-2.5">
            <dt className="font-bold">Total</dt>
            <dd className="text-[17px] font-extrabold tabular-nums">{dolares(importes.total)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
