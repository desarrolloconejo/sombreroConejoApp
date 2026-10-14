import { ExternalLink, Pencil } from "lucide-react";
import type { ReactNode } from "react";

import { PanelCuerpo, PanelPie, SeparadorPanel } from "@/components/listado";
import { BotonEnlace, Etiqueta } from "@/components/ui";
import { nombrePlataforma, nombreTerritorio } from "@/lib/hooks/catalogo";
import type { ReferenciaHook } from "@/types";
import { ZONA_HORARIA } from "@/lib/fechas";

/**
 * Ficha detallada de una referencia (modo "Ver más"), dentro del panel lateral.
 *
 * Muestra el hook observado, la plataforma, la lectura analítica de por qué funciona
 * y las etiquetas temáticas, permitiendo pasar a edición.
 */

const FORMATO = new Intl.DateTimeFormat("es-VE", {
  timeZone: ZONA_HORARIA,
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

export function DetalleReferencia({
  referencia,
  hrefEditar,
  hrefCerrar,
}: {
  referencia: ReferenciaHook;
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
                {nombreTerritorio(referencia.territorio)}
              </p>
              <p className="mt-1 text-[16px] leading-snug font-bold">
                &laquo;{referencia.hablado}&raquo;
              </p>
            </div>

            <Etiqueta variante="contorno">
              {nombrePlataforma(referencia.plataforma)}
            </Etiqueta>
          </div>

          {referencia.insertTitulo && (
            <div className="mt-3">
              <span className="inline-flex items-center rounded-full bg-navy px-3 py-1 text-[11.5px] font-bold text-gold">
                {referencia.insertTitulo}
              </span>
            </div>
          )}
        </div>

        <SeparadorPanel>Lectura y análisis</SeparadorPanel>

        <div className="rounded-xl border border-borde bg-superficie p-4">
          <p className="text-[10.5px] font-bold tracking-[0.08em] text-suave uppercase">
            Por qué funciona
          </p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-texto">
            {referencia.lectura}
          </p>
        </div>

        {referencia.etiquetas.length > 0 && (
          <>
            <SeparadorPanel>Etiquetas temáticas</SeparadorPanel>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {referencia.etiquetas.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-acento-tenue px-3 py-1 text-[11.5px] font-bold text-acento"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </>
        )}

        <SeparadorPanel>Datos de la fuente</SeparadorPanel>

        <dl className="mt-1">
          <Dato rotulo="Plataforma">{nombrePlataforma(referencia.plataforma)}</Dato>
          <Dato rotulo="Territorio">{nombreTerritorio(referencia.territorio)}</Dato>
          <Dato rotulo="Enlace a fuente">
            {referencia.urlFuente ? (
              <a
                href={referencia.urlFuente}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 font-semibold text-acento hover:underline"
              >
                Abrir publicación original
                <ExternalLink className="size-3.5" />
              </a>
            ) : (
              <span className="text-suave italic">Sin enlace registrado</span>
            )}
          </Dato>
          <Dato rotulo="Guardada">{FORMATO.format(new Date(referencia.creadoEn))}</Dato>
        </dl>
      </PanelCuerpo>

      <PanelPie>
        <BotonEnlace href={hrefCerrar} variante="fantasma">
          Cerrar
        </BotonEnlace>

        <BotonEnlace href={hrefEditar}>
          <Pencil aria-hidden="true" />
          Editar referencia
        </BotonEnlace>
      </PanelPie>
    </>
  );
}
