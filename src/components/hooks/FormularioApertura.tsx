"use client";

import { useActionState, useState, type ComponentProps } from "react";
import { Check, CircleAlert } from "lucide-react";

import { guardarApertura } from "@/actions/hooksDocumentacion";
import { PanelCuerpo, PanelPie, SeparadorPanel } from "@/components/listado";
import { Boton, BotonEnlace, Campo, Selector, useCampos } from "@/components/ui";
import { MECANISMOS, TERRITORIOS } from "@/lib/hooks/catalogo";
import { ESTADO_INICIAL } from "@/types";
import type { Apertura } from "@/types";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";

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

/**
 * `resto` recibe lo que devuelve `campo(...)`: name, value y onChange. El area
 * queda controlada, y por eso un error de validacion ya no borra lo escrito.
 */
function Area({
  id,
  etiqueta,
  filas = 3,
  marcador,
  ayuda,
  error,
  ...resto
}: {
  id: string;
  etiqueta: string;
  filas?: number;
  marcador: string;
  ayuda?: string;
  error?: string;
} & Omit<ComponentProps<"textarea">, "id" | "className" | "rows" | "placeholder">) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-xs font-semibold">
        {etiqueta}
      </label>
      <textarea
        id={id}
        rows={filas}
        maxLength={600}
        placeholder={marcador}
        className={[TEXTAREA, error ? "border-blackberry" : ""].join(" ")}
        {...resto}
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

  // El resultado sale como aviso flotante: en un formulario largo, una alerta
  // arriba queda fuera de la vista de quien acaba de pulsar el boton.
  useAvisoDeAccion(estado);
  const errores = estado.errores ?? {};

  // Controlados a proposito: React vacia los campos no controlados en cuanto
  // la action termina, tambien cuando devuelve errores.
  const { campo } = useCampos({
    plantilla: apertura?.plantilla ?? "",
    ejemplo: apertura?.ejemplo ?? "",
    insertTitulo: apertura?.insertTitulo ?? "",
    direccionEdicion: apertura?.direccionEdicion ?? "",
    usalaCuando: apertura?.usalaCuando ?? "",
  });

  // Las casillas tampoco sobreviven al vaciado, asi que su marca vive aqui.
  const [marcados, setMarcados] = useState<string[]>(apertura?.mecanismos ?? []);

  return (
    <form action={enviar} noValidate className="flex min-h-0 flex-1 flex-col">
      <PanelCuerpo>
        {apertura && <input type="hidden" name="id" value={apertura.id} />}


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
                  checked={marcados.includes(m.slug)}
                  onChange={(evento) =>
                    setMarcados((previos) =>
                      evento.target.checked
                        ? [...previos, m.slug]
                        : previos.filter((uno) => uno !== m.slug),
                    )
                  }
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
            {...campo("plantilla")}
            etiqueta="Plantilla"
            marcador="Nadie te dice que [lo que se calla] cuando [situacion]…"
            ayuda="Lo que va entre [corchetes] es lo que hay que sustituir por la verdad del cliente. Se adapta la estructura, nunca las palabras."
            error={errores.plantilla}
          />

          <Area
            id="ap-ejemplo"
            {...campo("ejemplo")}
            etiqueta="Ejemplo hablado"
            filas={2}
            marcador="La plantilla ya resuelta para un cliente concreto"
            error={errores.ejemplo}
          />

          <Campo
            id="ap-insert"
            {...campo("insertTitulo")}
            etiqueta="Insert-Titulo sugerido"
            placeholder="Seis palabras o menos"
            maxLength={600}
            error={errores.insertTitulo}
          />
        </div>

        <SeparadorPanel>Como se ejecuta</SeparadorPanel>

        <div className="flex flex-col gap-3.5">
          <Area
            id="ap-direccion"
            {...campo("direccionEdicion")}
            etiqueta="Direccion para edicion"
            filas={2}
            marcador="Plano, corte y ritmo: lo que edicion ejecuta sin interpretar"
            error={errores.direccionEdicion}
          />

          <Area
            id="ap-cuando"
            {...campo("usalaCuando")}
            etiqueta="Usala cuando"
            filas={2}
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
