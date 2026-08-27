import { Pencil } from "lucide-react";
import type { ReactNode } from "react";

import { PanelCuerpo, PanelPie, SeparadorPanel } from "@/components/listado";
import { BotonEnlace, Etiqueta } from "@/components/ui";
import { nombreMecanismo, nombreTerritorio } from "@/lib/hooks/catalogo";
import type { Apertura } from "@/types";

/**
 * Ficha detallada de una apertura (modo "Ver más"), dentro del panel lateral.
 *
 * Muestra la plantilla, los mecanismos de demostración, ejemplos e instrucciones
 * de edición en modo lectura, con enlace directo para editar.
 */

const FORMATO = new Intl.DateTimeFormat("es-VE", {
  dateStyle: "long",
  timeStyle: "short",
});

function Dato({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,120px)_minmax(0,1fr)] items-baseline gap-4 border-b border-borde py-[11px] last:border-b-0">
      <dt className="text-[10.5px] font-bold tracking-[0.08em] text-suave uppercase">
        {rotulo}
      </dt>
      <dd className="min-w-0 text-[13px] break-words">{children ?? "—"}</dd>
    </div>
  );
}

export function DetalleApertura({
  apertura,
  hrefEditar,
  hrefCerrar,
}: {
  apertura: Apertura;
  hrefEditar: string;
  hrefCerrar: string;
}) {
  return (
    <>
      <PanelCuerpo>
        <div className="rounded-[13px] border border-borde bg-campo p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10.5px] font-bold tracking-[0.1em] text-suave uppercase">
                Apertura #{apertura.numero}
              </p>
              <p className="mt-0.5 text-[16px] font-bold">
                {nombreTerritorio(apertura.territorio)}
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Etiqueta variante={apertura.activa ? "solida" : "contorno"}>
                {apertura.activa ? "Activa" : "Retirada"}
              </Etiqueta>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {apertura.mecanismos.map((m) => (
              <span
                key={m}
                className="rounded-full bg-acento-tenue px-2.5 py-1 text-[11px] font-bold text-acento"
              >
                {nombreMecanismo(m)}
              </span>
            ))}
          </div>
        </div>

        <SeparadorPanel>Plantilla y estructura</SeparadorPanel>

        <div className="rounded-xl border border-borde bg-superficie p-4">
          <p className="text-[10.5px] font-bold tracking-[0.08em] text-suave uppercase">
            Plantilla base
          </p>
          <p className="mt-2 text-[16px] leading-snug font-bold">
            {apertura.plantilla.split(/(\[[^\]]+\])/g).map((trozo, i) =>
              trozo.startsWith("[") ? (
                <span
                  key={i}
                  className="rounded-[5px] bg-acento-tenue px-1.5 font-bold text-acento"
                >
                  {trozo}
                </span>
              ) : (
                trozo
              ),
            )}
          </p>
          <p className="mt-2 text-[11.5px] leading-relaxed text-suave">
            Los corchetes marcan las variables a sustituir con la verdad del cliente.
          </p>
        </div>

        <div className="mt-3 space-y-3">
          <div className="rounded-xl border border-borde bg-campo p-3.5">
            <p className="text-[10.5px] font-bold tracking-[0.08em] text-suave uppercase">
              Ejemplo hablado
            </p>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-texto">
              &ldquo;{apertura.ejemplo}&rdquo;
            </p>
          </div>

          {apertura.insertTitulo && (
            <div className="rounded-xl border border-borde bg-campo p-3.5">
              <p className="text-[10.5px] font-bold tracking-[0.08em] text-suave uppercase">
                Insert-Título sugerido
              </p>
              <div className="mt-1.5">
                <span className="inline-flex items-center rounded-full bg-navy px-3 py-1 text-[12px] font-bold text-gold">
                  {apertura.insertTitulo}
                </span>
              </div>
            </div>
          )}
        </div>

        <SeparadorPanel>Dirección y uso</SeparadorPanel>

        <dl className="mt-1">
          <Dato rotulo="Dirección para edición">
            {apertura.direccionEdicion}
          </Dato>
          <Dato rotulo="Úsala cuando">{apertura.usalaCuando}</Dato>
          <Dato rotulo="Estado en catálogo">
            {apertura.activa
              ? "Disponible (se sugiere al escribir fichas)"
              : "Retirada (no se ofrece para nuevas piezas)"}
          </Dato>
          {apertura.creadoEn && (
            <Dato rotulo="Registrada">{FORMATO.format(new Date(apertura.creadoEn))}</Dato>
          )}
        </dl>
      </PanelCuerpo>

      <PanelPie>
        <BotonEnlace href={hrefCerrar} variante="fantasma">
          Cerrar
        </BotonEnlace>

        <BotonEnlace href={hrefEditar}>
          <Pencil aria-hidden="true" />
          Editar apertura
        </BotonEnlace>
      </PanelPie>
    </>
  );
}
