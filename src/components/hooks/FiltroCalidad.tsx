"use client";

import { useState } from "react";
import { Check } from "lucide-react";

/**
 * Las nueve comprobaciones antes de producir.
 *
 * Es una lista MANUAL y no tiene nada que ver con el algoritmo del auditor.
 * Esa es toda su razon de ser: hay cosas que ninguna lista de expresiones
 * puede comprobar —si el contenido puede demostrar lo que el hook promete, si
 * el tono es de este cliente— y la unica forma de verificarlas es que una
 * persona las mire y lo diga.
 *
 * No se persiste: se marca antes de rodar y se descarta. Guardarla la
 * convertiria en un tramite que se hereda relleno de la pieza anterior.
 */

const COMPROBACIONES = [
  "La audiencia esta definida con un momento o necesidad concreta.",
  "La promesa se comprende de inmediato.",
  "El contenido puede demostrar lo que el hook promete.",
  "El primer fotograma aporta algo por si mismo, en silencio.",
  "La primera senal de valor aparece antes del segundo cuatro.",
  "El Insert-Titulo tiene seis palabras o menos y no es transcripcion.",
  "El tono refleja a este cliente y no una plantilla general.",
  "El CTA corresponde al nivel de confianza de la audiencia.",
  "Los claims tienen validacion de cliente, legal o especialista cuando aplica.",
];

export function FiltroCalidad() {
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set());

  const alternar = (indice: number) =>
    setMarcadas((previas) => {
      const siguientes = new Set(previas);
      if (siguientes.has(indice)) siguientes.delete(indice);
      else siguientes.add(indice);
      return siguientes;
    });

  const total = COMPROBACIONES.length;
  const faltan = total - marcadas.size;
  const completo = faltan === 0;

  return (
    <section
      aria-labelledby="filtro-calidad"
      className="surge rounded-[15px] border border-borde bg-superficie px-[26px] py-6 shadow-[var(--sombra)]"
    >
      <div className="mb-2 flex flex-wrap items-end justify-between gap-4 border-b border-borde pb-4">
        <div>
          <p className="mb-1.5 text-[10.5px] font-bold tracking-[0.1em] text-suave uppercase">
            Filtro de calidad antes de producir
          </p>
          <p
            id="filtro-calidad"
            className="text-xl font-extrabold tracking-[-0.02em]"
          >
            {marcadas.size} de {total} comprobaciones
          </p>
        </div>

        {/*
          El veredicto se anuncia: quien navega con lector de pantalla no ve
          el contador subir, y este es el dato que decide si la pieza sale.
        */}
        <p
          aria-live="polite"
          className={[
            "text-[13px] font-bold",
            completo ? "text-acento" : "text-blackberry dark-tema:text-[#e9a9cd]",
          ].join(" ")}
        >
          {completo
            ? "Las nueve marcadas. Puede pasar a produccion."
            : `Faltan ${faltan}. La pieza no sale a produccion.`}
        </p>
      </div>

      <ul className="grid gap-x-8 sm:grid-cols-2">
        {COMPROBACIONES.map((texto, indice) => {
          const marcada = marcadas.has(indice);

          return (
            <li key={texto} className={indice === total - 1 ? "sm:col-span-2" : ""}>
              <label className="suave flex cursor-pointer items-start gap-[11px] py-[11px]">
                <input
                  type="checkbox"
                  checked={marcada}
                  onChange={() => alternar(indice)}
                  className="sr-only"
                />

                <span
                  aria-hidden="true"
                  className={[
                    "suave mt-px grid size-[19px] shrink-0 place-items-center rounded-md border-[1.5px]",
                    marcada
                      ? "border-acento bg-acento text-acento-contraste"
                      : "border-borde",
                  ].join(" ")}
                >
                  {marcada && <Check className="size-3" strokeWidth={3.5} />}
                </span>

                <span
                  className={[
                    "text-[12.5px] leading-relaxed",
                    marcada ? "" : "text-suave",
                  ].join(" ")}
                >
                  {texto}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
