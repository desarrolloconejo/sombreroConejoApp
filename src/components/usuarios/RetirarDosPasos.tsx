"use client";

import { useActionState } from "react";
import { LoaderCircle, ShieldOff } from "lucide-react";

import { retirarDosPasos } from "@/actions/dosPasos";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { Boton } from "@/components/ui";
import { ESTADO_INICIAL } from "@/types";

/**
 * El boton con el que un administrador le retira los dos pasos a alguien.
 *
 * Es la salida para quien perdio el telefono y sus codigos de respaldo. Solo
 * se pinta si esa persona los tiene activados, y desaparece al usarlo.
 */
export function RetirarDosPasos({ id, nombre }: { id: number; nombre: string }) {
  const [estado, enviar, enviando] = useActionState(retirarDosPasos, ESTADO_INICIAL);

  useAvisoDeAccion(estado);

  if (estado.ok) return null;

  return (
    <form action={enviar}>
      <input type="hidden" name="id" value={id} />

      <Boton
        type="submit"
        variante="fantasma"
        tamano="chico"
        disabled={enviando}
        aria-label={`Retirar la verificacion en dos pasos de ${nombre}`}
      >
        {enviando ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : (
          <ShieldOff aria-hidden="true" />
        )}
        Retirar los dos pasos
      </Boton>
    </form>
  );
}
