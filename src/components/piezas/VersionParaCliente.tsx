"use client";

import { useActionState } from "react";
import { Check, Send } from "lucide-react";

import { marcarVersionEnviada } from "@/actions/versiones";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { Boton } from "@/components/ui";
import { ESTADO_INICIAL, type Version } from "@/types";

import { Miniatura } from "./VersionesPieza";

/**
 * Elegir, dentro de la fase 4, la version que vera el cliente en la fase 5.
 *
 * Subir versiones se puede en cualquier fase, desde la tarjeta Versiones: el
 * equipo sube cuando tiene el archivo. Pero elegir la definitiva es el
 * trabajo de esta fase, asi que el control vive aqui, junto a «Completar
 * fase». Se puede cambiar de eleccion hasta completarla.
 */
export function VersionParaCliente({
  piezaId,
  versiones,
}: {
  piezaId: number;
  /** Las versiones de la ronda en curso. */
  versiones: Version[];
}) {
  const [estado, marcar, marcando] = useActionState(marcarVersionEnviada, ESTADO_INICIAL);
  useAvisoDeAccion(estado);

  if (versiones.length === 0) {
    return (
      <p className="rounded-xl border border-acento/40 bg-acento-tenue px-3.5 py-2.5 text-[12.5px] leading-relaxed">
        Todavia no hay versiones de esta ronda.{" "}
        <a href="#titulo-versiones" className="font-semibold text-acento hover:underline">
          Subela en Versiones
        </a>{" "}
        y elige aqui la que vera el cliente.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[12.5px] font-semibold">La version que vera el cliente</p>
      <ul className="flex flex-col gap-2">
        {versiones.map((version) => {
          const elegida = version.enviadaEn !== null;
          return (
            <li
              key={version.id}
              className={[
                "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                elegida ? "border-acento bg-acento-tenue" : "border-borde",
              ].join(" ")}
            >
              <Miniatura version={version} />
              <p className="min-w-0 flex-1 truncate text-[13px] font-semibold" title={version.nombre}>
                v{String(version.numero).padStart(2, "0")} · {version.nombre}
              </p>
              {elegida ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-navy px-2.5 py-1 text-[11px] font-semibold text-gold">
                  <Check aria-hidden="true" className="size-3.5" />
                  La vera el cliente
                </span>
              ) : (
                <form action={marcar} className="shrink-0">
                  <input type="hidden" name="piezaId" value={piezaId} />
                  <input type="hidden" name="versionId" value={version.id} />
                  <Boton type="submit" variante="fantasma" tamano="chico" disabled={marcando}>
                    <Send aria-hidden="true" />
                    Para el cliente
                  </Boton>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
