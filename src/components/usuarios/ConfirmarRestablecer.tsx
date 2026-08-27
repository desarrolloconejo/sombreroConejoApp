"use client";

import { useActionState } from "react";
import { CircleAlert, KeyRound } from "lucide-react";

import { restablecerPassword } from "@/actions/usuarios";
import { Alerta, Boton, BotonEnlace } from "@/components/ui";
import { ESTADO_INICIAL } from "@/types";
import type { UsuarioCompleto } from "@/types";

import { CredencialProvisional } from "./CredencialProvisional";

/**
 * Confirmar el restablecimiento, y despues entregar la clave nueva.
 *
 * Son dos pantallas en un solo componente porque son dos momentos del mismo
 * gesto: se pregunta antes de invalidar la contrasena de alguien, y en cuanto
 * se hace hay que mostrar la nueva. Separarlas obligaria a llevar la clave de
 * un componente a otro, y esa clave no debe viajar mas de lo imprescindible.
 *
 * Es de cliente por `useActionState`: la action puede negarse —la cuenta ya no
 * existe, o es la tuya— y ese motivo hay que poder leerlo.
 */
export function ConfirmarRestablecer({
  usuario,
  hrefCerrar,
}: {
  usuario: UsuarioCompleto;
  hrefCerrar: string;
}) {
  const [estado, enviar, enviando] = useActionState(
    restablecerPassword,
    ESTADO_INICIAL,
  );

  const quien = `${usuario.nombre} ${usuario.apellido}`;

  if (estado.ok && estado.credencial) {
    return (
      <>
        <CredencialProvisional
          email={estado.credencial.email}
          password={estado.credencial.password}
          titulo="Contrasena restablecida"
          descripcion={`Entregasela a ${quien}. La anterior dejo de valer en este momento.`}
        />

        <div className="mt-5 flex justify-end">
          <BotonEnlace href={hrefCerrar} tamano="chico">
            Listo
          </BotonEnlace>
        </div>
      </>
    );
  }

  return (
    <form action={enviar}>
      <input type="hidden" name="id" value={usuario.id} />

      {estado.mensaje && (
        <Alerta tono="aviso" icono={<CircleAlert />} className="mb-4">
          {estado.mensaje}
        </Alerta>
      )}

      {/*
        Se dice que pasa Y que no pasa. Lo segundo es lo que quita el miedo a
        pulsar: quien duda esta pensando que va a romper algo.
      */}
      <p>
        Se generara una contrasena nueva al azar para{" "}
        <strong className="font-semibold text-texto">{quien}</strong> y te la
        mostraremos aqui para que se la entregues. <b>La anterior dejara de
        valer</b>, asi que si esa persona la estaba usando tendra que volver a
        entrar con la nueva.
      </p>

      <p className="mt-3 text-suave">
        No se borra nada mas: sus datos, su rol y lo que haya hecho siguen
        igual. Tampoco eliges tu la contrasena ni ves la anterior.
      </p>

      <div className="mt-5 flex flex-wrap justify-end gap-2.5">
        <BotonEnlace href={hrefCerrar} variante="fantasma" tamano="chico">
          Cancelar
        </BotonEnlace>

        <Boton type="submit" tamano="chico" disabled={enviando}>
          {enviando ? "Generando..." : "Restablecer contrasena"}
          {!enviando && <KeyRound aria-hidden="true" />}
        </Boton>
      </div>
    </form>
  );
}
