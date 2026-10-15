"use client";

import { useActionState } from "react";
import { FilePen, FilePlus2 } from "lucide-react";

import { abrirVersionMiBrief, nuevoBrief } from "@/actions/misBriefs";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { Boton } from "@/components/ui";
import { ESTADO_INICIAL, type EstadoFormulario } from "@/types";

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

/**
 * Abrir una version nueva de un brief enviado (S-08). Por defecto, la del
 * cliente; el prospecto pasa la suya, atada a su enlace.
 */
export function AbrirVersion({
  briefId,
  accion = abrirVersionMiBrief,
}: {
  briefId: number;
  accion?: (estado: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
}) {
  const [estado, enviar, enviando] = useActionState(accion, ESTADO_INICIAL);
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

/** Empezar el brief de un enlace de prospecto. La action llega atada al token. */
export function EmpezarPorEnlace({ accion }: { accion: (estado: EstadoFormulario) => Promise<EstadoFormulario> }) {
  const [estado, enviar, enviando] = useActionState(accion, ESTADO_INICIAL);
  useAvisoDeAccion(estado);

  return (
    <form action={enviar}>
      <Boton type="submit" disabled={enviando}>
        <FilePlus2 aria-hidden="true" />
        {enviando ? "Abriendo..." : "Empezar el brief"}
      </Boton>
    </form>
  );
}
