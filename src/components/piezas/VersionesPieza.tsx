"use client";

import { useActionState, useState } from "react";
import { ExternalLink, FileText, Send, Upload } from "lucide-react";

import { marcarVersionEnviada, subirVersion } from "@/actions/versiones";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { Boton, CLASE_CONTROL } from "@/components/ui";
import { sitioDeEnlace } from "@/lib/portal/archivos";
import { ESTADO_INICIAL, type Version } from "@/types";

/**
 * Las versiones de una pieza, para el equipo.
 *
 * Sube quien trabaja en la pieza; el ejecutivo marca, en la fase 4, la que
 * vera el cliente. Los archivos se ven a traves de la ruta de entrega, nunca
 * con un enlace directo a donde estan guardados.
 */

const FECHA = new Intl.DateTimeFormat("es-VE", { dateStyle: "medium", timeStyle: "short" });

function Miniatura({ version }: { version: Version }) {
  if (version.origen === "enlace" && version.enlace) {
    return (
      <a
        href={version.enlace}
        target="_blank"
        rel="noreferrer noopener"
        className="suave grid size-16 shrink-0 place-items-center rounded-xl border border-borde bg-campo text-suave hover:border-acento hover:text-acento [&>svg]:size-5"
        title={`Abrir en ${sitioDeEnlace(version.enlace)}`}
      >
        <ExternalLink aria-hidden="true" />
        <span className="sr-only">Abrir en {sitioDeEnlace(version.enlace)}</span>
      </a>
    );
  }

  const href = `/api/archivos/${version.id}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="suave grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-borde bg-campo text-suave hover:border-acento [&>svg]:size-5"
      title="Abrir el archivo"
    >
      {version.mime?.startsWith("image/") ? (
        // Una imagen del propio portal, servida por la ruta de entrega: el
        // optimizador de imagenes no sabria pasarle la sesion.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={href} alt={`Version ${version.numero}`} className="size-full object-cover" />
      ) : (
        <FileText aria-hidden="true" />
      )}
    </a>
  );
}

export function VersionesPieza({
  piezaId,
  versiones,
  puedeSubir,
  gestiona,
  faseActual,
  ronda,
}: {
  piezaId: number;
  versiones: Version[];
  /** Trabaja en la pieza o la gestiona, y la pieza esta activa. */
  puedeSubir: boolean;
  gestiona: boolean;
  faseActual: number | null;
  ronda: number;
}) {
  const [subido, subir, subiendo] = useActionState(subirVersion, ESTADO_INICIAL);
  const [marcado, marcar, marcando] = useActionState(marcarVersionEnviada, ESTADO_INICIAL);

  useAvisoDeAccion(subido);
  useAvisoDeAccion(marcado);

  const [origen, setOrigen] = useState<"archivo" | "enlace">("archivo");
  const enviadaDeLaRonda = versiones.find((v) => v.ronda === ronda && v.enviadaEn !== null);
  const puedeMarcar = gestiona && faseActual === 4;

  return (
    <div className="flex flex-col gap-3">
      {faseActual === 4 && gestiona && !enviadaDeLaRonda && (
        <p className="rounded-xl border border-acento/40 bg-acento-tenue px-3.5 py-2.5 text-[12.5px] leading-relaxed">
          Para completar la fase 4 marca la version que vera el cliente.
        </p>
      )}

      {versiones.length === 0 ? (
        <p className="text-[12.5px] text-suave">Todavia no hay ninguna version.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {versiones.map((version) => (
            <li key={version.id} className="flex items-center gap-3 rounded-xl border border-borde px-3 py-2.5">
              <Miniatura version={version} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold" title={version.nombre}>
                  v{String(version.numero).padStart(2, "0")} · {version.nombre}
                </p>
                <p className="truncate text-[11.5px] text-suave">
                  Ronda {version.ronda} · fase {version.fase} · {version.subidaPorNombre} ·{" "}
                  {FECHA.format(new Date(version.creadaEn))}
                </p>
                {version.enviadaEn && (
                  <p className="mt-1 inline-flex rounded-full bg-navy px-2 py-0.5 text-[10.5px] font-semibold text-gold">
                    La ve el cliente
                  </p>
                )}
              </div>

              {puedeMarcar && version.ronda === ronda && !version.enviadaEn && (
                <form action={marcar}>
                  <input type="hidden" name="piezaId" value={piezaId} />
                  <input type="hidden" name="versionId" value={version.id} />
                  <Boton type="submit" variante="fantasma" tamano="chico" disabled={marcando}>
                    <Send aria-hidden="true" />
                    Para el cliente
                  </Boton>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {puedeSubir && (
        <form
          key={subido.ok ? subido.mensaje : "subir"}
          action={subir}
          className="flex flex-col gap-2.5 rounded-xl border border-dashed border-borde px-3 py-3"
        >
          <input type="hidden" name="piezaId" value={piezaId} />
          <input type="hidden" name="origen" value={origen} />

          <div role="radiogroup" aria-label="Que se sube" className="flex gap-2">
            {(["archivo", "enlace"] as const).map((opcion) => (
              <button
                key={opcion}
                type="button"
                role="radio"
                aria-checked={origen === opcion}
                onClick={() => setOrigen(opcion)}
                className={[
                  "suave rounded-full border px-3 py-1 text-[12px] font-semibold",
                  origen === opcion
                    ? "border-acento bg-acento text-acento-contraste"
                    : "border-borde text-suave hover:border-acento",
                ].join(" ")}
              >
                {opcion === "archivo" ? "Archivo" : "Enlace"}
              </button>
            ))}
          </div>

          {origen === "archivo" ? (
            <div>
              <label htmlFor={`version-archivo-${piezaId}`} className="mb-1 block text-[11px] font-semibold text-suave">
                Imagen o PDF, hasta 4 MB
              </label>
              <input
                id={`version-archivo-${piezaId}`}
                type="file"
                name="archivo"
                accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
                className="block w-full text-[12.5px] file:mr-3 file:cursor-pointer file:rounded-[10px] file:border-0 file:bg-acento file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-acento-contraste"
              />
              {subido.errores?.archivo && (
                <p role="alert" className="mt-1.5 text-[11.5px] font-medium text-blackberry dark-tema:text-gold">
                  {subido.errores.archivo}
                </p>
              )}
            </div>
          ) : (
            <div>
              <label htmlFor={`version-enlace-${piezaId}`} className="mb-1 block text-[11px] font-semibold text-suave">
                Enlace de Figma, Frame.io, Dropbox, Drive, Canva, Vimeo o YouTube
              </label>
              <input
                id={`version-enlace-${piezaId}`}
                name="enlace"
                type="url"
                placeholder="https://www.figma.com/file/..."
                className={`${CLASE_CONTROL} min-h-10 py-2`}
              />
              <label htmlFor={`version-nombre-${piezaId}`} className="mt-2 mb-1 block text-[11px] font-semibold text-suave">
                Como se llama
              </label>
              <input
                id={`version-nombre-${piezaId}`}
                name="nombre"
                maxLength={120}
                placeholder="Corte final con subtitulos"
                className={`${CLASE_CONTROL} min-h-10 py-2`}
              />
              {subido.errores?.enlace && (
                <p role="alert" className="mt-1.5 text-[11.5px] font-medium text-blackberry dark-tema:text-gold">
                  {subido.errores.enlace}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Boton type="submit" tamano="chico" disabled={subiendo}>
              <Upload aria-hidden="true" />
              {subiendo ? "Guardando…" : "Guardar version"}
            </Boton>
          </div>
        </form>
      )}
    </div>
  );
}
