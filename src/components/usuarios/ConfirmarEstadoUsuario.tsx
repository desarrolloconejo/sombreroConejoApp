"use client";

import { useActionState } from "react";
import { Power, PowerOff } from "lucide-react";

import { cambiarEstadoUsuario } from "@/actions/usuarios";
import { Boton, BotonEnlace } from "@/components/ui";
import { ESTADO_INICIAL } from "@/types";
import type { UsuarioCompleto } from "@/types";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";

/**
 * La confirmacion de activar o desactivar una cuenta.
 *
 * Es de cliente solo por `useActionState`: la action puede negarse (el ultimo
 * administrador, la propia cuenta) y ese motivo hay que poder leerlo sin
 * perder el dialogo. Con un formulario a secas el mensaje se perderia al
 * recargar la pagina.
 *
 * El boton dice lo que va a pasar, no "Aceptar". Quien confirma algo lee el
 * boton antes que el texto, y "Aceptar" no distingue activar de desactivar.
 */
export function ConfirmarEstadoUsuario({
  usuario,
  hrefCerrar,
}: {
  usuario: UsuarioCompleto;
  hrefCerrar: string;
}) {
  const [estado, enviar, enviando] = useActionState(
    cambiarEstadoUsuario,
    ESTADO_INICIAL,
  );

  // El resultado sale como aviso flotante: en un formulario largo, una alerta
  // arriba queda fuera de la vista de quien acaba de pulsar el boton.
  useAvisoDeAccion(estado);

  const desactivar = usuario.activo;
  const quien = `${usuario.nombre} ${usuario.apellido}`;

  return (
    <form action={enviar}>
      <input type="hidden" name="id" value={usuario.id} />


      {/*
        Se dice que pasa Y que no pasa. Lo segundo es lo que de verdad quita el
        miedo a pulsar: quien duda esta pensando que va a perder algo.
      */}
      {desactivar ? (
        <p>
          <strong className="font-semibold text-texto">{quien}</strong> dejara de
          poder entrar en la aplicacion. No se borra nada: su cuenta, sus datos
          y lo que haya hecho siguen ahi, y puedes reactivarla cuando quieras.
        </p>
      ) : (
        <p>
          <strong className="font-semibold text-texto">{quien}</strong> volvera a
          poder entrar con su correo y su contrasena de siempre.
        </p>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-2.5">
        <BotonEnlace href={hrefCerrar} variante="fantasma" tamano="chico">
          {estado.ok ? "Cerrar" : "Cancelar"}
        </BotonEnlace>

        {/*
          Cuando ya se hizo, el boton desaparece: dejarlo invitaria a pulsarlo
          otra vez y a deshacer sin querer lo que se acaba de confirmar.
        */}
        {!estado.ok && (
          <Boton
            type="submit"
            tamano="chico"
            variante={desactivar ? "peligro" : "primario"}
            disabled={enviando}
          >
            {enviando
              ? "Guardando..."
              : desactivar
                ? "Desactivar cuenta"
                : "Reactivar cuenta"}
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
