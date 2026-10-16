"use client";

import { useRef, useState } from "react";
import { FileCheck2, Upload, X } from "lucide-react";

/**
 * Un campo para subir un archivo que SI se puede estilar.
 *
 * El <input type="file"> del navegador pinta su propio boton, con el texto en
 * el idioma del sistema («Choose File / No file chosen») y sin el tema. Aqui
 * el input real sigue en el formulario —es el que envia el archivo—, pero
 * oculto; lo que se ve es una zona propia:
 *
 *   - Se pulsa (o se activa con el teclado) para elegir el archivo.
 *   - Se puede arrastrar el archivo encima y soltarlo.
 *   - Una vez elegido, dice su nombre y su peso, con un boton para quitarlo.
 *
 * Al soltar un archivo se le asigna al input real con DataTransfer, asi que
 * el formulario lo envia igual que si se hubiera elegido con el dialogo.
 */

type Elegido = { nombre: string; peso: string };

const PESO = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 1 });

function pesoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${PESO.format(bytes / 1024)} KB`;
  return `${PESO.format(bytes / (1024 * 1024))} MB`;
}

export function CampoArchivo({
  id,
  nombre,
  etiqueta,
  accept,
  ayuda,
  error,
  className,
}: {
  id: string;
  /** El nombre con que lo envia el formulario. */
  nombre: string;
  etiqueta: string;
  accept?: string;
  /** Que se admite: «Imagen o PDF, hasta 4 MB». */
  ayuda?: string;
  error?: string;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [elegido, setElegido] = useState<Elegido | null>(null);
  const [encima, setEncima] = useState(false);

  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;

  function leer() {
    const archivo = input.current?.files?.[0];
    setElegido(archivo ? { nombre: archivo.name, peso: pesoLegible(archivo.size) } : null);
  }

  function alSoltar(evento: React.DragEvent) {
    evento.preventDefault();
    setEncima(false);
    const archivo = evento.dataTransfer.files[0];
    if (!archivo || !input.current) return;
    const lista = new DataTransfer();
    lista.items.add(archivo);
    input.current.files = lista.files;
    leer();
  }

  function quitar() {
    if (input.current) input.current.value = "";
    setElegido(null);
    input.current?.focus();
  }

  const descrito = [ayuda ? idAyuda : null, error ? idError : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className}>
      <span id={`${id}-etiqueta`} className="mb-2 block text-xs font-semibold">
        {etiqueta}
      </span>

      {/* El input real: oculto a la vista, pero en el formulario y en el orden del teclado. */}
      <input
        ref={input}
        id={id}
        type="file"
        name={nombre}
        accept={accept}
        onChange={leer}
        aria-labelledby={[`${id}-etiqueta`, ayuda ? idAyuda : null].filter(Boolean).join(" ")}
        aria-describedby={descrito}
        aria-invalid={error ? true : undefined}
        className="peer sr-only"
      />

      {elegido ? (
        <div className="flex min-h-[76px] items-center gap-3 rounded-xl border border-acento bg-acento-tenue px-4 py-3">
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-acento text-acento-contraste [&>svg]:size-[18px]"
          >
            <FileCheck2 />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold" title={elegido.nombre}>
              {elegido.nombre}
            </span>
            <span className="block text-[11.5px] text-suave">
              {elegido.peso}
              {ayuda && <span id={idAyuda} className="sr-only">. {ayuda}</span>}
            </span>
          </span>
          <button
            type="button"
            onClick={quitar}
            aria-label={`Quitar ${elegido.nombre}`}
            title="Quitar"
            className="suave grid size-9 shrink-0 cursor-pointer place-items-center rounded-[10px] text-suave hover:bg-acento hover:text-acento-contraste [&>svg]:size-4"
          >
            <X aria-hidden="true" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          onDragOver={(evento) => {
            evento.preventDefault();
            setEncima(true);
          }}
          onDragLeave={() => setEncima(false)}
          onDrop={alSoltar}
          className={[
            "suave flex min-h-[76px] cursor-pointer items-center gap-3 rounded-xl border-[1.5px] border-dashed px-4 py-3",
            "peer-focus-visible:border-acento peer-focus-visible:shadow-[var(--foco)]",
            encima ? "border-acento bg-acento-tenue" : "border-borde bg-campo hover:border-acento",
            error ? "border-blackberry" : "",
          ].join(" ")}
        >
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-acento-tenue text-acento [&>svg]:size-[18px]"
          >
            <Upload />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold">
              {encima ? "Suelta el archivo aqui" : "Elige un archivo o arrastralo aqui"}
            </span>
            {ayuda && (
              <span id={idAyuda} className="block text-[11.5px] text-suave">
                {ayuda}
              </span>
            )}
          </span>
        </label>
      )}

      {error && (
        <p id={idError} role="alert" className="mt-1.5 text-[11.5px] font-medium text-blackberry dark-tema:text-gold">
          {error}
        </p>
      )}
    </div>
  );
}
