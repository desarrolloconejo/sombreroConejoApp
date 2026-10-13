import type { CSSProperties } from "react";
import { MonitorSmartphone } from "lucide-react";

import { Etiqueta } from "@/components/ui";
import type { SesionAbierta } from "@/types";

import { CerrarOtrasSesiones } from "./CerrarOtrasSesiones";

/**
 * Las sesiones que la persona tiene abiertas, y la forma de cerrar las demas.
 *
 * Sirve para dos cosas: comprobar que no hay nadie mas dentro de la cuenta, y
 * echarlo si lo hay sin tener que cambiar la contrasena.
 *
 * Es de servidor: las fechas se formatean aqui, donde el idioma del navegador
 * no puede producir un texto distinto del que se pinto.
 */

const TARJETA =
  "surge rounded-[15px] border border-borde bg-superficie p-[22px] shadow-[var(--sombra)]";

const FORMATO = new Intl.DateTimeFormat("es-VE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function TarjetaSesiones({
  sesiones,
  actualId,
}: {
  sesiones: SesionAbierta[];

  /** La sesion desde la que se esta mirando, para marcarla. */
  actualId: number | null;
}) {
  const hayOtras = sesiones.some((sesion) => sesion.id !== actualId);

  return (
    <section
      style={{ "--retraso": "0.16s" } as CSSProperties}
      className={TARJETA}
      aria-labelledby="perfil-sesiones"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <b id="perfil-sesiones" className="block text-[13.5px] font-semibold">
            Sesiones abiertas
          </b>

          <p className="mt-[3px] text-xs leading-[1.5] text-suave">
            Los sitios donde tu cuenta esta dentro ahora mismo. Si alguno no lo
            reconoces, cierra las demas y cambia tu contrasena.
          </p>
        </div>

        {hayOtras && <CerrarOtrasSesiones />}
      </div>

      <ul className="mt-4 flex flex-col divide-y divide-borde border-t border-borde">
        {sesiones.map((sesion) => (
          <li key={sesion.id} className="flex items-center gap-3 py-3">
            <MonitorSmartphone
              aria-hidden="true"
              className="size-[18px] shrink-0 text-suave"
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">
                {sesion.navegador ?? "Navegador sin identificar"}
              </p>

              <p className="mt-0.5 text-[11.5px] text-suave">
                Abierta el {FORMATO.format(new Date(sesion.creadaEn))}
              </p>
            </div>

            {sesion.id === actualId && <Etiqueta>Esta sesion</Etiqueta>}
          </li>
        ))}
      </ul>
    </section>
  );
}
