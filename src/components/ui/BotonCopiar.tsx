"use client";

import { Check, Copy } from "lucide-react";

import { useAvisosSiHay } from "@/components/layout/ProveedorAvisos";
import { useCopiar } from "./useCopiar";

/**
 * El boton pequeno que va junto a un dato (un RIF, un telefono, una
 * direccion) para copiarlo con un clic y pegarlo en un mensaje o en otro
 * sistema.
 *
 * Confirma dos veces: el icono cambia a una marca y sale un aviso, que en el
 * telefono es lo que de verdad se ve. Si el navegador no deja copiar, el
 * aviso lo dice: el dato sigue a la vista para copiarlo a mano.
 */
export function BotonCopiar({
  texto,
  que,
  className,
}: {
  /** Lo que se copia, tal cual. */
  texto: string;
  /** Que es, en minusculas: "el RIF", "el telefono". Lo oye el lector y sale en el aviso. */
  que: string;
  className?: string;
}) {
  const { copiado, copiar } = useCopiar();
  const avisos = useAvisosSiHay();
  const etiqueta = copiado ? `Copiado ${que}` : `Copiar ${que}`;

  async function alPulsar() {
    const bien = await copiar(texto);
    avisos?.avisar(
      bien ? `Copiado ${que}` : "El navegador no dejo copiar: seleccionalo a mano",
      bien ? "exito" : "error",
    );
  }

  return (
    <button
      type="button"
      onClick={alPulsar}
      aria-label={etiqueta}
      title={etiqueta}
      className={[
        "suave inline-grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg align-middle",
        "border border-transparent text-suave",
        "hover:-translate-y-0.5 hover:border-acento hover:bg-acento hover:text-acento-contraste",
        "focus-visible:outline-none focus-visible:shadow-[var(--foco)]",
        "[&>svg]:size-3.5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {copiado ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
    </button>
  );
}
