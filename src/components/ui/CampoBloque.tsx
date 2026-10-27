"use client";

import { useState } from "react";

import { limpiarBloque } from "@/lib/nomenclatura";

import { Campo } from "./Campo";

/**
 * Un bloque de la nomenclatura de archivos (la sigla de una empresa, el nombre
 * corto de un proyecto), propuesto a partir del nombre.
 *
 * Mientras nadie lo toca, sigue al nombre que se va escribiendo; en cuanto se
 * escribe en el, se queda con lo escrito. Debajo dice como quedara en los
 * archivos: mayusculas, sin acentos y con guiones, que es lo que guarda la
 * action. Lleva su propio estado, asi que React no lo vacia al terminar la
 * action.
 */
export function CampoBloque({
  id,
  name,
  etiqueta,
  origen,
  inicial,
  proponer,
  largo,
  ejemplo,
  error,
  className,
}: {
  id: string;
  name: string;
  etiqueta: string;
  /** El nombre del que sale la propuesta. */
  origen: string;
  /** El valor guardado; sin el, se propone. */
  inicial: string | null;
  proponer: (nombre: string) => string;
  largo: number;
  ejemplo: string;
  error?: string;
  className?: string;
}) {
  const [escrito, setEscrito] = useState<string | null>(inicial);
  const valor = escrito ?? proponer(origen);
  const final = limpiarBloque(valor);

  return (
    <div className={className}>
      <Campo
        id={id}
        name={name}
        value={valor}
        onChange={(evento) => setEscrito(evento.target.value)}
        etiqueta={etiqueta}
        placeholder={ejemplo}
        autoComplete="off"
        spellCheck={false}
        maxLength={largo + 10}
        error={error}
        ayuda={
          final.length > largo
            ? `En los archivos: ${final} (sobra: como mucho ${largo} caracteres)`
            : `En los archivos: ${final || "—"}`
        }
      />
    </div>
  );
}
