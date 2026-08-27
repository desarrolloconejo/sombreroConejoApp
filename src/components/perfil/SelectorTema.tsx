"use client";

import type { CSSProperties } from "react";
import { Monitor, Moon, Sun, SunMoon } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useTema } from "@/components/layout/ProveedorTema";
import type { Tema } from "@/types";

/**
 * La eleccion de tema.
 *
 * No guarda nada por su cuenta: llama a `elegir` del proveedor, que ya aplica
 * el cambio al documento al instante y persiste detras. Por eso "Sistema" es
 * una opcion de verdad y no un tercer boton decorativo: deja de fijar el
 * atributo y devuelve el mando a la configuracion del dispositivo.
 */

const TARJETA =
  "surge rounded-[15px] border border-borde bg-superficie p-[22px] shadow-[var(--sombra)]";

const OPCION =
  "grid cursor-pointer place-items-center rounded-[11px] border-[1.5px] px-2 py-[13px] " +

  "suave hover:border-acento";

// El acento ya cambia con el tema, asi que la seleccion no invierte nada a
// mano. El icono va en el color de contraste: sobre fondo de acento, un icono
// de acento es del mismo color que el fondo y no se ve.
const ELEGIDA = "border-acento bg-acento text-acento-contraste";
const SUELTA = "border-borde bg-campo text-texto";

const OPCIONES: { valor: Tema; texto: string; Icono: LucideIcon }[] = [
  { valor: "sistema", texto: "Sistema", Icono: Monitor },
  { valor: "claro", texto: "Claro", Icono: Sun },
  { valor: "oscuro", texto: "Oscuro", Icono: Moon },
];

export function SelectorTema() {
  const { tema, elegir, guardando } = useTema();

  return (
    <section
      style={{ "--retraso": "0.14s" } as CSSProperties}
      className={TARJETA}
      aria-labelledby="perfil-tema"
    >
      <header className="mb-[18px] flex items-center gap-2.5">
        <SunMoon aria-hidden="true" className="size-[17px] shrink-0 text-acento" />
        <div>
          <h2 id="perfil-tema" className="text-[15px] font-bold tracking-[-0.01em]">
            Tema
          </h2>
          <p className="mt-[3px] text-xs text-suave">Se guarda en tu cuenta</p>
        </div>
      </header>

      <div
        // aria-busy en el grupo y no en cada boton: lo que esta ocupado es el
        // guardado, no una opcion concreta.
        aria-busy={guardando || undefined}
        className="grid grid-cols-3 gap-[9px]"
      >
        {OPCIONES.map(({ valor, texto, Icono }) => {
          const activa = tema === valor;

          return (
            <button
              key={valor}
              type="button"
              onClick={() => elegir(valor)}
              aria-pressed={activa}
              className={`${OPCION} ${activa ? ELEGIDA : SUELTA}`}
            >
              <Icono
                aria-hidden="true"
                className={[
                  "size-[19px] shrink-0",
                  activa ? "text-acento-contraste" : "text-suave",
                ].join(" ")}
              />
              <span className="mt-[7px] text-[11.5px] font-semibold">{texto}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
