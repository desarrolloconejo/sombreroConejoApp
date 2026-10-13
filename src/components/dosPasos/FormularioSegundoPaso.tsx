"use client";

import { useActionState } from "react";
import { ArrowRight, CircleAlert, KeyRound, LoaderCircle } from "lucide-react";

import { verificarSegundoPaso } from "@/actions/dosPasos";
import { Alerta, Boton, Campo } from "@/components/ui";
import { ESTADO_INICIAL } from "@/types";

/**
 * El campo del codigo, tras acertar la contrasena.
 *
 * Admite el codigo de seis digitos de la app o uno de los de respaldo: es un
 * solo campo porque quien no tiene el telefono no deberia tener que buscar
 * otra pantalla.
 */
export function FormularioSegundoPaso() {
  const [estado, enviar, enviando] = useActionState(verificarSegundoPaso, ESTADO_INICIAL);

  return (
    <form action={enviar} noValidate>
      {estado.mensaje && (
        <Alerta className="mb-5" icono={<CircleAlert />}>
          {estado.mensaje}
        </Alerta>
      )}

      <Campo
        id="codigo"
        name="codigo"
        etiqueta="Codigo de verificacion"
        ayuda="Los seis digitos de tu app, o un codigo de respaldo."
        autoComplete="one-time-code"
        autoFocus
        maxLength={16}
        placeholder="123 456"
        error={estado.errores?.codigo}
        icono={<KeyRound />}
        required
      />

      <div className="mt-6 flex justify-end">
        <Boton type="submit" disabled={enviando}>
          {enviando ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <ArrowRight aria-hidden="true" />
          )}
          Entrar
        </Boton>
      </div>
    </form>
  );
}
