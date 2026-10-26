"use client";

import { useActionState, useState } from "react";
import { FilePen, FilePlus2 } from "lucide-react";

import { abrirVersionMiBrief, nuevoBrief } from "@/actions/misBriefs";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { Boton, BotonEnlace, claseLinea } from "@/components/ui";
import { ESTADO_INICIAL, type EstadoFormulario } from "@/types";

/** Lo que se ve de un formato al elegirlo. */
export type FormatoParaElegir = {
  clave: string;
  nombre: string;
  lema: string | null;
  minutos: number;
};

/** Con mas formatos que estos, la ventana trae buscador. */
const CON_BUSCADOR = 6;

/**
 * Empezar un brief: elegir el formato y confirmar, en la ventana de «Nuevo
 * brief». Antes, pulsar «Empezar» en una tarjeta creaba el borrador de golpe,
 * y una tarjeta por formato no escalaba: con muchos formatos era una columna
 * sin fin. Aqui los formatos son una lista para elegir (con buscador si son
 * muchos) y se dice que va a pasar antes de crear nada. Cancelar no crea
 * nada. Al empezar, lleva al formulario.
 */
export function ElegirFormatoBrief({
  formatos,
  hrefCerrar,
}: {
  formatos: FormatoParaElegir[];
  hrefCerrar: string;
}) {
  const [estado, enviar, enviando] = useActionState(nuevoBrief, ESTADO_INICIAL);
  useAvisoDeAccion(estado);

  const [elegido, setElegido] = useState(formatos.length === 1 ? formatos[0].clave : "");
  const [busqueda, setBusqueda] = useState("");
  const termino = busqueda.trim().toLowerCase();
  const visibles = termino
    ? formatos.filter((f) => `${f.nombre} ${f.lema ?? ""}`.toLowerCase().includes(termino))
    : formatos;
  const formato = formatos.find((f) => f.clave === elegido);

  return (
    <form action={enviar} className="flex flex-col gap-4">
      {formatos.length > CON_BUSCADOR && (
        <input
          type="search"
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
          placeholder="Buscar un tipo de brief"
          aria-label="Buscar un tipo de brief"
          className={claseLinea()}
        />
      )}

      <fieldset>
        <legend className="mb-2 text-xs font-semibold text-texto">Que tipo de trabajo necesitas</legend>
        <div className="barra-fina flex max-h-[300px] flex-col gap-2 overflow-y-auto">
          {visibles.map((f) => (
            <label
              key={f.clave}
              className={[
                "suave flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3",
                elegido === f.clave ? "border-acento bg-acento-tenue" : "border-borde hover:border-acento",
              ].join(" ")}
            >
              <input
                type="radio"
                name="formato"
                value={f.clave}
                checked={elegido === f.clave}
                onChange={() => setElegido(f.clave)}
                className="mt-1 size-4 shrink-0 accent-[var(--acento)]"
              />
              <span className="min-w-0">
                <span className="block text-[14px] font-bold text-texto">{f.nombre}</span>
                {f.lema && <span className="block text-[12.5px] text-suave">{f.lema}</span>}
                <span className="mt-0.5 block text-[12px] text-suave">Unos {f.minutos} minutos</span>
              </span>
            </label>
          ))}
          {visibles.length === 0 && <p className="text-[12.5px] text-suave">Ningun tipo coincide con la busqueda.</p>}
        </div>
      </fieldset>

      <ul className="flex list-disc flex-col gap-1 pl-5 text-[12.5px]">
        <li>Se crea un borrador{formato ? ` de «${formato.nombre}»` : ""} y se abre para que lo llenes.</li>
        <li>Se guarda solo mientras escribes, y lo puede seguir cualquiera de tu empresa.</li>
        <li>No le llega a la agencia hasta que pulses «Enviar brief».</li>
      </ul>

      <div className="flex flex-wrap justify-end gap-2.5">
        <BotonEnlace href={hrefCerrar} variante="fantasma" tamano="chico">
          Cancelar
        </BotonEnlace>
        <Boton type="submit" tamano="chico" disabled={enviando || !formato}>
          <FilePlus2 aria-hidden="true" />
          {enviando ? "Abriendo..." : "Empezar el brief"}
        </Boton>
      </div>
    </form>
  );
}

/**
 * Abrir una version nueva de un brief enviado (S-08). Por defecto, la del
 * cliente; el prospecto pasa la suya, atada a su enlace.
 */
export function AbrirVersion({
  briefId,
  accion = abrirVersionMiBrief,
}: {
  briefId: number;
  accion?: (estado: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
}) {
  const [estado, enviar, enviando] = useActionState(accion, ESTADO_INICIAL);
  useAvisoDeAccion(estado);

  return (
    <form action={enviar}>
      <input type="hidden" name="id" value={briefId} />
      <Boton type="submit" variante="fantasma" tamano="chico" disabled={enviando}>
        <FilePen aria-hidden="true" />
        {enviando ? "Abriendo..." : "Cambiar algo: enviar una version nueva"}
      </Boton>
    </form>
  );
}

/** Empezar el brief de un enlace de prospecto. La action llega atada al token. */
export function EmpezarPorEnlace({ accion }: { accion: (estado: EstadoFormulario) => Promise<EstadoFormulario> }) {
  const [estado, enviar, enviando] = useActionState(accion, ESTADO_INICIAL);
  useAvisoDeAccion(estado);

  return (
    <form action={enviar}>
      <Boton type="submit" disabled={enviando}>
        <FilePlus2 aria-hidden="true" />
        {enviando ? "Abriendo..." : "Empezar el brief"}
      </Boton>
    </form>
  );
}
