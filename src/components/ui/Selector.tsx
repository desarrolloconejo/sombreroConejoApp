"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

import { ALTO_CONTROL } from "./Campo";
import { useFlotante } from "./useFlotante";

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
 *
 * La lista flota pegada al boton con useFlotante: pintada en el <body> para
 * que una tabla con desplazamiento no la recorte.
 *
 * Es controlado si recibe `valor` (quien lo usa guarda el estado y lo cambia
 * con `onCambio`), y no controlado con `valorInicial`. Sin `nombre` no envia
 * nada: sirve para elegir algo que no es un formulario.
 */

export type OpcionSelector = {
  valor: string;
  texto: string;
  /** Segunda linea, para desambiguar opciones parecidas. */
  detalle?: string;
};

const DISPARADOR =
  "flex w-full cursor-pointer items-center gap-2.5 rounded-xl " +
  "border-[1.5px] border-borde bg-campo text-left " +

  "focus:outline-none focus:border-acento focus:bg-superficie focus:shadow-[var(--foco)] " +
  "disabled:cursor-not-allowed disabled:opacity-60 " +
  "aria-[invalid=true]:border-blackberry";

// Los mismos altos que cualquier control de una linea (ALTO_CONTROL).
const TAMANO = ALTO_CONTROL;

const ALTO_LISTA = 256;

const LISTA =
  "barra-fina-flotante fixed z-50 max-h-64 overflow-y-auto rounded-xl " +
  "border border-borde bg-superficie p-1.5 shadow-[var(--sombra-alta)]";

const OPCION =
  "flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] " +
  "  ";

export function Selector({
  id,
  nombre,
  etiqueta,
  opciones,
  valor: valorControlado,
  valorInicial = "",
  marcador = "Elige una opcion",
  etiquetaOculta,
  compacto,
  error,
  ayuda,
  requerido,
  deshabilitado,
  className,
  onCambio,
}: {
  id: string;
  /** El nombre con que lo envia el formulario. Sin el, no envia nada. */
  nombre?: string;
  etiqueta: string;
  opciones: OpcionSelector[];
  /** Si viene, el selector es controlado: muestra esto y avisa con onCambio. */
  valor?: string;
  valorInicial?: string;
  marcador?: string;
  /** La etiqueta solo la oye el lector de pantalla: para celdas de una tabla. */
  etiquetaOculta?: boolean;
  /** Mas bajo, para filas y filtros. */
  compacto?: boolean;
  error?: string;
  ayuda?: string;
  requerido?: boolean;
  deshabilitado?: boolean;
  className?: string;
  onCambio?: (valor: string) => void;
}) {
  const [valorPropio, setValorPropio] = useState(valorInicial);
  const valor = valorControlado ?? valorPropio;
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

  const { posicion, colocar } = useFlotante({
    abierto,
    cerrar: () => setAbierto(false),
    ancla: caja,
    medida: disparador,
    panel: lista,
    alto: ALTO_LISTA,
  });

  // La opcion resaltada tiene que verse aunque la lista este desplazada.
  useEffect(() => {
    if (!abierto) return;

    // Se mueve solo la lista: scrollIntoView desplazaria tambien la pagina.
    const caja = lista.current;
    const opcion = caja?.querySelector<HTMLElement>(`[data-indice="${resaltado}"]`);
    if (!caja || !opcion) return;
    if (opcion.offsetTop < caja.scrollTop) {
      caja.scrollTop = opcion.offsetTop;
    } else if (opcion.offsetTop + opcion.offsetHeight > caja.scrollTop + caja.clientHeight) {
      caja.scrollTop = opcion.offsetTop + opcion.offsetHeight - caja.clientHeight;
    }
  }, [abierto, resaltado]);

  function abrir(indice?: number) {
    colocar();
    setResaltado(
      indice ?? Math.max(0, opciones.findIndex((o) => o.valor === valor)),
    );
    setAbierto(true);
  }

  function elegir(indice: number) {
    const opcion = opciones[indice];
    if (!opcion) return;

    setValorPropio(opcion.valor);
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
        className={etiquetaOculta ? "sr-only" : "mb-2 block text-xs font-semibold"}
        onClick={() => disparador.current?.focus()}
      >
        {etiqueta}
      </label>

      <div ref={caja} className="relative">
        {/* Lo que de verdad envia el formulario. El boton es solo la fachada.
            Deshabilitado no se envia, igual que un control nativo. */}
        {nombre && <input type="hidden" name={nombre} value={valor} disabled={deshabilitado} />}

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
          className={`${DISPARADOR} ${compacto ? TAMANO.compacto : TAMANO.normal}`}
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

        {abierto && createPortal(
          <ul
            ref={lista}
            id={idLista}
            role="listbox"
            aria-label={etiqueta}
            className={LISTA}
            style={posicion}
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
          </ul>,
          document.body,
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
