"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * Volver a la pagina anterior sin salir de la aplicacion.
 *
 * El «atras» del navegador puede sacar de la app: si se llego por un enlace
 * de un correo, la pagina anterior es el correo. Por eso se lleva un rastro
 * propio de las paginas visitadas DENTRO del panel, en sessionStorage (dura
 * lo que la pestana). Si hay una anterior en el rastro, «Volver» hace lo
 * mismo que el navegador; si se entro directo, sube al nivel de arriba (la
 * miga anterior), que siempre existe.
 */

const CLAVE = "conejo:rastro";
const TOPE = 50;

function leerRastro(): string[] {
  try {
    const crudo = window.sessionStorage.getItem(CLAVE);
    const rastro: unknown = crudo ? JSON.parse(crudo) : [];
    return Array.isArray(rastro) ? rastro.filter((paso) => typeof paso === "string") : [];
  } catch {
    return [];
  }
}

function guardarRastro(rastro: string[]) {
  try {
    window.sessionStorage.setItem(CLAVE, JSON.stringify(rastro.slice(-TOPE)));
  } catch {
    // Sin almacenamiento (ventana privada estricta): «Volver» sube un nivel.
  }
}

/** Anota cada pagina del panel. Va una vez en el layout y no pinta nada. */
export function RastroNavegacion() {
  const ruta = usePathname();

  useEffect(() => {
    const rastro = leerRastro();
    if (rastro.at(-1) === ruta) return;

    // Llegar a la penultima es haber vuelto: se quita la ultima.
    if (rastro.at(-2) === ruta) rastro.pop();
    else rastro.push(ruta);

    guardarRastro(rastro);
  }, [ruta]);

  return null;
}

export function BotonVolver({ hrefArriba }: { hrefArriba: string }) {
  const router = useRouter();

  function volver() {
    if (leerRastro().length >= 2) router.back();
    else router.push(hrefArriba);
  }

  return (
    <button
      type="button"
      onClick={volver}
      className={[
        "suave inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-[10px] border border-borde px-2.5",
        "text-[12px] font-semibold text-suave",
        "hover:-translate-y-0.5 hover:border-acento hover:bg-acento hover:text-acento-contraste",
        "focus-visible:outline-none focus-visible:shadow-[var(--foco)] [&>svg]:size-3.5",
      ].join(" ")}
    >
      <ArrowLeft aria-hidden="true" />
      Volver
    </button>
  );
}
