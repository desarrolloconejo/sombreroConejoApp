"use client";

import { useEffect, useRef } from "react";
import { LoaderCircle } from "lucide-react";

import { renovarSesion } from "@/actions/sesion";

/** A donde se va cuando la sesion ya no se puede renovar. */
const LOGIN_CADUCADA = "/login?motivo=caducada";

/**
 * Pide un acceso nuevo y vuelve a donde se queria ir.
 *
 * La navegacion es una carga completa (`location.replace`) y no la del router:
 * el acceso nuevo viaja en una cookie, y lo que hay que conseguir es que el
 * servidor vuelva a renderizar la ruta de destino con ella. `replace` ademas
 * saca esta parada del historial, para que «atras» no vuelva a pasar por aqui.
 */
export function RenovarSesion({ volverA }: { volverA: string }) {
  // En desarrollo React monta los efectos dos veces. Sin esto se pedirian dos
  // renovaciones seguidas con el mismo token.
  const pedido = useRef(false);

  useEffect(() => {
    if (pedido.current) return;
    pedido.current = true;

    renovarSesion()
      .then((estado) => {
        window.location.replace(estado.ok ? volverA : LOGIN_CADUCADA);
      })
      .catch(() => {
        window.location.replace(LOGIN_CADUCADA);
      });
  }, [volverA]);

  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center px-6">
      <p
        role="status"
        className="surge flex items-center gap-3 text-sm font-medium text-suave"
      >
        <LoaderCircle aria-hidden="true" className="size-[18px] animate-spin" />
        Renovando tu sesion…
      </p>
    </main>
  );
}
