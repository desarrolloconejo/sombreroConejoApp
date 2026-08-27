"use client";

import { useActionState } from "react";
import { Check, CircleAlert, CircleCheck } from "lucide-react";

import { guardarApertura } from "@/actions/hooksDocumentacion";
import { PanelCuerpo, PanelPie, SeparadorPanel } from "@/components/listado";
import { Alerta, Boton, BotonEnlace, Campo, Selector } from "@/components/ui";
import { MECANISMOS, TERRITORIOS } from "@/lib/hooks/catalogo";
import { ESTADO_INICIAL } from "@/types";
import type { Apertura } from "@/types";

/**
 * El alta y la edicion de una apertura del catalogo.
 *
 * Los mecanismos van como casillas y no como desplegable porque una apertura
 * puede tener dos: "comparacion" y "numero" a la vez es lo normal, y un
 * <select multiple> no se sabe usar sin explicarlo.
 *
 * El territorio si es unico. Es la intencion del hook, y una apertura que
 * sirviera para dos intenciones distintas no ayudaria a elegir: seria dos
 * aperturas.
 */

const TEXTAREA = [
  "suave w-full rounded-xl border-[1.5px] border-borde bg-campo px-3.5 py-3",
  "text-[13.5px] leading-relaxed text-texto placeholder:text-suave",
  "focus:border-acento focus:bg-superficie focus:shadow-[var(--foco)] focus:outline-none",
].join(" ");

const ERROR = "mt-1.5 text-[11.5px] font-medium text-blackberry dark-tema:text-[#e9a9cd]";

function Area({
  id,
  name,
  etiqueta,
  filas = 3,
  valor,
  marcador,
  ayuda,
  error,
}: {
  id: string;
  name: string;
  etiqueta: string;
  filas?: number;
  valor: string;
  marcador: string;
  ayuda?: string;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-xs font-semibold">
        {etiqueta}
      </label>
      <textarea
        id={id}
        name={name}
        rows={filas}
        maxLength={600}
        defaultValue={valor}
        placeholder={marcador}
        className={[TEXTAREA, error ? "border-blackberry" : ""].join(" ")}
      />
      {ayuda && (
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-suave">{ayuda}</p>
      )}
      {error && (
        <p role="alert" className={ERROR}>
          {error}
        </p>
      )}
    </div>
  );
}

export function FormularioApertura({
  apertura,
  hrefCancelar,
}: {
  apertura: Apertura | null;
  hrefCancelar: string;
}) {
  const [estado, enviar, enviando] = useActionState(guardarApertura, ESTADO_INICIAL);
  const errores = estado.errores ?? {};
  const marcados = apertura?.mecanismos ?? [];

  return (
    <form action={enviar} noValidate className="flex min-h-0 flex-1 flex-col">
      <PanelCuerpo>
        {apertura && <input type="hidden" name="id" value={apertura.id} />}

        {estado.mensaje && (
          <Alerta
            tono={estado.ok ? "info" : "aviso"}
            icono={estado.ok ? <CircleCheck /> : <CircleAlert />}
            className="mb-[18px]"
          >
            {estado.mensaje}
          </Alerta>
        )}

        <SeparadorPanel>Con que intencion</SeparadorPanel>

        <Selector
          id="ap-territorio"
          nombre="territorio"
          etiqueta="Territorio"
          marcador="Elige uno"
          requerido
          valorInicial={apertura?.territorio ?? ""}
          opciones={TERRITORIOS.map((t) => ({
            valor: t.slug,
            texto: `${t.letra} · ${t.nombre}`,
          }))}
          error={errores.territorio}
        />

        <fieldset className="mt-3.5">
          <legend className="mb-2 text-xs font-semibold">
            Mecanismos{" "}
            <span className="font-medium text-suave">· como se demuestra</span>
          </legend>

          <div className="flex flex-wrap gap-[7px]">
            {MECANISMOS.map((m) => (
              <label
                key={m.slug}
                className="suave inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-borde px-3 text-xs font-semibold text-suave hover:border-acento hover:text-acento has-checked:border-acento has-checked:bg-acento has-checked:text-acento-contraste"
              >
                <input
                  type="checkbox"
                  name="mecanismos"
                  value={m.slug}
                  defaultChecked={marcados.includes(m.slug)}
                  className="sr-only"
                />
                {m.nombre}
              </label>
            ))}
          </div>

          <p className="mt-2 text-[11.5px] leading-relaxed text-suave">
            Lo normal es uno o dos. Alimentan el filtro con el que se busca una
            apertura al escribir.
          </p>
        </fieldset>

        <SeparadorPanel>Como empieza</SeparadorPanel>

        <div className="flex flex-col gap-3.5">
          <Area
            id="ap-plantilla"
            name="plantilla"
            etiqueta="Plantilla"
            valor={apertura?.plantilla ?? ""}
            marcador="Nadie te dice que [lo que se calla] cuando [situacion]…"
            ayuda="Lo que va entre [corchetes] es lo que hay que sustituir por la verdad del cliente. Se adapta la estructura, nunca las palabras."
            error={errores.plantilla}
          />

          <Area
            id="ap-ejemplo"
            name="ejemplo"
            etiqueta="Ejemplo hablado"
            filas={2}
            valor={apertura?.ejemplo ?? ""}
            marcador="La plantilla ya resuelta para un cliente concreto"
            error={errores.ejemplo}
          />

          <Campo
            id="ap-insert"
            name="insertTitulo"
            etiqueta="Insert-Titulo sugerido"
            defaultValue={apertura?.insertTitulo ?? ""}
            placeholder="Seis palabras o menos"
            maxLength={600}
            error={errores.insertTitulo}
          />
        </div>

        <SeparadorPanel>Como se ejecuta</SeparadorPanel>

        <div className="flex flex-col gap-3.5">
          <Area
            id="ap-direccion"
            name="direccionEdicion"
            etiqueta="Direccion para edicion"
            filas={2}
            valor={apertura?.direccionEdicion ?? ""}
            marcador="Plano, corte y ritmo: lo que edicion ejecuta sin interpretar"
            error={errores.direccionEdicion}
          />

          <Area
            id="ap-cuando"
            name="usalaCuando"
            etiqueta="Usala cuando"
            filas={2}
            valor={apertura?.usalaCuando ?? ""}
            marcador="La situacion en la que esta apertura es la acertada"
            error={errores.usalaCuando}
          />
        </div>

        {!apertura && (
          <p className="mt-[18px] flex items-start gap-3 rounded-xl border border-borde bg-campo p-4 text-[12.5px] leading-relaxed text-suave">
            <CircleAlert aria-hidden="true" className="mt-px size-4 shrink-0 text-acento" />
            El numero se asigna solo, a continuacion del ultimo.
          </p>
        )}
      </PanelCuerpo>

      <PanelPie>
        <BotonEnlace href={hrefCancelar} variante="fantasma">
          Cancelar
        </BotonEnlace>

        <Boton type="submit" disabled={enviando}>
          {enviando ? "Guardando…" : "Guardar apertura"}
          {!enviando && <Check aria-hidden="true" />}
        </Boton>
      </PanelPie>
    </form>
  );
}
