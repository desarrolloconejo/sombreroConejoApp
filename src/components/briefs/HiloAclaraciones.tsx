"use client";

import { useActionState, useState } from "react";
import { Send } from "lucide-react";

import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { Boton, CLASE_CONTROL } from "@/components/ui";
import { ZONA_HORARIA } from "@/lib/fechas";
import { ESTADO_INICIAL, type AclaracionBrief, type EstadoFormulario } from "@/types";

/**
 * El hilo de aclaraciones de un brief: lo que pregunta el equipo y lo que
 * responde quien lo pidio. La action llega como prop: la del cliente, la del
 * equipo o la del prospecto, cada una con su guardia.
 */

const CUANDO = new Intl.DateTimeFormat("es-VE", {
  timeZone: ZONA_HORARIA,
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export function HiloAclaraciones({
  briefId,
  mensajes,
  accion,
  abierto,
  vacio,
}: {
  briefId: number;
  mensajes: AclaracionBrief[];
  accion: (estado: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  /** Si se puede escribir: el brief sigue vivo. */
  abierto: boolean;
  vacio: string;
}) {
  const [estado, enviar, enviando] = useActionState(accion, ESTADO_INICIAL);
  useAvisoDeAccion(estado);
  const [texto, setTexto] = useState("");

  // Enviado, el campo se vacia: el mensaje ya esta en el hilo. Se ajusta
  // durante el render, al llegar un resultado nuevo.
  const [visto, setVisto] = useState(estado);
  if (estado !== visto) {
    setVisto(estado);
    if (estado.ok) setTexto("");
  }

  return (
    <div>
      {mensajes.length === 0 ? (
        <p className="text-[13px] text-suave">{vacio}</p>
      ) : (
        <ol aria-label="Aclaraciones" className="flex flex-col gap-3">
          {mensajes.map((mensaje) => (
            <li
              key={mensaje.id}
              className={[
                "rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                mensaje.delEquipo ? "bg-acento-tenue" : "border border-borde",
              ].join(" ")}
            >
              <p className="mb-1 text-[11.5px] text-suave">
                <b className="font-semibold text-texto">{mensaje.autorNombre}</b>
                {mensaje.delEquipo ? " · equipo" : ""} · {CUANDO.format(new Date(mensaje.creadoEn))}
              </p>
              <p className="whitespace-pre-line">{mensaje.texto}</p>
            </li>
          ))}
        </ol>
      )}

      {abierto && (
        <form action={enviar} noValidate className="mt-4 flex flex-col gap-2.5">
          <input type="hidden" name="id" value={briefId} />
          <label>
            <span className="sr-only">Escribe un mensaje</span>
            <textarea
              name="texto"
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Escribe una pregunta o una respuesta"
              aria-invalid={estado.errores?.texto ? true : undefined}
              className={`${CLASE_CONTROL} min-h-[84px] py-2.5`}
            />
          </label>
          {estado.errores?.texto && (
            <p role="alert" className="text-[12px] font-medium text-blackberry dark-tema:text-acento">
              {estado.errores.texto}
            </p>
          )}
          <div className="flex justify-end">
            <Boton type="submit" tamano="chico" disabled={enviando}>
              <Send aria-hidden="true" />
              {enviando ? "Enviando..." : "Enviar mensaje"}
            </Boton>
          </div>
        </form>
      )}
    </div>
  );
}
