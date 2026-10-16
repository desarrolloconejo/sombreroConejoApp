"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ListTree, X } from "lucide-react";

/**
 * El indice de la pagina: un boton flotante, abajo a la derecha, que abre la
 * lista de secciones y lleva a cada una.
 *
 * Las paginas largas esconden lo que hay abajo: una pieza tiene versiones,
 * copy, decisiones y comentarios bajo las fases, y no se ve que estan. El
 * indice lo dice sin tocar ninguna maqueta: no ocupa columna ni barra, se
 * monta una vez en el layout y lee los titulos de seccion (los <h2> del
 * <main>) que cada page ya tiene. Una page nueva lo trae sin hacer nada.
 *
 * Solo aparece si hay al menos tres secciones: con menos, se ve todo.
 */

type Seccion = { id: string; texto: string };

const MINIMO = 3;

function slug(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Los titulos de seccion visibles del <main>, con un id para poder ir a ellos. */
function leerSecciones(): Seccion[] {
  const main = document.querySelector("main");
  if (!main) return [];

  const vistos = new Set<string>();
  return [...main.querySelectorAll<HTMLHeadingElement>("h2")]
    .filter((titulo) => titulo.offsetParent !== null && !titulo.closest('[role="dialog"]'))
    .map((titulo) => {
      const texto = titulo.textContent?.trim() ?? "";
      if (!titulo.id) {
        let id = `seccion-${slug(texto) || "sin-titulo"}`;
        while (vistos.has(id) || document.getElementById(id)) id += "-2";
        titulo.id = id;
      }
      vistos.add(titulo.id);
      return { id: titulo.id, texto };
    })
    .filter((seccion) => seccion.texto !== "");
}

export function IndicePagina() {
  const ruta = usePathname();
  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [activa, setActiva] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  // Se relee al cambiar de pagina y cuando el contenido cambia (un panel que
  // se abre, una seccion que aparece al guardar).
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;

    let cuadro = 0;
    const releer = () => {
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(() => {
        const nuevas = leerSecciones();
        setSecciones((previas) =>
          previas.length === nuevas.length && previas.every((s, i) => s.id === nuevas[i].id && s.texto === nuevas[i].texto)
            ? previas
            : nuevas,
        );
      });
    };

    releer();
    const observador = new MutationObserver(releer);
    observador.observe(main, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(cuadro);
      observador.disconnect();
    };
  }, [ruta]);

  // Cerrar al cambiar de pagina.
  const [rutaVista, setRutaVista] = useState(ruta);
  if (ruta !== rutaVista) {
    setRutaVista(ruta);
    setAbierto(false);
  }

  // La seccion en pantalla: la ultima cuyo titulo ya paso el tercio de arriba.
  useEffect(() => {
    if (secciones.length < MINIMO) return;

    const titulos = secciones
      .map((seccion) => document.getElementById(seccion.id))
      .filter((titulo): titulo is HTMLElement => titulo !== null);

    const observador = new IntersectionObserver(
      (entradas) => {
        const visibles = entradas.filter((e) => e.isIntersecting);
        if (visibles.length > 0) setActiva(visibles[0].target.id);
      },
      { rootMargin: "-15% 0px -65% 0px" },
    );
    titulos.forEach((titulo) => observador.observe(titulo));
    return () => observador.disconnect();
  }, [secciones]);

  // Escape y pulsar fuera cierran.
  useEffect(() => {
    if (!abierto) return;
    function alPulsarFuera(evento: PointerEvent) {
      if (!caja.current?.contains(evento.target as Node)) setAbierto(false);
    }
    function alPulsarTecla(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAbierto(false);
    }
    document.addEventListener("pointerdown", alPulsarFuera, true);
    document.addEventListener("keydown", alPulsarTecla);
    return () => {
      document.removeEventListener("pointerdown", alPulsarFuera, true);
      document.removeEventListener("keydown", alPulsarTecla);
    };
  }, [abierto]);

  if (secciones.length < MINIMO) return null;

  function ir(id: string) {
    const titulo = document.getElementById(id);
    if (!titulo) return;
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    titulo.scrollIntoView({ behavior: quieto ? "auto" : "smooth", block: "start" });
    // Si el desplazamiento suave no llego (una pestana que no dibuja, un
    // navegador que lo corta), se salta directo: el indice tiene que llevar.
    window.setTimeout(() => {
      if (Math.abs(titulo.getBoundingClientRect().top - 88) > 48) {
        titulo.scrollIntoView({ behavior: "auto", block: "start" });
      }
    }, 900);
    // El foco va al titulo, para que el lector de pantalla siga desde ahi.
    if (!titulo.hasAttribute("tabindex")) titulo.setAttribute("tabindex", "-1");
    titulo.focus({ preventScroll: true });
    setActiva(id);
    setAbierto(false);
  }

  return (
    <div ref={caja} className="fixed right-4 bottom-4 z-30 lg:right-8 lg:bottom-8">
      {abierto && (
        <nav
          aria-label="En esta pagina"
          className="surge barra-fina-flotante absolute right-0 bottom-full mb-2.5 max-h-[60vh] w-[268px] overflow-y-auto rounded-2xl border border-borde bg-superficie p-2 shadow-[var(--sombra-alta)]"
        >
          <p className="px-2.5 pt-1.5 pb-2 text-[11px] font-bold tracking-[0.08em] text-suave uppercase">
            En esta pagina
          </p>
          <ol className="flex flex-col gap-0.5">
            {secciones.map((seccion, indice) => {
              // Hasta que una seccion pase por la zona de lectura, la primera.
              const actual = activa ? seccion.id === activa : indice === 0;
              return (
                <li key={seccion.id}>
                  <button
                    type="button"
                    onClick={() => ir(seccion.id)}
                    aria-current={actual ? "location" : undefined}
                    className={[
                      "suave flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px]",
                      actual ? "bg-acento-tenue font-semibold text-texto" : "text-suave hover:bg-campo hover:text-texto",
                    ].join(" ")}
                  >
                    <span
                      aria-hidden="true"
                      className={["size-1.5 shrink-0 rounded-full", actual ? "bg-acento" : "bg-borde"].join(" ")}
                    />
                    <span className="min-w-0 truncate">{seccion.texto}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      <button
        type="button"
        onClick={() => setAbierto((antes) => !antes)}
        aria-expanded={abierto}
        aria-label={abierto ? "Cerrar el indice" : `Indice de la pagina: ${secciones.length} secciones`}
        title="Indice de la pagina"
        className={[
          "suave relative grid size-12 cursor-pointer place-items-center rounded-full border shadow-[var(--sombra-alta)]",
          "hover:-translate-y-0.5 focus-visible:outline-none focus-visible:shadow-[var(--foco)] [&>svg]:size-5",
          abierto
            ? "border-acento bg-acento text-acento-contraste"
            : "border-borde bg-superficie text-texto hover:border-acento",
        ].join(" ")}
      >
        {abierto ? <X aria-hidden="true" /> : <ListTree aria-hidden="true" />}
        {!abierto && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-acento px-1 text-[10.5px] font-bold text-acento-contraste tabular-nums"
          >
            {secciones.length}
          </span>
        )}
      </button>
    </div>
  );
}
