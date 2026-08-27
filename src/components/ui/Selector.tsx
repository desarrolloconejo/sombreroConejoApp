"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

/**
 * Un desplegable que SI se puede estilar.
 *
 * El <select> del navegador no admite estilos en su lista: la pinta el sistema
 * operativo, con sus propios colores. Por eso en Windows salia una lista azul
 * que no se parecia en nada al tema de la aplicacion.
 *
 * Se sustituye por el patron de ARIA para un combobox: un boton que abre una
 * lista de opciones. Como deja de ser un control nativo, hay que reponer a
 * mano todo lo que el navegador daba gratis:
 *
 *   - Teclado completo: flechas, Inicio, Fin, Enter, Espacio, Escape y
 *     busqueda escribiendo las primeras letras.
 *   - Semantica: combobox, listbox y option, con aria-selected y
 *     aria-activedescendant para que un lector de pantalla lo lea igual.
 *   - Un input oculto con el valor, para que el formulario lo envie como
 *     cualquier otro campo.
 *
 * Si esto no estuviera, seria un desplegable bonito e inutilizable sin raton.
 */

export type OpcionSelector = {
  valor: string;
  texto: string;
  /** Segunda linea, para desambiguar opciones parecidas. */
  detalle?: string;
};

const DISPARADOR =
  "flex w-full min-h-11 cursor-pointer items-center gap-2.5 rounded-xl " +
  "border-[1.5px] border-borde bg-campo px-3.5 py-3 text-left text-[13.5px] " +

  "focus:outline-none focus:border-acento focus:bg-superficie focus:shadow-[var(--foco)] " +
  "disabled:cursor-not-allowed disabled:opacity-60 " +
  "aria-[invalid=true]:border-blackberry";

const LISTA =
  "absolute z-30 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl " +
  "border border-borde bg-superficie p-1.5 shadow-[var(--sombra-alta)]";

const OPCION =
  "flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] " +
  "  ";

export function Selector({
  id,
  nombre,
  etiqueta,
  opciones,
  valorInicial = "",
  marcador = "Elige una opcion",
  error,
  ayuda,
  requerido,
  deshabilitado,
  className,
  onCambio,
}: {
  id: string;
  nombre: string;
  etiqueta: string;
  opciones: OpcionSelector[];
  valorInicial?: string;
  marcador?: string;
  error?: string;
  ayuda?: string;
  requerido?: boolean;
  deshabilitado?: boolean;
  className?: string;
  onCambio?: (valor: string) => void;
}) {
  const [valor, setValor] = useState(valorInicial);
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(0);

  const caja = useRef<HTMLDivElement>(null);
  const disparador = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLUListElement>(null);

  // Lo que se lleva escrito para la busqueda por teclado, y cuando caduca.
  const escrito = useRef({ texto: "", momento: 0 });

  const idLista = useId();
  const idError = `${id}-error`;
  const idAyuda = `${id}-ayuda`;

  const elegida = opciones.find((o) => o.valor === valor) ?? null;

  // Cerrar al pulsar fuera. Se escucha en captura para que un clic sobre otro
  // desplegable cierre este antes de que aquel se abra.
  useEffect(() => {
    if (!abierto) return;

    function alPulsarFuera(evento: MouseEvent) {
      if (!caja.current?.contains(evento.target as Node)) setAbierto(false);
    }

    document.addEventListener("pointerdown", alPulsarFuera, true);
    return () => document.removeEventListener("pointerdown", alPulsarFuera, true);
  }, [abierto]);

  // La opcion resaltada tiene que verse aunque la lista este desplazada.
  useEffect(() => {
    if (!abierto) return;

    lista.current
      ?.querySelector<HTMLElement>(`[data-indice="${resaltado}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [abierto, resaltado]);

  function abrir(indice?: number) {
    setResaltado(
      indice ?? Math.max(0, opciones.findIndex((o) => o.valor === valor)),
    );
    setAbierto(true);
  }

  function elegir(indice: number) {
    const opcion = opciones[indice];
    if (!opcion) return;

    setValor(opcion.valor);
    setAbierto(false);
    disparador.current?.focus();
    onCambio?.(opcion.valor);
  }

  /** Busqueda escribiendo: "adm" lleva a Administracion. */
  function buscarEscribiendo(letra: string) {
    const ahora = Date.now();
    const texto =
      ahora - escrito.current.momento > 700
        ? letra
        : escrito.current.texto + letra;

    escrito.current = { texto, momento: ahora };

    const encontrado = opciones.findIndex((o) =>
      o.texto.toLowerCase().startsWith(texto.toLowerCase()),
    );

    if (encontrado === -1) return;

    if (abierto) setResaltado(encontrado);
    else elegir(encontrado);
  }

  function alPulsarTecla(evento: React.KeyboardEvent) {
    switch (evento.key) {
      case "ArrowDown":
        evento.preventDefault();
        if (!abierto) abrir();
        else setResaltado((i) => Math.min(i + 1, opciones.length - 1));
        break;

      case "ArrowUp":
        evento.preventDefault();
        if (!abierto) abrir();
        else setResaltado((i) => Math.max(i - 1, 0));
        break;

      case "Home":
        if (abierto) {
          evento.preventDefault();
          setResaltado(0);
        }
        break;

      case "End":
        if (abierto) {
          evento.preventDefault();
          setResaltado(opciones.length - 1);
        }
        break;

      case "Enter":
      case " ":
        evento.preventDefault();
        if (abierto) elegir(resaltado);
        else abrir();
        break;

      case "Escape":
        if (abierto) {
          evento.preventDefault();
          setAbierto(false);
        }
        break;

      case "Tab":
        setAbierto(false);
        break;

      default:
        if (evento.key.length === 1 && !evento.metaKey && !evento.ctrlKey) {
          buscarEscribiendo(evento.key);
        }
    }
  }

  const descrito =
    [error ? idError : null, ayuda ? idAyuda : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-2 block text-xs font-semibold"
        onClick={() => disparador.current?.focus()}
      >
        {etiqueta}
      </label>

      <div ref={caja} className="relative">
        {/* Lo que de verdad envia el formulario. El boton es solo la fachada. */}
        <input type="hidden" name={nombre} value={valor} />

        <button
          ref={disparador}
          id={id}
          type="button"
          role="combobox"
          aria-expanded={abierto}
          aria-controls={idLista}
          aria-haspopup="listbox"
          aria-required={requerido}
          aria-invalid={error ? true : undefined}
          aria-describedby={descrito}
          aria-activedescendant={
            abierto ? `${idLista}-${resaltado}` : undefined
          }
          disabled={deshabilitado}
          onClick={() => (abierto ? setAbierto(false) : abrir())}
          onKeyDown={alPulsarTecla}
          className={DISPARADOR}
        >
          <span
            className={[
              "min-w-0 flex-1 truncate",
              elegida ? "text-texto" : "text-suave",
            ].join(" ")}
          >
            {elegida?.texto ?? marcador}
          </span>

          <ChevronDown
            aria-hidden="true"
            className={[
              "suave size-4 shrink-0 text-suave",
              abierto ? "rotate-180" : "",
            ].join(" ")}
          />
        </button>

        {abierto && (
          <ul
            ref={lista}
            id={idLista}
            role="listbox"
            aria-label={etiqueta}
            className={LISTA}
          >
            {opciones.map((opcion, indice) => {
              const seleccionada = opcion.valor === valor;
              const activa = indice === resaltado;

              return (
                <li
                  key={opcion.valor || "vacio"}
                  id={`${idLista}-${indice}`}
                  role="option"
                  aria-selected={seleccionada}
                  data-indice={indice}
                  onMouseEnter={() => setResaltado(indice)}
                  onClick={() => elegir(indice)}
                  className={[
                    OPCION,
                    seleccionada
                      ? "bg-acento font-semibold text-acento-contraste"
                      : activa
                        ? "bg-acento-tenue text-texto"
                        : "text-texto",
                  ].join(" ")}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{opcion.texto}</span>
                    {opcion.detalle && (
                      <span
                        className={[
                          "mt-0.5 block truncate text-[11.5px]",
                          seleccionada ? "opacity-80" : "text-suave",
                        ].join(" ")}
                      >
                        {opcion.detalle}
                      </span>
                    )}
                  </span>

                  {seleccionada && (
                    <Check aria-hidden="true" className="size-4 shrink-0" />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {ayuda && !error && (
        <p id={idAyuda} className="mt-1.5 text-[11.5px] leading-relaxed text-suave">
          {ayuda}
        </p>
      )}

      {error && (
        <p
          id={idError}
          role="alert"
          className="mt-1.5 text-[11.5px] leading-relaxed font-medium text-blackberry dark-tema:text-[#e9a9cd]"
        >
          {error}
        </p>
      )}
    </div>
  );
}
