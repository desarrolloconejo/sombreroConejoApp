"use client";

import { useActionState, useState } from "react";
import { Hash, Plus, Save, TriangleAlert } from "lucide-react";

import { guardarAjustes, guardarMedio, guardarNumeracion } from "@/actions/ajustesFinanzas";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { Boton, Campo, CLASE_CONTROL, Etiqueta, useCampos } from "@/components/ui";
import {
  ESTADO_INICIAL,
  type AjustesFinanzas,
  type EstadoFormulario,
  type MedioPago,
  type MonedaPago,
  type Numeracion,
} from "@/types";

/**
 * Los formularios de Ajustes de finanzas: emisor e impuestos, numeracion y
 * medios de pago. Los dos primeros siguen en pantalla al guardar y llevan su
 * propio estado; el de los medios vive en la lista (ver `MediosPago`).
 */

function Casilla({
  nombre,
  etiqueta,
  marcada,
  onCambio,
  ayuda,
}: {
  nombre: string;
  etiqueta: string;
  marcada: boolean;
  onCambio: (valor: boolean) => void;
  ayuda?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-[13px]">
      <input
        type="checkbox"
        name={nombre}
        value="si"
        checked={marcada}
        onChange={(evento) => onCambio(evento.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-[var(--acento)]"
      />
      <span>
        <span className="font-semibold">{etiqueta}</span>
        {ayuda && <span className="mt-0.5 block text-[12px] leading-relaxed text-suave">{ayuda}</span>}
      </span>
    </label>
  );
}

/** Emisor, impuestos y dias de credito. */
export function FormularioAjustes({ ajustes }: { ajustes: AjustesFinanzas }) {
  const [estado, enviar, enviando] = useActionState(guardarAjustes, ESTADO_INICIAL);
  useAvisoDeAccion(estado);
  const { campo } = useCampos({
    emisorRazonSocial: ajustes.emisorRazonSocial ?? "",
    emisorRif: ajustes.emisorRif ?? "",
    emisorDomicilio: ajustes.emisorDomicilio ?? "",
    ivaPct: ajustes.ivaPct,
    islrPct: ajustes.islrPct,
    igtfPct: ajustes.igtfPct,
    diasCredito: String(ajustes.diasCredito),
  });
  const [islr, setIslr] = useState(ajustes.islrActivo);
  const [igtf, setIgtf] = useState(ajustes.igtfActivo);
  const errores = estado.errores ?? {};
  const sinEmisor = !ajustes.emisorRazonSocial || !ajustes.emisorRif || !ajustes.emisorDomicilio;

  return (
    <form action={enviar} noValidate className="flex flex-col gap-5">
      {sinEmisor && (
        <p role="status" className="flex items-start gap-2 rounded-xl bg-acento-tenue px-3.5 py-3 text-[13px]">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Sin los datos del emisor no se puede emitir ninguna factura.
        </p>
      )}

      <fieldset className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
        <legend className="mb-3 text-[14px] font-bold">Quien emite las facturas</legend>
        <Campo
          id="aj-razon"
          etiqueta="Razon social"
          maxLength={200}
          error={errores.emisorRazonSocial}
          {...campo("emisorRazonSocial")}
        />
        <Campo
          id="aj-rif"
          etiqueta="RIF"
          placeholder="J-12345678-9"
          maxLength={20}
          error={errores.emisorRif}
          {...campo("emisorRif")}
        />
        <Campo
          id="aj-domicilio"
          etiqueta="Domicilio fiscal"
          maxLength={400}
          className="sm:col-span-2"
          error={errores.emisorDomicilio}
          {...campo("emisorDomicilio")}
        />
      </fieldset>

      <fieldset className="grid grid-cols-[minmax(0,1fr)] gap-3 border-t border-borde pt-5 sm:grid-cols-2">
        <legend className="sr-only">Impuestos y credito</legend>
        <p className="text-[14px] font-bold sm:col-span-2">Impuestos y credito</p>
        <Campo id="aj-iva" etiqueta="IVA (%)" inputMode="decimal" error={errores.ivaPct} {...campo("ivaPct")} />
        <Campo
          id="aj-dias"
          etiqueta="Dias de credito"
          inputMode="numeric"
          ayuda="Cuanto tarda en vencer una factura. Cada empresa puede tener los suyos."
          error={errores.diasCredito}
          {...campo("diasCredito")}
        />
        <div className="flex flex-col gap-2.5">
          <Casilla
            nombre="islrActivo"
            etiqueta="Retencion de ISLR"
            marcada={islr}
            onCambio={setIslr}
            ayuda="Apagada hasta que el contador la confirme."
          />
          <Campo
            id="aj-islr"
            etiqueta="Porcentaje de ISLR (%)"
            inputMode="decimal"
            disabled={!islr}
            error={errores.islrPct}
            {...campo("islrPct")}
          />
        </div>
        <div className="flex flex-col gap-2.5">
          <Casilla
            nombre="igtfActivo"
            etiqueta="IGTF en pagos en divisas"
            marcada={igtf}
            onCambio={setIgtf}
            ayuda="Apagado hasta que el contador lo confirme."
          />
          <Campo
            id="aj-igtf"
            etiqueta="Porcentaje de IGTF (%)"
            inputMode="decimal"
            disabled={!igtf}
            error={errores.igtfPct}
            {...campo("igtfPct")}
          />
        </div>
      </fieldset>

      {/* Lo deshabilitado no viaja en el formulario: se manda igual. */}
      {!islr && <input type="hidden" name="islrPct" value={ajustes.islrPct} />}
      {!igtf && <input type="hidden" name="igtfPct" value={ajustes.igtfPct} />}

      <div className="flex justify-end border-t border-borde pt-4">
        <Boton type="submit" disabled={enviando}>
          <Save aria-hidden="true" />
          {enviando ? "Guardando..." : "Guardar los ajustes"}
        </Boton>
      </div>
    </form>
  );
}

/** Serie, proximos numeros y rango de control del talonario. */
export function FormularioNumeracion({ numeracion, quedan }: { numeracion: Numeracion; quedan: number | null }) {
  const [estado, enviar, enviando] = useActionState(guardarNumeracion, ESTADO_INICIAL);
  useAvisoDeAccion(estado);
  const { campo } = useCampos({
    serie: numeracion.serie,
    proximaFactura: String(numeracion.proximaFactura),
    controlPrefijo: numeracion.controlPrefijo,
    proximoControl: String(numeracion.proximoControl),
    controlHasta: String(numeracion.controlHasta),
  });
  const errores = estado.errores ?? {};

  return (
    <form action={enviar} noValidate className="flex flex-col gap-4">
      {quedan !== null && (
        <p role="status" className="flex items-start gap-2 rounded-xl bg-acento-tenue px-3.5 py-3 text-[13px]">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {quedan === 0
            ? "Se acabaron los numeros de control del talonario: carga el rango nuevo para seguir facturando."
            : `Quedan ${quedan} numeros de control en el talonario.`}
        </p>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-[110px_minmax(0,1fr)]">
        <Campo id="num-serie" etiqueta="Serie" maxLength={3} error={errores.serie} {...campo("serie")} />
        <Campo
          id="num-factura"
          etiqueta="Proximo numero de factura"
          inputMode="numeric"
          ayuda="Solo puede subir: un numero ya usado no se vuelve a dar."
          error={errores.proximaFactura}
          {...campo("proximaFactura")}
        />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
        <Campo
          id="num-prefijo"
          etiqueta="Prefijo de control"
          maxLength={6}
          error={errores.controlPrefijo}
          {...campo("controlPrefijo")}
        />
        <Campo
          id="num-control"
          etiqueta="Proximo numero de control"
          inputMode="numeric"
          error={errores.proximoControl}
          {...campo("proximoControl")}
        />
        <Campo
          id="num-hasta"
          etiqueta="Ultimo del talonario"
          inputMode="numeric"
          error={errores.controlHasta}
          {...campo("controlHasta")}
        />
      </div>
      <div className="flex justify-end border-t border-borde pt-4">
        <Boton type="submit" variante="fantasma" disabled={enviando}>
          <Hash aria-hidden="true" />
          {enviando ? "Guardando..." : "Guardar la numeracion"}
        </Boton>
      </div>
    </form>
  );
}

const MONEDAS: { valor: MonedaPago; texto: string }[] = [
  { valor: "VES", texto: "Bolivares" },
  { valor: "USD", texto: "Dolares" },
];

type AccionMedio = [EstadoFormulario, (datos: FormData) => void, boolean];

/** El formulario de un medio, nuevo o existente. Su estado vive en la lista. */
function FormularioMedio({
  medio,
  accion,
  propio,
  alEnviar,
  alCancelar,
}: {
  medio: MedioPago | null;
  accion: AccionMedio;
  /** Si el ultimo envio fue de este formulario: solo entonces muestra sus errores. */
  propio: boolean;
  alEnviar: () => void;
  alCancelar?: () => void;
}) {
  const [estado, enviar, enviando] = accion;
  const { campo } = useCampos({
    nombre: medio?.nombre ?? "",
    datosParaPagar: medio?.datosParaPagar ?? "",
    orden: String(medio?.orden ?? 0),
  });
  const [monedas, setMonedas] = useState<MonedaPago[]>(medio?.monedas ?? ["VES"]);
  const [referencia, setReferencia] = useState(medio?.pideReferencia ?? true);
  const [activo, setActivo] = useState(medio?.activo ?? true);
  const errores = propio ? (estado.errores ?? {}) : {};

  return (
    <form
      action={enviar}
      onSubmit={alEnviar}
      noValidate
      className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2"
    >
      {medio && <input type="hidden" name="id" value={medio.id} />}
      <Campo
        id={`medio-${medio?.id ?? "nuevo"}-nombre`}
        etiqueta="Nombre"
        maxLength={80}
        error={errores.nombre}
        {...campo("nombre")}
      />
      <Campo
        id={`medio-${medio?.id ?? "nuevo"}-orden`}
        etiqueta="Orden en la lista"
        inputMode="numeric"
        error={errores.orden}
        {...campo("orden")}
      />
      <fieldset className="flex flex-wrap gap-x-5 gap-y-2 sm:col-span-2">
        <legend className="mb-2 text-xs font-semibold">Monedas que acepta</legend>
        {MONEDAS.map((moneda) => (
          <label key={moneda.valor} className="flex cursor-pointer items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              name="monedas"
              value={moneda.valor}
              checked={monedas.includes(moneda.valor)}
              onChange={(evento) =>
                setMonedas((previas) =>
                  evento.target.checked ? [...previas, moneda.valor] : previas.filter((m) => m !== moneda.valor),
                )
              }
              className="size-4 accent-[var(--acento)]"
            />
            {moneda.texto}
          </label>
        ))}
        {errores.monedas && (
          <span role="alert" className="w-full text-[12px] font-medium text-blackberry dark-tema:text-acento">
            {errores.monedas}
          </span>
        )}
      </fieldset>
      <label className="sm:col-span-2">
        <span className="mb-2 block text-xs font-semibold">
          Datos para pagar <span className="font-normal text-suave">(los ve el cliente)</span>
        </span>
        <textarea
          rows={3}
          maxLength={1000}
          placeholder="Banco, titular, numero de cuenta, telefono…"
          className={`${CLASE_CONTROL} min-h-[84px]`}
          {...campo("datosParaPagar")}
        />
      </label>
      <div className="flex flex-wrap gap-x-6 gap-y-2.5 sm:col-span-2">
        <Casilla nombre="pideReferencia" etiqueta="Pide numero de referencia" marcada={referencia} onCambio={setReferencia} />
        <Casilla nombre="activo" etiqueta="Activo: el cliente lo ve" marcada={activo} onCambio={setActivo} />
      </div>
      <div className="flex justify-end gap-2.5 sm:col-span-2">
        {alCancelar && (
          <Boton type="button" variante="fantasma" tamano="chico" onClick={alCancelar}>
            Cancelar
          </Boton>
        )}
        <Boton type="submit" tamano="chico" disabled={enviando}>
          {medio ? <Save aria-hidden="true" /> : <Plus aria-hidden="true" />}
          {enviando ? "Guardando..." : medio ? "Guardar el medio" : "Anadir el medio"}
        </Boton>
      </div>
    </form>
  );
}

/**
 * La lista de medios de pago, cada uno editable en su sitio, y el alta. La
 * lista guarda el estado de la action: al guardar se cierra la edicion, y el
 * aviso no se pierde con el formulario.
 */
export function MediosPago({ medios }: { medios: MedioPago[] }) {
  const accion = useActionState(guardarMedio, ESTADO_INICIAL);
  useAvisoDeAccion(accion[0]);
  const [editando, setEditando] = useState<number | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [origen, setOrigen] = useState<number | "nuevo" | null>(null);
  const [vueltas, setVueltas] = useState(0);

  // Al guardar bien: se cierra la edicion, o el alta queda limpia.
  const [visto, setVisto] = useState(accion[0]);
  if (accion[0] !== visto) {
    setVisto(accion[0]);
    if (accion[0].ok) {
      if (origen === "nuevo") setVueltas((n) => n + 1);
      else setEditando(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ul aria-label="Medios de pago" className="flex flex-col">
        {medios.map((medio) => (
          <li key={medio.id} className="border-b border-borde py-3 last:border-0">
            {editando === medio.id ? (
              <FormularioMedio
                medio={medio}
                accion={accion}
                propio={origen === medio.id}
                alEnviar={() => setOrigen(medio.id)}
                alCancelar={() => setEditando(null)}
              />
            ) : (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold">{medio.nombre}</p>
                  <p className="mt-0.5 text-[12px] text-suave">
                    {medio.monedas.map((m) => (m === "USD" ? "Dolares" : "Bolivares")).join(" y ")}
                    {medio.pideReferencia ? " · pide referencia" : ""}
                    {medio.datosParaPagar ? "" : " · sin datos para pagar"}
                  </p>
                </div>
                <Etiqueta variante={medio.activo ? "solida" : "contorno"}>
                  {medio.activo ? "Activo" : "Inactivo"}
                </Etiqueta>
                <Boton
                  type="button"
                  variante="fantasma"
                  tamano="chico"
                  onClick={() => setEditando(medio.id)}
                  aria-label={`Editar ${medio.nombre}`}
                >
                  Editar
                </Boton>
              </div>
            )}
          </li>
        ))}
      </ul>

      {nuevo ? (
        <div className="rounded-xl border border-borde p-4">
          <p className="mb-3 text-[13px] font-bold">Medio de pago nuevo</p>
          <FormularioMedio
            key={vueltas}
            medio={null}
            accion={accion}
            propio={origen === "nuevo"}
            alEnviar={() => setOrigen("nuevo")}
            alCancelar={() => setNuevo(false)}
          />
        </div>
      ) : (
        <div>
          <Boton type="button" variante="fantasma" tamano="chico" onClick={() => setNuevo(true)}>
            <Plus aria-hidden="true" />
            Anadir un medio de pago
          </Boton>
        </div>
      )}
    </div>
  );
}
