import type { ReactNode } from "react";

import { PanelCuerpo, PanelPie, SeparadorPanel } from "@/components/listado";
import { Alerta } from "@/components/ui";
import type { CorreoSalida } from "@/types";

import { AccionesCorreo } from "./AccionesCorreo";
import { estadoDeCorreo, nombreDeCorreo } from "./ColumnasSalida";

/**
 * Un correo abierto: a quien iba, en que quedo y lo que dice.
 *
 * Con el correo en modo simulado esta pantalla es el propio envio: el
 * administrador lee aqui el mensaje, lo copia y lo hace llegar por otro
 * medio. Por eso el texto se muestra entero y tal cual, sin recortar.
 */

const CUANDO = new Intl.DateTimeFormat("es-VE", {
  dateStyle: "long",
  timeStyle: "short",
});

function Dato({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,108px)_minmax(0,1fr)] items-baseline gap-4 border-b border-borde py-[11px] last:border-b-0">
      <dt className="text-[10.5px] font-bold tracking-[0.08em] text-suave uppercase">
        {rotulo}
      </dt>
      <dd className="min-w-0 text-[13px] break-words">{children ?? "—"}</dd>
    </div>
  );
}

export function DetalleCorreo({ correo }: { correo: CorreoSalida }) {
  const porEntregar = correo.estado === "simulado" && !correo.entregadoEn;

  // Lo que se copia lleva el destinatario y el asunto: quien lo pega en otro
  // sitio necesita las tres cosas, no solo el cuerpo.
  const texto = `Para: ${correo.para}\nAsunto: ${correo.asunto}\n\n${correo.cuerpo}`;

  return (
    <>
      <PanelCuerpo>
        {porEntregar && (
          <Alerta className="mb-5">
            Este correo no se envio: el correo esta en modo simulado. Copialo y
            hazlo llegar por otro medio; despues, anotalo como entregado.
          </Alerta>
        )}

        {correo.estado === "fallido" && correo.error && (
          <Alerta className="mb-5">No se pudo enviar: {correo.error}</Alerta>
        )}

        <dl>
          <Dato rotulo="Para">
            {correo.paraNombre}
            <span className={correo.paraNombre ? "block text-[12px] text-suave" : ""}>
              {correo.para}
            </span>
          </Dato>
          <Dato rotulo="Empresa">{correo.empresaNombre}</Dato>
          <Dato rotulo="Tipo">{nombreDeCorreo(correo.tipo)}</Dato>
          <Dato rotulo="Estado">
            {estadoDeCorreo(correo)}
            {correo.entregadoEn && (
              <span className="block text-[12px] text-suave">
                {correo.entregadoPorNombre ?? "Alguien"} ·{" "}
                {CUANDO.format(new Date(correo.entregadoEn))}
              </span>
            )}
            {correo.enviadoEn && (
              <span className="block text-[12px] text-suave">
                {CUANDO.format(new Date(correo.enviadoEn))}
              </span>
            )}
          </Dato>
          <Dato rotulo="Lo provoco">{correo.creadoPorNombre}</Dato>
          <Dato rotulo="Cuando">{CUANDO.format(new Date(correo.creadoEn))}</Dato>
        </dl>

        <SeparadorPanel>Mensaje</SeparadorPanel>

        <p className="mb-2.5 text-[13.5px] font-semibold break-words">
          {correo.asunto}
        </p>

        {/* `pre-wrap` respeta los saltos de linea del texto plano y aun asi
            parte las lineas largas: es un correo, no un bloque de codigo. */}
        <p className="rounded-[11px] border border-borde bg-campo px-4 py-3.5 text-[13px] leading-relaxed break-words whitespace-pre-wrap">
          {correo.cuerpo}
        </p>
      </PanelCuerpo>

      <PanelPie>
        <AccionesCorreo
          id={correo.id}
          texto={texto}
          puedeMarcar={porEntregar}
          puedeReintentar={correo.estado === "fallido"}
        />
      </PanelPie>
    </>
  );
}
