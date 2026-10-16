"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import {
  acotar,
  dentroDe,
  diaDeSemana,
  escribirFecha,
  leerFecha,
  piezasDe,
  semanasDelMes,
  sumarDias,
  sumarMeses,
} from "@/lib/calendario";
import { hoyEnCaracas } from "@/lib/fechas";
import { CLASE_CONTROL } from "./Campo";
import { useFlotante } from "./useFlotante";

/**
 * Un campo de fecha que SI se puede estilar.
 *
 * El calendario de <input type="date"> lo pinta el sistema operativo, con
 * sus colores y no con los del tema. Aqui el calendario es propio, y se usa
 * igual en escritorio y en el telefono.
 *
 * Son dos piezas:
 *
 *   - Un cuadro de texto donde se puede ESCRIBIR la fecha: acepta 14/11/2026
 *     y tambien 2026-11-14. Al salir, se muestra como dd/mm/aaaa. Si lo
 *     escrito no es una fecha, se marca y el formulario recibe vacio: la
 *     action responde con su error de siempre.
 *   - Un boton que abre el calendario, con el patron de ARIA para elegir
 *     fecha: un dialogo con una rejilla de dias. Teclado completo: flechas
 *     (dia y semana), Re Pag y Av Pag (mes), Mayus con ellas (ano), Inicio y
 *     Fin (semana), Enter para elegir y Escape para cerrar.
 *
 * Lo que envia el formulario va en un input oculto, en aaaa-mm-dd, igual que
 * el control nativo: las actions no notan la diferencia.
 */

/**
 * El panel mide siempre lo mismo: seis semanas, el titulo en una linea y
 * filas de alto fijo. Si cambiara con el mes (hay meses de cuatro, cinco y
 * seis semanas, y nombres largos como septiembre), saltaria al pasar de uno
 * a otro y las flechas se moverian bajo el dedo.
 *
 * 12 + 40 (cabecera) + 28 (dias) + 6 x 40 (semanas) + 52 (pie) + 12 + 2 de
 * borde = 386. Se reserva algo mas: si el tope quedara justo, el panel
 * sacaria una barra de desplazamiento por un pixel.
 */
const SEMANAS_VISIBLES = 6;
const ALTO_PANEL = 392;
const ANCHO_PANEL = 320;

const DIAS_SEMANA = [
  { corto: "L", largo: "lunes" },
  { corto: "M", largo: "martes" },
  { corto: "M", largo: "miercoles" },
  { corto: "J", largo: "jueves" },
  { corto: "V", largo: "viernes" },
  { corto: "S", largo: "sabado" },
  { corto: "D", largo: "domingo" },
];

// En UTC: un dia del calendario no tiene zona, y en hora de Caracas las
// 00:00 UTC del 14 son todavia el 13.
const MES = new Intl.DateTimeFormat("es-VE", { timeZone: "UTC", month: "long", year: "numeric" });
const DIA_COMPLETO = new Intl.DateTimeFormat("es-VE", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function comoFecha(iso: string): Date {
  const { ano, mes, dia } = piezasDe(iso) ?? { ano: 1970, mes: 1, dia: 1 };
  return new Date(Date.UTC(ano, mes - 1, dia));
}

const BOTON_NAVEGAR =
  "suave grid size-8 cursor-pointer place-items-center rounded-lg text-suave " +
  "hover:-translate-y-0.5 hover:bg-acento hover:text-acento-contraste " +
  "focus-visible:outline-none focus-visible:shadow-[var(--foco)] " +
  "disabled:pointer-events-none disabled:opacity-40 [&>svg]:size-4";

export function CampoFecha({
  id,
  nombre,
  etiqueta,
  valor: valorControlado,
  valorInicial = "",
  min,
  max,
  etiquetaOculta,
  compacto,
  opcional,
  error,
  ayuda,
  deshabilitado,
  className,
  onCambio,
}: {
  id: string;
  /** El nombre con que lo envia el formulario. Sin el, no envia nada. */
  nombre?: string;
  etiqueta: string;
  /** Si viene, es controlado: muestra esta fecha (aaaa-mm-dd) y avisa con onCambio. */
  valor?: string;
  valorInicial?: string;
  min?: string;
  max?: string;
  /** La etiqueta solo la oye el lector de pantalla: para filas que ya la muestran. */
  etiquetaOculta?: boolean;
  /** Mas bajo, para filas. */
  compacto?: boolean;
  /** Se puede dejar vacia: el calendario ofrece «Borrar». */
  opcional?: boolean;
  error?: string;
  ayuda?: string;
  deshabilitado?: boolean;
  className?: string;
  onCambio?: (valor: string) => void;
}) {
  const [valorPropio, setValorPropio] = useState(valorInicial);
  const valor = valorControlado ?? valorPropio;

  const [texto, setTexto] = useState(escribirFecha(valor));
  const [visto, setVisto] = useState(valor);
  // Si la fecha cambia desde fuera (otra action, un reinicio), el texto la sigue.
  if (valor !== visto) {
    setVisto(valor);
    setTexto(escribirFecha(valor));
  }

  const [abierto, setAbierto] = useState(false);
  const [foco, setFoco] = useState("");
  const [hoy, setHoy] = useState("");

  const caja = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const idTitulo = useId();
  const idError = `${id}-error`;
  const idAyuda = `${id}-ayuda`;

  const { posicion, colocar } = useFlotante({
    abierto,
    cerrar: () => setAbierto(false),
    ancla: caja,
    panel,
    alto: ALTO_PANEL,
    anchoFijo: ANCHO_PANEL,
  });

  // Lo escrito no es una fecha: se marca, y el formulario recibe vacio.
  const malEscrita = texto.trim() !== "" && leerFecha(texto) === null;

  // El dia con el foco recibe el foco de verdad al abrir y al moverse.
  useEffect(() => {
    if (!abierto || !foco) return;
    panel.current?.querySelector<HTMLButtonElement>(`[data-dia="${foco}"]`)?.focus();
  }, [abierto, foco]);

  function fijar(nuevo: string) {
    setValorPropio(nuevo);
    setVisto(nuevo);
    onCambio?.(nuevo);
  }

  function alEscribir(escrito: string) {
    setTexto(escrito);
    const fecha = leerFecha(escrito);
    if (fecha !== null) fijar(fecha);
    else if (valor !== "") fijar("");
  }

  function abrir() {
    const hoyCaracas = hoyEnCaracas();
    setHoy(hoyCaracas);
    setFoco(acotar(valor || hoyCaracas, min, max));
    colocar();
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
    boton.current?.focus();
  }

  function elegir(dia: string) {
    if (!dentroDe(dia, min, max)) return;
    fijar(dia);
    setTexto(escribirFecha(dia));
    cerrar();
  }

  function borrar() {
    fijar("");
    setTexto("");
    cerrar();
  }

  function mover(nuevo: string) {
    setFoco(acotar(nuevo, min, max));
  }

  function alPulsarTecla(evento: React.KeyboardEvent) {
    const atajos: Record<string, () => string> = {
      ArrowLeft: () => sumarDias(foco, -1),
      ArrowRight: () => sumarDias(foco, 1),
      ArrowUp: () => sumarDias(foco, -7),
      ArrowDown: () => sumarDias(foco, 7),
      PageUp: () => sumarMeses(foco, evento.shiftKey ? -12 : -1),
      PageDown: () => sumarMeses(foco, evento.shiftKey ? 12 : 1),
      Home: () => sumarDias(foco, -diaDeSemana(foco)),
      End: () => sumarDias(foco, 6 - diaDeSemana(foco)),
    };

    if (evento.key === "Escape") {
      evento.preventDefault();
      cerrar();
      return;
    }

    const atajo = atajos[evento.key];
    if (atajo && foco) {
      evento.preventDefault();
      mover(atajo());
    }
  }

  const visible = piezasDe(foco);
  const semanas = visible ? semanasDelMes(visible.ano, visible.mes) : [];
  // Siempre seis semanas: las que faltan se completan con el mes siguiente.
  while (semanas.length > 0 && semanas.length < SEMANAS_VISIBLES) {
    const ultimo = semanas[semanas.length - 1][6];
    semanas.push(Array.from({ length: 7 }, (_, i) => sumarDias(ultimo, i + 1)));
  }
  const primeroDelMes = visible ? foco.slice(0, 8) + "01" : "";

  const descrito =
    [error ? idError : null, ayuda ? idAyuda : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className={etiquetaOculta ? "sr-only" : "mb-2 block text-xs font-semibold"}>
        {etiqueta}
      </label>

      <div ref={caja} className="relative">
        {nombre && <input type="hidden" name={nombre} value={valor} disabled={deshabilitado} />}

        <input
          ref={campo}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="dd/mm/aaaa"
          value={texto}
          disabled={deshabilitado}
          onChange={(evento) => alEscribir(evento.target.value)}
          onBlur={() => {
            if (!malEscrita) setTexto(escribirFecha(valor));
          }}
          aria-invalid={error || malEscrita ? true : undefined}
          aria-describedby={descrito}
          className={[
            CLASE_CONTROL,
            "pr-11 tabular-nums",
            compacto ? "min-h-9 py-2 text-[13px]" : "",
          ].join(" ")}
        />

        <button
          ref={boton}
          type="button"
          aria-label="Abrir el calendario"
          aria-haspopup="dialog"
          aria-expanded={abierto}
          title="Abrir el calendario"
          disabled={deshabilitado}
          onClick={() => (abierto ? setAbierto(false) : abrir())}
          className={[
            "suave absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-suave",
            "hover:bg-acento hover:text-acento-contraste",
            "focus-visible:outline-none focus-visible:shadow-[var(--foco)]",
            "disabled:pointer-events-none disabled:opacity-60 [&>svg]:size-4",
          ].join(" ")}
        >
          <CalendarDays aria-hidden="true" />
        </button>

        {abierto &&
          visible &&
          createPortal(
            <div
              ref={panel}
              role="dialog"
              aria-modal="false"
              aria-labelledby={idTitulo}
              onKeyDown={alPulsarTecla}
              style={posicion}
              className="fixed z-50 overflow-y-auto rounded-2xl border border-borde bg-superficie p-3 shadow-[var(--sombra-alta)] select-none"
            >
              <div className="flex h-10 items-center gap-0.5">
                <button type="button" aria-label="Ano anterior" className={BOTON_NAVEGAR} onClick={() => mover(sumarMeses(foco, -12))}>
                  <ChevronsLeft aria-hidden="true" />
                </button>
                <button type="button" aria-label="Mes anterior" className={BOTON_NAVEGAR} onClick={() => mover(sumarMeses(foco, -1))}>
                  <ChevronLeft aria-hidden="true" />
                </button>
                <p
                  id={idTitulo}
                  aria-live="polite"
                  className="min-w-0 flex-1 truncate text-center text-[13.5px] font-bold whitespace-nowrap first-letter:uppercase"
                >
                  {MES.format(comoFecha(primeroDelMes))}
                </p>
                <button type="button" aria-label="Mes siguiente" className={BOTON_NAVEGAR} onClick={() => mover(sumarMeses(foco, 1))}>
                  <ChevronRight aria-hidden="true" />
                </button>
                <button type="button" aria-label="Ano siguiente" className={BOTON_NAVEGAR} onClick={() => mover(sumarMeses(foco, 12))}>
                  <ChevronsRight aria-hidden="true" />
                </button>
              </div>

              <table role="grid" aria-labelledby={idTitulo} className="w-full border-collapse text-center">
                <thead>
                  <tr>
                    {DIAS_SEMANA.map((dia) => (
                      <th key={dia.largo} scope="col" abbr={dia.largo} className="h-7 text-[11px] font-semibold text-suave">
                        {dia.corto}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {semanas.map((semana) => (
                    <tr key={semana[0]}>
                      {semana.map((dia) => {
                        const delMes = dia.slice(0, 7) === foco.slice(0, 7);
                        const elegido = dia === valor;
                        const permitido = dentroDe(dia, min, max);
                        return (
                          <td key={dia} className="h-10 p-0.5">
                            <button
                              type="button"
                              data-dia={dia}
                              tabIndex={dia === foco ? 0 : -1}
                              aria-label={DIA_COMPLETO.format(comoFecha(dia))}
                              aria-pressed={elegido}
                              aria-current={dia === hoy ? "date" : undefined}
                              disabled={!permitido}
                              onClick={() => elegir(dia)}
                              className={[
                                "suave grid size-9 w-full cursor-pointer place-items-center rounded-lg text-[13px] tabular-nums",
                                "focus-visible:outline-none focus-visible:shadow-[var(--foco)]",
                                "disabled:cursor-not-allowed disabled:opacity-30 disabled:line-through",
                                elegido
                                  ? "bg-acento font-bold text-acento-contraste"
                                  : [
                                      "hover:bg-acento-tenue",
                                      delMes ? "text-texto" : "text-suave/60",
                                      dia === hoy ? "border border-acento font-semibold" : "",
                                    ].join(" "),
                              ].join(" ")}
                            >
                              {Number(dia.slice(8))}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-1 flex h-12 items-center justify-between gap-2 border-t border-borde pt-1">
                <button
                  type="button"
                  disabled={!dentroDe(hoy, min, max)}
                  onClick={() => elegir(hoy)}
                  className="suave rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-acento hover:bg-acento-tenue disabled:pointer-events-none disabled:opacity-40"
                >
                  Hoy
                </button>
                {opcional && (
                  <button
                    type="button"
                    onClick={borrar}
                    className="suave rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-suave hover:bg-acento-tenue"
                  >
                    Borrar
                  </button>
                )}
              </div>
            </div>,
            document.body,
          )}
      </div>

      {ayuda && !error && (
        <p id={idAyuda} className="mt-1.5 text-[11.5px] leading-relaxed text-suave">
          {malEscrita ? "Escribela asi: dd/mm/aaaa" : ayuda}
        </p>
      )}
      {!ayuda && !error && malEscrita && (
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-suave">Escribela asi: dd/mm/aaaa</p>
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
