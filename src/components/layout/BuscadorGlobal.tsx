"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as EventoTeclado,
} from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { aplanar, filtrarPorTermino, type ModuloVista } from "@/lib/navegacion";

/**
 * Buscador global de la barra superior.
 *
 * Busca MODULOS, no registros: lleva a la seccion, y ya dentro cada listado
 * tiene su propia busqueda. Recibe los modulos que esta persona puede ver, asi
 * que no hay forma de que aparezca aqui una seccion a la que no tiene acceso.
 *
 * Sigue el patron combobox: el campo anuncia la lista con aria-controls y
 * senala la opcion resaltada con aria-activedescendant, de modo que el foco
 * nunca sale del campo y quien usa lector de pantalla oye cada resultado
 * mientras recorre con las flechas.
 */
export function BuscadorGlobal({ modulos }: { modulos: ModuloVista[] }) {
  const router = useRouter();
  const [termino, setTermino] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(0);

  const caja = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);

  const id = useId();
  const idLista = `${id}-lista`;
  const idOpcion = (indice: number) => `${id}-opcion-${indice}`;

  /*
   * Se aplana antes de filtrar: sin esto los submodulos no aparecerian
   * nunca, y el buscador global es justo donde mucha gente busca a donde
   * ir en lugar de recorrer el menu.
   *
   * El indice `resaltado` recorre una lista lineal, asi que la jerarquia
   * no puede llegar aqui de otra forma.
   */
  const resultados = filtrarPorTermino(aplanar(modulos), termino);
  const activo = resultados[resaltado];

  // Ctrl+K o Cmd+K desde cualquier sitio: el atajo que ya espera todo el mundo
  useEffect(() => {
    function alPulsar(evento: KeyboardEvent) {
      if (evento.key !== "k" || (!evento.ctrlKey && !evento.metaKey)) return;

      evento.preventDefault();
      campo.current?.focus();
      campo.current?.select();
      setAbierto(true);
    }

    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, []);

  useEffect(() => {
    if (!abierto) return;

    function alApuntar(evento: PointerEvent) {
      if (!caja.current?.contains(evento.target as Node)) setAbierto(false);
    }

    document.addEventListener("pointerdown", alApuntar);
    return () => document.removeEventListener("pointerdown", alApuntar);
  }, [abierto]);

  // Con muchos modulos la opcion resaltada puede quedar fuera del panel
  useEffect(() => {
    if (!abierto) return;

    document
      .getElementById(`${id}-opcion-${resaltado}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [abierto, resaltado, id]);

  function ir(href: string) {
    setAbierto(false);
    setTermino("");
    setResaltado(0);
    campo.current?.blur();
    router.push(href);
  }

  function alTeclear(evento: EventoTeclado<HTMLInputElement>) {
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      setAbierto(true);

      if (resultados.length === 0) return;

      const salto = evento.key === "ArrowDown" ? 1 : -1;
      setResaltado(
        (actual) =>
          (actual + salto + resultados.length) % resultados.length,
      );
      return;
    }

    if (evento.key === "Enter" && activo) {
      evento.preventDefault();
      ir(activo.href);
      return;
    }

    if (evento.key === "Escape") {
      evento.preventDefault();
      setTermino("");
      setAbierto(false);
      campo.current?.blur();
    }
  }

  return (
    <div ref={caja} className="relative w-full max-w-[420px] flex-1">
      <div
        className={[
          "flex items-center gap-[9px] rounded-[10px] border border-borde bg-fondo px-[13px] py-[9px]",
          "text-suave focus-within:border-acento",
        ].join(" ")}
      >
        <Search aria-hidden="true" className="size-4 shrink-0" />

        <input
          ref={campo}
          type="text"
          role="combobox"
          aria-expanded={abierto}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={
            abierto && activo ? idOpcion(resaltado) : undefined
          }
          aria-label="Buscar modulos y secciones"
          placeholder="Buscar modulos y secciones"
          autoComplete="off"
          spellCheck={false}
          value={termino}
          onChange={(evento) => {
            setTermino(evento.target.value);
            setResaltado(0);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          onKeyDown={alTeclear}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-texto outline-none placeholder:text-suave"
        />

        <kbd className="hidden shrink-0 rounded-[5px] border border-borde px-1.5 py-0.5 text-[10.5px] font-semibold opacity-80 xl:block">
          Ctrl K
        </kbd>
      </div>

      {abierto && (
        <div
          className={[
            "absolute inset-x-0 top-[calc(100%+8px)] z-40 overflow-hidden rounded-xl",
            "border border-borde bg-superficie shadow-[var(--sombra-alta)]",
          ].join(" ")}
        >
          <ul
            id={idLista}
            role="listbox"
            aria-label="Modulos"
            className="max-h-[320px] overflow-y-auto p-1.5"
          >
            {resultados.map((modulo, indice) => {
              const resalta = indice === resaltado;

              return (
                <li
                  key={modulo.href}
                  id={idOpcion(indice)}
                  role="option"
                  aria-selected={resalta}
                  onMouseEnter={() => setResaltado(indice)}
                  // Sin esto el campo pierde el foco antes del clic y el panel
                  // se cierra sin llegar a navegar
                  onMouseDown={(evento) => evento.preventDefault()}
                  onClick={() => ir(modulo.href)}
                  className={[
                    "flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5",
                    " ",
                    resalta ? "bg-acento text-acento-contraste" : "",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "grid size-9 shrink-0 place-items-center rounded-[10px] [&_svg]:size-[18px]",
                      resalta ? "bg-acento text-acento-contraste" : "bg-acento text-acento-contraste",
                    ].join(" ")}
                  >
                    {modulo.icono}
                  </span>

                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold">
                      {modulo.titulo}
                    </span>
                    <span
                      className={[
                        "block truncate text-[11.5px]",
                        resalta ? "text-white/70" : "text-suave",
                      ].join(" ")}
                    >
                      {modulo.subtitulo}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>

          {resultados.length === 0 && (
            <p
              role="status"
              className="px-4 py-6 text-center text-[12.5px] text-suave"
            >
              Ningun modulo coincide con esa busqueda
            </p>
          )}
        </div>
      )}
    </div>
  );
}
