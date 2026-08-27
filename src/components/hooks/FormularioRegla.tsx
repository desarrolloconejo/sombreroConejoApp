"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";

import { guardarRegla } from "@/actions/hooksDocumentacion";
import { PanelCuerpo, PanelPie, SeparadorPanel } from "@/components/listado";
import { Boton, BotonEnlace, Campo, Selector } from "@/components/ui";
import { ESTANDAR_INSERT, ESTANDAR_VOZ } from "@/lib/hooks/listas";
import { ESTADO_INICIAL } from "@/types";
import type { Empresa, ReglaHook } from "@/types";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";

/**
 * El alta y la edicion de una regla.
 *
 * Es de cliente por una razon concreta: el aviso de limite ampliado tiene que
 * aparecer MIENTRAS se suben los numeros, no despues de guardar. Enterarse de
 * que la cuenta se sale del estandar cuando ya esta guardada convierte el
 * aviso en un reproche.
 */
export function FormularioRegla({
  empresas,
  regla,
  hrefCancelar,
}: {
  empresas: Empresa[];
  regla: ReglaHook | null;
  hrefCancelar: string;
}) {
  const [estado, enviar, enviando] = useActionState(guardarRegla, ESTADO_INICIAL);

  // El resultado sale como aviso flotante: en un formulario largo, una alerta
  // arriba queda fuera de la vista de quien acaba de pulsar el boton.
  useAvisoDeAccion(estado);

  const [empresaId, setEmpresaId] = useState(
    regla?.empresaId ? String(regla.empresaId) : "",
  );
  const [voz, setVoz] = useState(String(regla?.maxPalabrasVoz ?? ESTANDAR_VOZ));
  const [insert, setInsert] = useState(
    String(regla?.maxPalabrasInsert ?? ESTANDAR_INSERT),
  );

  const errores = estado.errores ?? {};
  const ampliada =
    Number(voz) > ESTANDAR_VOZ || Number(insert) > ESTANDAR_INSERT;

  return (
    <form action={enviar} noValidate className="flex min-h-0 flex-1 flex-col">
      <PanelCuerpo>
        {regla && <input type="hidden" name="id" value={regla.id} />}
        <input type="hidden" name="empresaId" value={empresaId} />


        <SeparadorPanel>A quien se aplica</SeparadorPanel>

        <div className="flex flex-col gap-3.5">
          <Campo
            id="regla-etiqueta"
            name="etiqueta"
            etiqueta="Nombre de la regla"
            defaultValue={regla?.etiqueta ?? ""}
            placeholder="Estandar hosteleria"
            maxLength={120}
            required
            error={errores.etiqueta}
          />

          <Selector
            id="regla-empresa"
            nombre="_empresaId"
            etiqueta="Cliente"
            marcador="Aplicar por sector"
            valorInicial={empresaId}
            onCambio={setEmpresaId}
            opciones={empresas.map((e) => ({
              valor: String(e.id),
              texto: e.nombre,
              detalle: e.sector ?? undefined,
            }))}
            ayuda="Tiene prioridad sobre el sector. Si eliges cliente, el sector se ignora."
            error={errores.empresaId}
          />

          <Campo
            id="regla-sector"
            name="sector"
            etiqueta="Sector"
            opcional
            defaultValue={regla?.sector ?? ""}
            placeholder="Hosteleria"
            maxLength={120}
            disabled={empresaId !== ""}
            ayuda={
              empresaId !== ""
                ? "Desactivado: esta regla ya es de un cliente concreto."
                : "Se usa cuando la cuenta no tiene regla propia."
            }
          />
        </div>

        <SeparadorPanel>Limites</SeparadorPanel>

        <div className="grid grid-cols-2 gap-3.5">
          <Campo
            id="regla-voz"
            name="maxPalabrasVoz"
            etiqueta="Voz"
            inputMode="numeric"
            value={voz}
            onChange={(e) => setVoz(e.target.value)}
            ayuda="Maximo (3–30)"
            error={errores.maxPalabrasVoz}
          />

          <Campo
            id="regla-insert"
            name="maxPalabrasInsert"
            etiqueta="Insert-Titulo"
            inputMode="numeric"
            value={insert}
            onChange={(e) => setInsert(e.target.value)}
            ayuda="Maximo (2–16)"
            error={errores.maxPalabrasInsert}
          />
        </div>

        {/* El aviso aparece EN VIVO al pasar del estandar */}
        {ampliada && (
          <p className="mt-3.5 rounded-xl border border-acento bg-acento-tenue px-4 py-3.5 text-[12.5px] leading-relaxed">
            <b>Esta cuenta usa un limite ampliado.</b> La agencia trabaja por
            defecto con voz ≤ {ESTANDAR_VOZ} e Insert-Titulo ≤ {ESTANDAR_INSERT}.
            La regla se respetara, pero quedara identificada en cada auditoria.
          </p>
        )}

        <SeparadorPanel>Terminos propios</SeparadorPanel>
        <p className="-mt-2 mb-3.5 text-[11.5px] leading-relaxed text-suave">
          Se SUMAN a las listas de la casa, no las sustituyen. Separados por
          comas.
        </p>

        <div className="flex flex-col gap-3.5">
          <Campo
            id="regla-preambulos"
            name="preambulos"
            etiqueta="Preambulos a detectar"
            opcional
            defaultValue={regla?.preambulos.join(", ") ?? ""}
            placeholder="hola, buenas, chicos"
            maxLength={1200}
          />

          <Campo
            id="regla-formulas"
            name="formulasGastadas"
            etiqueta="Formulas gastadas"
            opcional
            defaultValue={regla?.formulasGastadas.join(", ") ?? ""}
            placeholder="espera al final, no vas a creer"
            maxLength={1200}
          />

          <Campo
            id="regla-tension"
            name="terminosTension"
            etiqueta="Terminos de tension"
            opcional
            defaultValue={regla?.terminosTension.join(", ") ?? ""}
            placeholder="error, deja de, falla"
            maxLength={1200}
          />
        </div>

        <label className="mt-[18px] flex cursor-pointer items-start gap-3 rounded-xl border border-borde bg-campo p-4">
          <input
            type="checkbox"
            name="exigirPrueba"
            defaultChecked={regla?.exigirPrueba ?? true}
            className="mt-0.5 size-[18px] shrink-0 accent-[var(--acento)]"
          />
          <span>
            <span className="mb-1 block text-[13px] font-bold">
              Exigir prueba visible
            </span>
            <span className="block text-xs leading-relaxed text-suave">
              La auditoria marcara la pieza si el hook promete algo que no se
              demuestra en pantalla. Es fallo duro: tapa la nota.
            </span>
          </span>
        </label>
      </PanelCuerpo>

      <PanelPie>
        <BotonEnlace href={hrefCancelar} variante="fantasma">
          Cancelar
        </BotonEnlace>

        <Boton type="submit" disabled={enviando}>
          {enviando ? "Guardando…" : "Guardar regla"}
          {!enviando && <Check aria-hidden="true" />}
        </Boton>
      </PanelPie>
    </form>
  );
}
