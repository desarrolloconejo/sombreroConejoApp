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
 * Distingue los TRES estados, que no cuestan lo mismo:
 *
 * - Un borrador sin auditar no se lleva nada por delante.
 * - Una auditada ya paso el control y tiene nota; si esta publicada, borrarla
 *   deja la pieza sin sitio donde registrar sus numeros.
 * - Una medida arrastra sus resultados y el aprendizaje que alguien escribio
 *   despues de leer los numeros. Eso es lo unico que esa pieza le dejo a la
 *   cuenta, y no se puede recuperar.
 *
 * Antes eran dos ramas sobre tres estados, asi que una ficha auditada leia
 * «es un borrador sin publicar»: falso por partida doble, porque ya estaba
 * auditada y porque el propio modulo de metricas llama publicadas a esas.
 *
 * El texto cambia con el coste a proposito: la misma advertencia para los tres
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

  /*
   * `resultado !== null` manda sobre el estado por si acaso: guardar un
   * resultado y pasar la ficha a `medida` ocurre en la misma transaccion, asi
   * que no deberian discrepar — pero si alguna vez lo hicieran, lo que importa
   * es que hay datos que se van.
   */
  const medida = ficha.estado === "medida" || ficha.resultado !== null;
  const auditada = !medida && ficha.estado === "auditada";

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

      {medida ? (
        <p className="mt-3">
          Es una pieza <b>medida</b>: con ella se van sus resultados y el
          aprendizaje que dejo escrito. Eso es justo lo que sirve para la
          siguiente pieza, y no hay forma de recuperarlo.
        </p>
      ) : auditada ? (
        <p className="mt-3">
          Es una pieza <b>auditada</b>
          {ficha.notaAuditor !== null && `, con nota ${ficha.notaAuditor}`}: ya
          paso el control previo. Si esta publicada, al borrarla no quedara
          donde registrar sus numeros.
        </p>
      ) : (
        <p className="mt-3 text-suave">
          Es un borrador sin auditar, asi que no se lleva ningun dato real por
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
            {enviando
              ? "Borrando…"
              : medida
                ? "Borrar la pieza"
                : auditada
                  ? "Borrar la ficha"
                  : "Borrar el borrador"}
            {!enviando && <Trash2 aria-hidden="true" />}
          </Boton>
        )}
      </div>
    </form>
  );
}
