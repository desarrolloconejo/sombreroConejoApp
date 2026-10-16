"use client";

import { createContext, useActionState, useContext, useState, type ReactNode } from "react";
import { Ban, FileText, Printer, ReceiptText } from "lucide-react";

import { anularFactura, emitirFactura, marcarFacturaImpresa } from "@/actions/facturas";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { Boton, CLASE_CONTROL, Selector } from "@/components/ui";
import { ESTADO_INICIAL, type EstadoFormulario } from "@/types";

/**
 * Lo que se hace con una factura: emitirla desde su proforma, imprimirla en
 * un formato, marcarla impresa y anularla.
 *
 * Anular y marcar impresa hacen desaparecer su boton: su estado vive en
 * `ProveedorFactura`, que envuelve la ficha, para que el aviso no se pierda.
 */

type Accion = [EstadoFormulario, (datos: FormData) => void, boolean];

const ContextoFactura = createContext<{ anular: Accion; impresa: Accion } | null>(null);

export function ProveedorFactura({ children }: { children: ReactNode }) {
  const anular = useActionState(anularFactura, ESTADO_INICIAL);
  const impresa = useActionState(marcarFacturaImpresa, ESTADO_INICIAL);
  useAvisoDeAccion(anular[0]);
  useAvisoDeAccion(impresa[0]);

  return <ContextoFactura.Provider value={{ anular, impresa }}>{children}</ContextoFactura.Provider>;
}

function useAcciones() {
  const acciones = useContext(ContextoFactura);
  if (!acciones) throw new Error("Va dentro de ProveedorFactura");
  return acciones;
}

/** Emitir la factura de una proforma emitida. Lleva a la factura. */
export function EmitirFactura({ proformaId, etiqueta }: { proformaId: number; etiqueta?: string }) {
  const [estado, enviar, enviando] = useActionState(emitirFactura, ESTADO_INICIAL);
  useAvisoDeAccion(estado);

  return (
    <form action={enviar}>
      <input type="hidden" name="proformaId" value={proformaId} />
      <Boton type="submit" tamano="chico" disabled={enviando} aria-label={etiqueta}>
        <ReceiptText aria-hidden="true" />
        {enviando ? "Emitiendo..." : "Emitir la factura"}
      </Boton>
    </form>
  );
}

/** Abrir el PDF para el talonario en el formato elegido, y marcarla impresa. */
export function ImprimirFactura({
  facturaId,
  formatos,
  impresa,
}: {
  facturaId: number;
  formatos: { id: number; nombre: string; habitual: boolean }[];
  impresa: boolean;
}) {
  const { impresa: marcar } = useAcciones();
  const [formato, setFormato] = useState(String(formatos.find((f) => f.habitual)?.id ?? formatos[0]?.id ?? ""));

  return (
    <div className="flex flex-col gap-3">
      <Selector
        id={`formato-factura-${facturaId}`}
        etiqueta="Formato de impresion"
        valor={formato}
        onCambio={setFormato}
        opciones={formatos.map((f) => ({
          valor: String(f.id),
          texto: f.nombre,
          detalle: f.habitual ? "El habitual" : undefined,
        }))}
      />
      <div className="flex flex-wrap gap-2.5">
        <a
          href={`/api/facturas/${facturaId}/pdf?formato=${formato}`}
          target="_blank"
          rel="noopener"
          className="suave inline-flex min-h-9 items-center gap-2 rounded-xl border border-borde px-3.5 text-[13px] font-semibold hover:-translate-y-0.5 hover:border-acento [&>svg]:size-4"
        >
          <Printer aria-hidden="true" />
          Abrir el PDF para imprimir
        </a>
        {!impresa && (
          <form action={marcar[1]}>
            <input type="hidden" name="id" value={facturaId} />
            <Boton type="submit" variante="fantasma" tamano="chico" disabled={marcar[2]}>
              <FileText aria-hidden="true" />
              Marcar como impresa
            </Boton>
          </form>
        )}
      </div>
    </div>
  );
}

/** Anular con motivo. Pide confirmacion escribiendo el motivo. */
export function AnularFactura({ facturaId }: { facturaId: number }) {
  const { anular } = useAcciones();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const error = anular[0].errores?.motivo;

  if (!abierto) {
    return (
      <Boton type="button" variante="fantasma" tamano="chico" onClick={() => setAbierto(true)}>
        <Ban aria-hidden="true" />
        Anular la factura
      </Boton>
    );
  }

  return (
    <form action={anular[1]} noValidate className="flex flex-col gap-3">
      <input type="hidden" name="id" value={facturaId} />
      <label>
        <span className="mb-2 block text-xs font-semibold">Motivo de la anulacion</span>
        <textarea
          name="motivo"
          rows={3}
          maxLength={500}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          aria-invalid={error ? true : undefined}
          className={`${CLASE_CONTROL} min-h-[84px]`}
        />
        {error && (
          <span role="alert" className="mt-1.5 block text-[12px] font-medium text-blackberry dark-tema:text-acento">
            {error}
          </span>
        )}
      </label>
      <p className="text-[12px] leading-relaxed text-suave">
        La factura queda anulada para siempre, con su numero. La proforma vuelve a poder facturarse.
      </p>
      <div className="flex justify-end gap-2.5">
        <Boton type="button" variante="fantasma" tamano="chico" onClick={() => setAbierto(false)}>
          Volver
        </Boton>
        <Boton type="submit" variante="peligro" tamano="chico" disabled={anular[2]}>
          <Ban aria-hidden="true" />
          Anular
        </Boton>
      </div>
    </form>
  );
}
