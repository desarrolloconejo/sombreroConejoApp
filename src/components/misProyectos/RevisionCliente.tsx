"use client";

import { useActionState, useState } from "react";
import { Check, Download, ExternalLink, FileText, MessageSquareWarning } from "lucide-react";

import { decidirPieza } from "@/actions/revision";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { Boton } from "@/components/ui";
import { sitioDeEnlace } from "@/lib/portal/archivos";
import { rutaDeCorreccion, textoDeRuta } from "@/lib/portal/fases";
import { ESTADO_INICIAL, type TipoCorreccion, type TipoProyecto, type Version } from "@/types";

/**
 * La pantalla de revision del cliente: lo que se le envio y su decision.
 */

/** La version que se le envio, como mejor se ve: imagen, PDF o enlace. */
export function VisorVersion({ version, aprobada }: { version: Version; aprobada: boolean }) {
  if (version.origen === "enlace" && version.enlace) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-[15px] border border-borde bg-campo px-5 py-6">
        <p className="text-[13px] text-suave">
          Esta pieza se revisa en {sitioDeEnlace(version.enlace)}: alli puedes verla completa y, si
          la herramienta lo permite, comentarla.
        </p>
        <a
          href={version.enlace}
          target="_blank"
          rel="noreferrer noopener"
          className="suave inline-flex items-center gap-2 rounded-[12px] bg-acento px-4 py-2.5 text-[13px] font-semibold text-acento-contraste hover:-translate-y-0.5 hover:bg-acento-hover [&>svg]:size-4"
        >
          Abrir en {sitioDeEnlace(version.enlace)}
          <ExternalLink aria-hidden="true" />
        </a>
      </div>
    );
  }

  const href = `/api/archivos/${version.id}`;

  return (
    <div className="flex flex-col gap-3">
      {version.mime?.startsWith("image/") ? (
        // Servida por la ruta de entrega, con la sesion de quien mira.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={href}
          alt={`Version ${version.numero} de la pieza`}
          className="max-h-[70vh] w-full rounded-[15px] border border-borde bg-campo object-contain"
        />
      ) : (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="suave flex items-center gap-3 rounded-[15px] border border-borde bg-campo px-5 py-6 text-[13px] font-semibold hover:border-acento [&>svg]:size-5"
        >
          <FileText aria-hidden="true" />
          Abrir el documento
        </a>
      )}

      {/* C2: se ve en la revision; se descarga al aprobarla. */}
      {aprobada && (
        <a
          href={`${href}?descargar=1`}
          className="suave inline-flex items-center gap-2 self-start rounded-[12px] border border-borde px-4 py-2.5 text-[13px] font-semibold hover:border-acento hover:bg-acento hover:text-acento-contraste [&>svg]:size-4"
        >
          <Download aria-hidden="true" />
          Descargar el archivo final
        </a>
      )}
    </div>
  );
}

const ETIQUETAS: Record<"redaccion" | "diseno", string> = {
  redaccion: "Redaccion (el texto)",
  diseno: "Diseno o edicion (lo visual)",
};

export function DecisionCliente({
  piezaId,
  tipo,
}: {
  piezaId: number;
  tipo: TipoProyecto;
}) {
  const [estado, enviar, enviando] = useActionState(decidirPieza, ESTADO_INICIAL);
  useAvisoDeAccion(estado);

  const [corrigiendo, setCorrigiendo] = useState(false);
  const [marcadas, setMarcadas] = useState<("redaccion" | "diseno")[]>([]);
  const [comentario, setComentario] = useState("");

  const tipoCorreccion: TipoCorreccion | null =
    marcadas.length === 2 ? "ambas" : (marcadas[0] ?? null);
  const ruta = tipoCorreccion ? rutaDeCorreccion(tipo, tipoCorreccion).reabre : null;

  return (
    <div className="flex flex-col gap-4">
      {!corrigiendo ? (
        <div className="flex flex-wrap gap-2.5">
          <form action={enviar}>
            <input type="hidden" name="piezaId" value={piezaId} />
            <input type="hidden" name="decision" value="aprobar" />
            <Boton type="submit" disabled={enviando}>
              <Check aria-hidden="true" />
              {enviando ? "Aprobando…" : "Aprobar"}
            </Boton>
          </form>
          <Boton type="button" variante="fantasma" onClick={() => setCorrigiendo(true)}>
            <MessageSquareWarning aria-hidden="true" />
            Pedir correccion
          </Boton>
        </div>
      ) : (
        <form action={enviar} className="flex flex-col gap-3.5">
          <input type="hidden" name="piezaId" value={piezaId} />
          <input type="hidden" name="decision" value="corregir" />

          <fieldset>
            <legend className="mb-2 text-xs font-semibold">Que hay que corregir</legend>
            <div className="flex flex-wrap gap-2.5">
              {(["redaccion", "diseno"] as const).map((opcion) => (
                <label
                  key={opcion}
                  className={[
                    "suave flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13px]",
                    marcadas.includes(opcion) ? "border-acento bg-acento-tenue" : "border-borde",
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    name="corregir"
                    value={opcion}
                    checked={marcadas.includes(opcion)}
                    onChange={() =>
                      setMarcadas((actuales) =>
                        actuales.includes(opcion)
                          ? actuales.filter((otra) => otra !== opcion)
                          : [...actuales, opcion],
                      )
                    }
                    className="size-[18px] accent-[var(--acento)]"
                  />
                  {ETIQUETAS[opcion]}
                </label>
              ))}
            </div>
            {estado.errores?.corregir && (
              <p role="alert" className="mt-1.5 text-[11.5px] font-medium text-blackberry dark-tema:text-gold">
                {estado.errores.corregir}
              </p>
            )}
          </fieldset>

          {ruta && (
            <p aria-live="polite" className="rounded-xl bg-campo px-3.5 py-2.5 text-[12.5px] leading-relaxed text-suave">
              {textoDeRuta(tipo, ruta)}
            </p>
          )}

          <div>
            <label htmlFor="correccion-comentario" className="mb-2 block text-xs font-semibold">
              Que cambiar
            </label>
            <textarea
              id="correccion-comentario"
              name="comentario"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Cuentanos con detalle que te gustaria distinto."
              className="suave w-full rounded-xl border-[1.5px] border-borde bg-campo px-3.5 py-3 text-[13.5px] leading-relaxed placeholder:text-suave focus:border-acento focus:bg-superficie focus:shadow-[var(--foco)] focus:outline-none"
            />
            {estado.errores?.comentario && (
              <p role="alert" className="mt-1.5 text-[11.5px] font-medium text-blackberry dark-tema:text-gold">
                {estado.errores.comentario}
              </p>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2.5">
            <Boton type="button" variante="fantasma" onClick={() => setCorrigiendo(false)}>
              Volver
            </Boton>
            <Boton type="submit" disabled={enviando || !tipoCorreccion || !comentario.trim()}>
              <MessageSquareWarning aria-hidden="true" />
              {enviando ? "Enviando…" : "Enviar la correccion"}
            </Boton>
          </div>
        </form>
      )}
    </div>
  );
}
