import type { CSSProperties } from "react";
import { Clock, LogOut } from "lucide-react";

import { cerrarSesion } from "@/actions/auth";
import { Boton } from "@/components/ui";
import { ZONA_HORARIA } from "@/lib/fechas";

/**
 * El cierre de sesion, con la constancia del ultimo acceso.
 *
 * Es de servidor: la fecha se formatea aqui, donde no hay riesgo de que el
 * idioma del navegador produzca un texto distinto del que se pinto en el
 * servidor, y el boton es un formulario contra la action, sin JavaScript de
 * por medio.
 */

const TARJETA =
  "surge rounded-[15px] border border-borde bg-superficie p-[22px] shadow-[var(--sombra)]";

const FORMATO = new Intl.DateTimeFormat("es-VE", {
  timeZone: ZONA_HORARIA,
  dateStyle: "long",
  timeStyle: "short",
});

export function TarjetaSesion({ ultimoAcceso }: { ultimoAcceso: Date | null }) {
  // Sin fecha es que la cuenta se creo y todavia no ha entrado nadie con ella:
  // decir "nunca" seria confuso justo mientras se esta mirando la pagina.
  const cuando = ultimoAcceso
    ? FORMATO.format(new Date(ultimoAcceso))
    : "Esta es tu primera sesion";

  return (
    <section
      style={{ "--retraso": "0.2s" } as CSSProperties}
      className={TARJETA}
      aria-labelledby="perfil-sesion"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <b id="perfil-sesion" className="block text-[13.5px] font-semibold">
            Cerrar sesion
          </b>

          <p className="mt-[3px] text-xs leading-[1.5] text-suave">
            Se cierra en este dispositivo. Tendras que volver a entrar con tu
            correo.
          </p>

          <p className="mt-2.5 flex items-center gap-2 text-[11.5px] text-suave">
            <Clock aria-hidden="true" className="size-[13px] shrink-0" />
            Ultimo acceso: {cuando}
          </p>
        </div>

        <form action={cerrarSesion} className="shrink-0">
          <Boton type="submit" variante="peligro" className="w-full sm:w-auto">
            <LogOut aria-hidden="true" />
            Cerrar sesion
          </Boton>
        </form>
      </div>
    </section>
  );
}
