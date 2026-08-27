"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";

import { borrarFicha } from "@/actions/hooks";
import { Boton, BotonEnlace } from "@/components/ui";
import { ESTADO_INICIAL } from "@/types";
import type { FichaConResultado } from "@/types";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";

/**
 * La confirmacion de borrar una ficha.
 *
 * Distingue dos casos que NO son el mismo, aunque el boton sea igual:
 *
 * - Un borrador sin publicar no se lleva nada por delante.
 * - Una ficha medida arrastra sus resultados y el aprendizaje que alguien
 *   escribio despues de leer los numeros. Eso es lo unico que esa pieza le
 *   dejo a la cuenta, y no se puede recuperar.
 *
 * Por eso el texto cambia y el tono tambien: la misma advertencia para los dos
 * casos entrena a la gente a ignorarla.
 */
export function ConfirmarBorradoFicha({
  ficha,
  hrefCerrar,
}: {
  ficha: FichaConResultado;
  hrefCerrar: string;
}) {
  const [estado, enviar, enviando] = useActionState(borrarFicha, ESTADO_INICIAL);

  // El resultado sale como aviso flotante: en un formulario largo, una alerta
  // arriba queda fuera de la vista de quien acaba de pulsar el boton.
  useAvisoDeAccion(estado);

  const conResultados = ficha.estado === "medida" || ficha.resultado !== null;

  return (
    <form action={enviar}>
      <input type="hidden" name="id" value={ficha.id} />


      <p>
        Se borrara{" "}
        <strong className="font-semibold text-texto">
          &laquo;{ficha.hablado}&raquo;
        </strong>
        .
      </p>

      {conResultados ? (
        <p className="mt-3">
          Es una pieza <b>medida</b>: con ella se van sus resultados y el
          aprendizaje que dejo escrito. Eso es justo lo que sirve para la
          siguiente pieza, y no hay forma de recuperarlo.
        </p>
      ) : (
        <p className="mt-3 text-suave">
          Es un borrador sin publicar, asi que no se lleva ningun dato real por
          delante.
        </p>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-2.5">
        <BotonEnlace href={hrefCerrar} variante="fantasma" tamano="chico">
          {estado.ok ? "Cerrar" : "Cancelar"}
        </BotonEnlace>

        {/* Hecho el borrado el boton desaparece: dejarlo invitaria a pulsarlo
            otra vez sobre algo que ya no esta. */}
        {!estado.ok && (
          <Boton type="submit" tamano="chico" variante="peligro" disabled={enviando}>
            {enviando ? "Borrando…" : conResultados ? "Borrar la pieza" : "Borrar el borrador"}
            {!enviando && <Trash2 aria-hidden="true" />}
          </Boton>
        )}
      </div>
    </form>
  );
}
