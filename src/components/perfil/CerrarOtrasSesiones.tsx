"use client";

import { useActionState } from "react";
import { LoaderCircle, LogOut } from "lucide-react";

import { cerrarOtrasSesiones } from "@/actions/sesion";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { Boton } from "@/components/ui";
import { ESTADO_INICIAL } from "@/types";

/**
 * El boton que cierra las demas sesiones.
 *
 * Es lo unico de la tarjeta que tiene que ser de cliente: necesita
 * `useActionState` para avisar del resultado. La lista de sesiones se pinta en
 * el servidor.
 */
export function CerrarOtrasSesiones() {
  const [estado, enviar, enviando] = useActionState(
    cerrarOtrasSesiones,
    ESTADO_INICIAL,
  );

  useAvisoDeAccion(estado);

  return (
    <form action={enviar} className="shrink-0">
      <Boton
        type="submit"
        variante="fantasma"
        disabled={enviando}
        className="w-full sm:w-auto"
      >
        {enviando ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : (
          <LogOut aria-hidden="true" />
        )}
        Cerrar las demas
      </Boton>
    </form>
  );
}
