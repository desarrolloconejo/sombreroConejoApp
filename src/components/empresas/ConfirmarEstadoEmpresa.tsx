"use client";

import { useActionState } from "react";
import { Power, PowerOff } from "lucide-react";

import { cambiarEstadoEmpresa } from "@/actions/empresas";
import { Boton, BotonEnlace } from "@/components/ui";
import { ESTADO_INICIAL } from "@/types";
import type { ResumenEmpresa } from "@/types";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";

/**
 * La confirmacion de activar o desactivar una empresa.
 *
 * Es de cliente solo por `useActionState`: la action puede negarse y ese motivo
 * hay que poder leerlo sin perder el dialogo.
 *
 * El boton dice lo que va a pasar, no «Aceptar». Quien confirma algo lee el
 * boton antes que el texto, y «Aceptar» no distingue activar de desactivar.
 */
export function ConfirmarEstadoEmpresa({
  empresa,
  hrefCerrar,
}: {
  empresa: ResumenEmpresa;
  hrefCerrar: string;
}) {
  const [estado, enviar, enviando] = useActionState(
    cambiarEstadoEmpresa,
    ESTADO_INICIAL,
  );

  useAvisoDeAccion(estado);

  const desactivar = empresa.activo;

  return (
    <form action={enviar}>
      <input type="hidden" name="id" value={empresa.id} />

      {/*
        Se dice que pasa Y que no pasa. Lo segundo es lo que quita el miedo a
        pulsar: quien duda esta pensando que va a perder algo. Y aqui hay mucho
        que podria parecer que se pierde —piezas, personas, historial— cuando
        en realidad no se toca nada.
      */}
      {desactivar ? (
        <>
          <p>
            <strong className="font-semibold text-texto">{empresa.nombre}</strong>{" "}
            dejara de aparecer al escribir hooks y al dar de alta usuarios. Es
            para cuentas que ya no se atienden.
          </p>

          <p className="mt-3 text-suave">
            No se borra nada: sus {empresa.piezas}{" "}
            {empresa.piezas === 1 ? "pieza" : "piezas"} siguen en el historial y
            {empresa.contactos === 0
              ? " no tiene personas de contacto que pierdan el acceso"
              : ` sus ${empresa.contactos} ${empresa.contactos === 1 ? "persona" : "personas"} de contacto conservan su cuenta`}
            . Puedes reactivarla cuando quieras.
          </p>
        </>
      ) : (
        <p>
          <strong className="font-semibold text-texto">{empresa.nombre}</strong>{" "}
          volvera a estar disponible: se podra elegir como cliente al escribir
          hooks y al dar de alta a su gente.
        </p>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-2.5">
        <BotonEnlace href={hrefCerrar} variante="fantasma" tamano="chico">
          {estado.ok ? "Cerrar" : "Cancelar"}
        </BotonEnlace>

        {/*
          Hecho el cambio el boton desaparece: dejarlo invitaria a pulsarlo otra
          vez y a deshacer sin querer lo que se acaba de confirmar.
        */}
        {!estado.ok && (
          <Boton
            type="submit"
            tamano="chico"
            variante={desactivar ? "peligro" : "primario"}
            disabled={enviando}
          >
            {enviando
              ? "Guardando…"
              : desactivar
                ? "Desactivar empresa"
                : "Reactivar empresa"}
            {!enviando &&
              (desactivar ? (
                <PowerOff aria-hidden="true" />
              ) : (
                <Power aria-hidden="true" />
              ))}
          </Boton>
        )}
      </div>
    </form>
  );
}
