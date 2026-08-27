"use client";

import { useActionState } from "react";
import { ArchiveRestore, CircleAlert, CircleCheck, Trash2, Undo2 } from "lucide-react";

import {
  borrarReferencia,
  borrarRegla,
  cambiarEstadoApertura,
} from "@/actions/hooksDocumentacion";
import { Alerta, Boton, BotonEnlace } from "@/components/ui";
import { ESTADO_INICIAL } from "@/types";

/**
 * Las confirmaciones de Documentacion: borrar una regla, borrar una referencia
 * y retirar o reponer una apertura.
 *
 * Son un solo componente porque las tres tienen la misma forma —un id oculto,
 * un texto que dice lo que pasa y un boton— y la action puede negarse ("esa
 * regla ya no existe"). Es de cliente solo por eso: con un formulario a secas
 * el motivo del rechazo se perderia al recargar.
 *
 * El boton dice lo que va a ocurrir y no "Aceptar". Quien confirma algo lee el
 * boton antes que el texto, y "Aceptar" no distingue borrar de reponer.
 */

type Caso = "regla" | "referencia" | "retirar-apertura" | "reponer-apertura";

const ACCIONES = {
  regla: borrarRegla,
  referencia: borrarReferencia,
  "retirar-apertura": cambiarEstadoApertura,
  "reponer-apertura": cambiarEstadoApertura,
} as const;

const BOTONES = {
  regla: { texto: "Borrar la regla", variante: "peligro" as const, icono: Trash2 },
  referencia: {
    texto: "Borrar la referencia",
    variante: "peligro" as const,
    icono: Trash2,
  },
  "retirar-apertura": {
    texto: "Retirar la apertura",
    variante: "peligro" as const,
    icono: ArchiveRestore,
  },
  "reponer-apertura": {
    texto: "Reponer la apertura",
    variante: "primario" as const,
    icono: Undo2,
  },
} as const;

export function ConfirmarDocumentacion({
  caso,
  id,
  nombre,
  hrefCerrar,
}: {
  caso: Caso;
  id: number;
  /** Lo que se esta tocando, para que el texto nombre algo concreto. */
  nombre: string;
  hrefCerrar: string;
}) {
  const [estado, enviar, enviando] = useActionState(ACCIONES[caso], ESTADO_INICIAL);
  const boton = BOTONES[caso];
  const Icono = boton.icono;

  return (
    <form action={enviar}>
      <input type="hidden" name="id" value={id} />
      {/* La misma action retira y repone; lo decide este campo. */}
      {caso === "reponer-apertura" && <input type="hidden" name="reponer" value="si" />}

      {estado.mensaje && (
        <Alerta
          tono={estado.ok ? "info" : "aviso"}
          icono={estado.ok ? <CircleCheck /> : <CircleAlert />}
          className="mb-4"
        >
          {estado.mensaje}
        </Alerta>
      )}

      {/*
        Se dice que pasa Y que no pasa. Lo segundo es lo que quita el miedo a
        pulsar: quien duda esta pensando que va a perder algo.
      */}
      <p>
        <strong className="font-semibold text-texto">{nombre}</strong>{" "}
        {caso === "regla" && (
          <>
            dejara de aplicarse. Las cuentas que la usaban no se quedan sin
            criterio: pasan al escalon siguiente, que es su sector, o el
            estandar de la casa si no hay ninguno. Las fichas ya auditadas
            conservan su nota.
          </>
        )}
        {caso === "referencia" && (
          <>
            desaparece del banco del equipo. No afecta a ninguna ficha: una
            referencia es material para estudiar, nunca queda citada en una
            pieza.
          </>
        )}
        {caso === "retirar-apertura" && (
          <>
            deja de ofrecerse al escribir, pero <b>no se borra</b>: sigue
            pudiendo leerse en las fichas antiguas que la citan, y puedes
            reponerla cuando quieras.
          </>
        )}
        {caso === "reponer-apertura" && (
          <>vuelve a ofrecerse al escribir, tal y como estaba.</>
        )}
      </p>

      <div className="mt-5 flex flex-wrap justify-end gap-2.5">
        <BotonEnlace href={hrefCerrar} variante="fantasma" tamano="chico">
          {estado.ok ? "Cerrar" : "Cancelar"}
        </BotonEnlace>

        {/*
          Hecho el cambio, el boton desaparece: dejarlo invitaria a pulsarlo
          otra vez sobre algo que ya no esta.
        */}
        {!estado.ok && (
          <Boton
            type="submit"
            tamano="chico"
            variante={boton.variante}
            disabled={enviando}
          >
            {enviando ? "Guardando…" : boton.texto}
            {!enviando && <Icono aria-hidden="true" />}
          </Boton>
        )}
      </div>
    </form>
  );
}
