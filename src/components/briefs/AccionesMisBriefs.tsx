"use client";

import { useActionState } from "react";
import { FilePen, FilePlus2 } from "lucide-react";

import { abrirVersionMiBrief, nuevoBrief } from "@/actions/misBriefs";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { Boton } from "@/components/ui";
import { ESTADO_INICIAL } from "@/types";

/** Empezar un brief de un formato. Lleva a su formulario. */
export function NuevoBrief({ formato, nombre }: { formato: string; nombre: string }) {
  const [estado, enviar, enviando] = useActionState(nuevoBrief, ESTADO_INICIAL);
  useAvisoDeAccion(estado);

  return (
    <form action={enviar}>
      <input type="hidden" name="formato" value={formato} />
      <Boton type="submit" disabled={enviando} aria-label={`Empezar un ${nombre}`}>
        <FilePlus2 aria-hidden="true" />
        {enviando ? "Abriendo..." : "Empezar"}
      </Boton>
    </form>
  );
}

/** Abrir una version nueva de un brief enviado (S-08). */
export function AbrirVersion({ briefId }: { briefId: number }) {
  const [estado, enviar, enviando] = useActionState(abrirVersionMiBrief, ESTADO_INICIAL);
  useAvisoDeAccion(estado);

  return (
    <form action={enviar}>
      <input type="hidden" name="id" value={briefId} />
      <Boton type="submit" variante="fantasma" tamano="chico" disabled={enviando}>
        <FilePen aria-hidden="true" />
        {enviando ? "Abriendo..." : "Cambiar algo: enviar una version nueva"}
      </Boton>
    </form>
  );
}
