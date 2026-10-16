"use client";

import { useActionState, useState } from "react";
import { Send } from "lucide-react";

import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { Boton, Campo, CampoFecha, CLASE_CONTROL, Selector } from "@/components/ui";
import { ESTADO_INICIAL, type EstadoFormulario, type MedioPago, type MonedaPago, type TipoPago } from "@/types";

/**
 * Reportar un pago o una retencion de una factura: lo usa el cliente (con su
 * comprobante, obligatorio) y quien opera finanzas para registrarlo a nombre
 * del cliente. Los campos son controlados: React 19 los vaciaria al volver
 * con un error. Al guardar bien, el formulario vuelve a empezar.
 */

type Accion = (estado: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;

const MONEDAS: Record<MonedaPago, string> = { VES: "Bolivares", USD: "Dolares" };

function Formulario({
  facturaId,
  medios,
  hoy,
  conRetencionIslr,
  comprobanteObligatorio,
  estado,
  enviar,
  enviando,
}: {
  facturaId: number;
  medios: MedioPago[];
  hoy: string;
  conRetencionIslr: boolean;
  comprobanteObligatorio: boolean;
  estado: EstadoFormulario;
  enviar: (datos: FormData) => void;
  enviando: boolean;
}) {
  const [tipo, setTipo] = useState<TipoPago>("pago");
  const [medioId, setMedioId] = useState(String(medios[0]?.id ?? ""));
  const medio = medios.find((m) => String(m.id) === medioId);
  const [moneda, setMoneda] = useState<MonedaPago>(medios[0]?.monedas[0] ?? "VES");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [referencia, setReferencia] = useState("");
  const errores = estado.errores ?? {};

  const tipos: { valor: TipoPago; texto: string }[] = [
    { valor: "pago", texto: "Un pago" },
    { valor: "retencion_iva", texto: "Retencion de IVA" },
    ...(conRetencionIslr ? [{ valor: "retencion_islr" as const, texto: "Retencion de ISLR" }] : []),
  ];

  const elegirMedio = (id: string) => {
    setMedioId(id);
    const nuevo = medios.find((m) => String(m.id) === id);
    if (nuevo && !nuevo.monedas.includes(moneda)) setMoneda(nuevo.monedas[0]);
  };

  return (
    <form action={enviar} noValidate className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
      <input type="hidden" name="facturaId" value={facturaId} />

      <fieldset className="flex flex-wrap gap-2 sm:col-span-2">
        <legend className="mb-2 text-xs font-semibold">Que reportas</legend>
        {tipos.map((opcion) => (
          <label
            key={opcion.valor}
            className={[
              "suave flex cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px]",
              tipo === opcion.valor ? "border-acento bg-acento-tenue font-semibold" : "border-borde hover:border-acento",
            ].join(" ")}
          >
            <input
              type="radio"
              name="tipo"
              value={opcion.valor}
              checked={tipo === opcion.valor}
              onChange={() => setTipo(opcion.valor)}
              className="accent-[var(--acento)]"
            />
            {opcion.texto}
          </label>
        ))}
      </fieldset>

      {tipo === "pago" ? (
        <>
          <Selector
            id="pago-medio"
            nombre="medioId"
            etiqueta="Como pagaste"
            valor={medioId}
            onCambio={elegirMedio}
            error={errores.medioId}
            opciones={medios.map((m) => ({ valor: String(m.id), texto: m.nombre }))}
          />
          <Selector
            id="pago-moneda"
            nombre="moneda"
            etiqueta="Moneda"
            valor={moneda}
            onCambio={(valor) => setMoneda(valor as MonedaPago)}
            error={errores.moneda}
            opciones={(medio?.monedas ?? ["VES"]).map((m) => ({ valor: m, texto: MONEDAS[m] }))}
          />
          {medio?.datosParaPagar && (
            <p className="whitespace-pre-line rounded-xl bg-acento-tenue px-3.5 py-3 text-[12.5px] leading-relaxed sm:col-span-2">
              <span className="mb-1 block font-semibold">Datos para pagar con {medio.nombre}</span>
              {medio.datosParaPagar}
            </p>
          )}
        </>
      ) : (
        <p className="text-[12.5px] leading-relaxed text-suave sm:col-span-2">
          Las retenciones se reportan en bolivares, con el numero del comprobante de retencion.
        </p>
      )}

      <Campo
        id={`pago-${facturaId}-monto`}
        etiqueta={`Monto${tipo === "pago" ? ` en ${MONEDAS[moneda].toLowerCase()}` : " en bolivares"}`}
        name="monto"
        inputMode="decimal"
        value={monto}
        onChange={(e) => setMonto(e.target.value)}
        error={errores.monto}
      />
      <CampoFecha
        id={`pago-${facturaId}-fecha`}
        etiqueta="Fecha"
        nombre="fechaPago"
        max={hoy}
        valor={fecha}
        onCambio={setFecha}
        error={errores.fechaPago}
      />
      <Campo
        id={`pago-${facturaId}-referencia`}
        etiqueta={tipo === "pago" ? "Numero de referencia" : "Numero del comprobante de retencion"}
        name="referencia"
        maxLength={60}
        opcional={tipo === "pago" && medio !== undefined && !medio.pideReferencia}
        value={referencia}
        onChange={(e) => setReferencia(e.target.value)}
        error={errores.referencia}
      />
      <label>
        <span className="mb-2 block text-xs font-semibold">
          Comprobante {!comprobanteObligatorio && <span className="font-normal text-suave">(opcional)</span>}
        </span>
        <input
          type="file"
          name="comprobante"
          accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
          aria-invalid={errores.comprobante ? true : undefined}
          className={`${CLASE_CONTROL} py-2.5 file:mr-3 file:rounded-lg file:border-0 file:bg-acento-tenue file:px-3 file:py-1 file:text-[12px] file:font-semibold`}
        />
        <span className="mt-1.5 block text-[11.5px] text-suave">Imagen o PDF, hasta 4 MB.</span>
        {errores.comprobante && (
          <span role="alert" className="mt-1 block text-[12px] text-blackberry dark-tema:text-acento">
            {errores.comprobante}
          </span>
        )}
      </label>

      <div className="flex justify-end sm:col-span-2">
        <Boton type="submit" disabled={enviando}>
          <Send aria-hidden="true" />
          {enviando ? "Enviando..." : comprobanteObligatorio ? "Reportar" : "Registrar a nombre del cliente"}
        </Boton>
      </div>
    </form>
  );
}

export function FormularioPago({
  accion,
  ...props
}: {
  accion: Accion;
  facturaId: number;
  medios: MedioPago[];
  hoy: string;
  conRetencionIslr: boolean;
  comprobanteObligatorio: boolean;
}) {
  const [estado, enviar, enviando] = useActionState(accion, ESTADO_INICIAL);
  useAvisoDeAccion(estado);

  // Al guardar bien, el formulario se vuelve a montar vacio.
  const [vueltas, setVueltas] = useState(0);
  const [visto, setVisto] = useState(estado);
  if (estado !== visto) {
    setVisto(estado);
    if (estado.ok) setVueltas((n) => n + 1);
  }

  if (props.medios.length === 0) {
    return <p className="text-[13px] text-suave">Aun no hay medios de pago configurados.</p>;
  }

  return <Formulario key={vueltas} {...props} estado={estado} enviar={enviar} enviando={enviando} />;
}
