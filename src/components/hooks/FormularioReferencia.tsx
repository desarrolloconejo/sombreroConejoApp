"use client";

import { useActionState } from "react";
import { Check, CircleAlert } from "lucide-react";

import { guardarReferencia } from "@/actions/hooksDocumentacion";
import { PanelCuerpo, PanelPie, SeparadorPanel } from "@/components/listado";
import { Boton, BotonEnlace, Campo, Selector, useCampos } from "@/components/ui";
import { PLATAFORMAS, TERRITORIOS } from "@/lib/hooks/catalogo";
import { ESTADO_INICIAL } from "@/types";
import type { ReferenciaHook } from "@/types";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";

/**
 * El alta y la edicion de una referencia del banco.
 *
 * La lectura —por que funciona— es obligatoria, y es la unica regla de
 * negocio que impone esta pantalla. Sin ella queda un recorte suelto que
 * dentro de un mes no le dice nada a nadie, ni siquiera a quien lo guardo.
 */
export function FormularioReferencia({
  referencia,
  hrefCancelar,
}: {
  referencia: ReferenciaHook | null;
  hrefCancelar: string;
}) {
  const [estado, enviar, enviando] = useActionState(guardarReferencia, ESTADO_INICIAL);

  // El resultado sale como aviso flotante: en un formulario largo, una alerta
  // arriba queda fuera de la vista de quien acaba de pulsar el boton.
  useAvisoDeAccion(estado);
  const errores = estado.errores ?? {};

  // Controlados a proposito: React vacia los campos no controlados en cuanto
  // la action termina, tambien cuando devuelve errores. Sin esto, olvidar la
  // lectura borraba el hook que se acababa de transcribir.
  const { campo } = useCampos({
    hablado: referencia?.hablado ?? "",
    insertTitulo: referencia?.insertTitulo ?? "",
    lectura: referencia?.lectura ?? "",
    urlFuente: referencia?.urlFuente ?? "",
    etiquetas: referencia?.etiquetas.join(", ") ?? "",
  });

  return (
    <form action={enviar} noValidate className="flex min-h-0 flex-1 flex-col">
      <PanelCuerpo>
        {referencia && <input type="hidden" name="id" value={referencia.id} />}


        <SeparadorPanel>Lo que se observo</SeparadorPanel>

        <div className="flex flex-col gap-3.5">
          <div>
            <label htmlFor="ref-hablado" className="mb-2 block text-xs font-semibold">
              Hook observado
            </label>
            <textarea
              id="ref-hablado"
              {...campo("hablado")}
              rows={3}
              maxLength={600}
              placeholder="La frase, pregunta o escena de apertura…"
              className={[
                "suave w-full rounded-xl border-[1.5px] border-borde bg-campo px-3.5 py-3",
                "text-[13.5px] leading-relaxed text-texto placeholder:text-suave",
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

          <Campo
            id="ref-insert"
            {...campo("insertTitulo")}
            etiqueta="Insert-Titulo"
            opcional
            placeholder="El nucleo breve que aparece en pantalla"
            maxLength={600}
          />
        </div>

        <SeparadorPanel>Por que funciona</SeparadorPanel>

        <div>
          <textarea
            id="ref-lectura"
            {...campo("lectura")}
            rows={4}
            maxLength={600}
            placeholder="Ej.: abre con contraste y muestra la prueba antes del segundo tres."
            className={[
              "suave w-full rounded-xl border-[1.5px] border-borde bg-campo px-3.5 py-3",
              "text-[13.5px] leading-relaxed text-texto placeholder:text-suave",
              "focus:border-acento focus:bg-superficie focus:shadow-[var(--foco)] focus:outline-none",
              errores.lectura ? "border-blackberry" : "",
            ].join(" ")}
          />
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-suave">
            Tension, prueba o montaje. Es lo que se adapta despues; las
            palabras se reescriben para cada cliente.
          </p>
          {errores.lectura && (
            <p role="alert" className="mt-1.5 text-[11.5px] font-medium text-blackberry dark-tema:text-[#e9a9cd]">
              {errores.lectura}
            </p>
          )}
        </div>

        <SeparadorPanel>De donde sale</SeparadorPanel>

        <div className="grid grid-cols-2 gap-3.5">
          <Selector
            id="ref-plataforma"
            nombre="plataforma"
            etiqueta="Plataforma"
            marcador="Elige una"
            requerido
            valorInicial={referencia?.plataforma ?? ""}
            opciones={PLATAFORMAS.map((p) => ({ valor: p.slug, texto: p.nombre }))}
            error={errores.plataforma}
          />

          <Selector
            id="ref-territorio"
            nombre="territorio"
            etiqueta="Territorio"
            marcador="Elige uno"
            requerido
            valorInicial={referencia?.territorio ?? ""}
            opciones={TERRITORIOS.map((t) => ({
              valor: t.slug,
              texto: `${t.letra} · ${t.nombre}`,
            }))}
            error={errores.territorio}
          />

          <Campo
            id="ref-url"
            {...campo("urlFuente")}
            etiqueta="Fuente"
            opcional
            type="url"
            inputMode="url"
            placeholder="https://…"
            maxLength={1000}
            error={errores.urlFuente}
            className="col-span-2"
          />

          <Campo
            id="ref-etiquetas"
            {...campo("etiquetas")}
            etiqueta="Etiquetas"
            opcional
            placeholder="antes/despues, precio, tutorial"
            maxLength={500}
            ayuda="Separadas por comas. Alimentan la busqueda del banco."
            className="col-span-2"
          />
        </div>

        <p className="mt-[18px] flex items-start gap-3 rounded-xl border border-borde bg-campo p-4 text-[12.5px] leading-relaxed text-suave">
          <CircleAlert aria-hidden="true" className="mt-px size-4 shrink-0 text-acento" />
          Conserva el mecanismo, pero reescribe las palabras para cada cliente.
        </p>
      </PanelCuerpo>

      <PanelPie>
        <BotonEnlace href={hrefCancelar} variante="fantasma">
          Cancelar
        </BotonEnlace>

        <Boton type="submit" disabled={enviando}>
          {enviando ? "Guardando…" : "Guardar referencia"}
          {!enviando && <Check aria-hidden="true" />}
        </Boton>
      </PanelPie>
    </form>
  );
}
