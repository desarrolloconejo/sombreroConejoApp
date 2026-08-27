"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Search, X } from "lucide-react";

import type { EstadoListado } from "@/types";
import { PARAMETROS } from "@/lib/parametros";
import { camposOcultos, conBusqueda } from "@/lib/urlListado";

/**
 * Buscador del listado. Busca mientras se escribe.
 *
 * Sigue siendo un <form method="get"> de verdad, y eso no es decorativo: si el
 * JavaScript no ha cargado todavia o falla, pulsar Enter envia el formulario y
 * la busqueda funciona igual. Lo que anade el cliente es adelantarse a ese
 * Enter, no sustituirlo.
 *
 * Tres decisiones que conviene no deshacer:
 *
 * 1. Se navega con `replace`, no con `push`. Con push, cada letra dejaria una
 *    entrada en el historial y volver atras obligaria a pulsar una vez por
 *    caracter tecleado.
 *
 * 2. El campo se queda SIN controlar. Si su valor viniera del servidor, cada
 *    respuesta lo reescribiria, y al escribir rapido el cursor saltaria al
 *    final o se perderian letras mientras la respuesta va y viene.
 *
 * 3. `scroll: false`. Sin eso la pagina sube al principio en cada pulsacion.
 */

/**
 * Cuanto se espera desde la ultima tecla.
 *
 * 350 ms es aproximadamente la pausa natural entre palabras: lo bastante para
 * no consultar por cada letra de "distribuidora", y lo bastante poco para que
 * el resultado parezca inmediato al dejar de escribir.
 */
const ESPERA = 350;

export function ListadoBuscador({
  ruta,
  estado,
  etiqueta = "Buscar",
  marcador = "Buscar",
  id = "listado-busqueda",
}: {
  ruta: string;
  estado: EstadoListado;
  etiqueta?: string;
  marcador?: string;
  id?: string;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();

  const campo = useRef<HTMLInputElement>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Lo ultimo que este componente mando a la URL. */
  const enviado = useRef(estado.busqueda);

  // Solo decide si se ve el aspa. No es el valor del campo: el campo sigue
  // sin controlar, asi que esto no toca el cursor.
  const [hayTexto, setHayTexto] = useState(estado.busqueda.length > 0);

  const ocultos = camposOcultos(estado);

  /*
   * Si la busqueda de la URL cambia por algo que no fue este componente (el
   * boton atras, un enlace que limpia los filtros), el campo tiene que
   * reflejarlo. Al no estar controlado, nadie lo haria por el.
   */
  useEffect(() => {
    if (estado.busqueda === enviado.current) return;

    enviado.current = estado.busqueda;

    if (campo.current) campo.current.value = estado.busqueda;
    setHayTexto(estado.busqueda.length > 0);
  }, [estado.busqueda]);

  useEffect(() => {
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, []);

  function navegar(termino: string) {
    if (temporizador.current) clearTimeout(temporizador.current);

    // Ya estamos ahi: repetir la navegacion solo gastaria una consulta.
    if (termino === enviado.current) return;

    enviado.current = termino;

    iniciar(() => {
      router.replace(conBusqueda(ruta, estado, termino), { scroll: false });
    });
  }

  function alEscribir(termino: string) {
    setHayTexto(termino.length > 0);

    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => navegar(termino), ESPERA);
  }

  function limpiar() {
    if (campo.current) {
      campo.current.value = "";
      campo.current.focus();
    }

    setHayTexto(false);
    navegar("");
  }

  return (
    <form
      method="get"
      action={ruta}
      role="search"
      onSubmit={(evento) => {
        // Con JavaScript, Enter no recarga: adelanta la espera pendiente.
        evento.preventDefault();
        navegar(campo.current?.value.trim() ?? "");
      }}
      className="flex min-w-0 flex-1 sm:max-w-[340px]"
    >
      {/* La clave lleva el valor porque un filtro con varios valores repite el
          mismo nombre: "estado" sale dos veces y con la clave sola chocarian. */}
      {ocultos.map((campoOculto) => (
        <input
          key={`${campoOculto.nombre}=${campoOculto.valor}`}
          type="hidden"
          name={campoOculto.nombre}
          value={campoOculto.valor}
        />
      ))}

      <label htmlFor={id} className="sr-only">
        {etiqueta}
      </label>

      <div
        className={[
          "flex min-h-11 w-full min-w-0 items-center rounded-[10px]",
          "border-[1.5px] border-borde bg-campo",
          "focus-within:border-acento focus-within:shadow-[var(--foco)]",
          "dark-tema:focus-within:border-acento",
        ].join(" ")}
      >
        {/*
          Sigue siendo un submit para que sirva de algo sin JavaScript. Con el
          cargado no hay nada que pulsar: la busqueda ya salio sola, y el icono
          pasa a decir que se esta consultando.
        */}
        <button
          type="submit"
          aria-label={etiqueta}
          tabIndex={-1}
          className={[
            "grid size-11 shrink-0 cursor-pointer place-items-center rounded-l-[9px]",
            "suave text-suave hover:text-texto",
          ].join(" ")}
        >
          {pendiente ? (
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin text-acento"
            />
          ) : (
            <Search aria-hidden="true" className="size-4" />
          )}
        </button>

        <input
          ref={campo}
          id={id}
          type="search"
          name={PARAMETROS.busqueda}
          defaultValue={estado.busqueda}
          placeholder={marcador}
          maxLength={120}
          autoComplete="off"
          onChange={(evento) => alEscribir(evento.target.value)}
          className={[
            "min-w-0 flex-1 bg-transparent py-2.5 text-[13px] text-texto",
            "placeholder:text-suave focus:outline-none",
            // El aspa nativa del type=search cambia de un navegador a otro y
            // no borraria el parametro de la URL: la sustituye la de al lado.
            "[&::-webkit-search-cancel-button]:appearance-none",
          ].join(" ")}
        />

        {hayTexto && (
          <button
            type="button"
            onClick={limpiar}
            aria-label="Limpiar la busqueda"
            title="Limpiar la busqueda"
            className={[
              "grid size-11 shrink-0 cursor-pointer place-items-center rounded-r-[9px]",
              "suave text-suave hover:text-texto",
            ].join(" ")}
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>

      {/*
        Que la lista cambio hay que decirlo, no solo pintarlo: quien usa un
        lector de pantalla no ve aparecer las filas.
      */}
      <span aria-live="polite" className="sr-only">
        {pendiente ? "Buscando" : ""}
      </span>
    </form>
  );
}
