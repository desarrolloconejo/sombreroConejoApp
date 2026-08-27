"use client";

import { useActionState, useState } from "react";
import type { CSSProperties } from "react";
import { Check, Circle, KeyRound, Lock } from "lucide-react";

import { cambiarPassword } from "@/actions/perfil";
import { Boton, Campo } from "@/components/ui";
import { ESTADO_INICIAL } from "@/types";
import type { EstadoFormulario } from "@/types";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";

/**
 * El cambio de contrasena.
 *
 * Es de cliente por `useActionState` y por la lista de reglas, que se marcan
 * mientras se escribe. Esa lista es orientacion, no permiso: quien decide si
 * la contrasena vale es `validarPassword` en el servidor, y las reglas de aqui
 * repiten exactamente las suyas.
 */

const TARJETA =
  "surge rounded-[15px] border border-borde bg-superficie p-[22px] shadow-[var(--sombra)]";

/**
 * El maximo va escrito aqui y no importado de lib/password a proposito: ese
 * modulo arrastra bcrypt, que no tiene nada que hacer en el navegador.
 */
const MAXIMO = 72;

const REGLAS: { texto: string; cumple: (valor: string) => boolean }[] = [
  { texto: "Al menos 8 caracteres", cumple: (valor) => valor.length >= 8 },
  {
    texto: "Una mayuscula y una minuscula",
    cumple: (valor) => /[a-z]/.test(valor) && /[A-Z]/.test(valor),
  },
  { texto: "Al menos un numero", cumple: (valor) => /[0-9]/.test(valor) },
];

type Campos = { actual: string; nueva: string; confirmacion: string };

const VACIOS: Campos = { actual: "", nueva: "", confirmacion: "" };

export function FormularioPassword() {
  const [estado, enviar, enviando] = useActionState(cambiarPassword, ESTADO_INICIAL);

  // El resultado sale como aviso flotante: en un formulario largo, una alerta
  // arriba queda fuera de la vista de quien acaba de pulsar el boton.
  useAvisoDeAccion(estado);

  /**
   * Los tres campos van controlados y junto a ellos se guarda el estado con
   * el que se escribieron.
   *
   * Es lo que permite vaciarlos en cuanto el cambio se confirma sin recurrir a
   * un efecto: si el estado que devuelve la action es uno nuevo y es correcto,
   * lo tecleado pertenece a la contrasena anterior y ya no debe seguir en el
   * formulario. Tras un error, en cambio, se conserva.
   */
  const [borrador, setBorrador] = useState<{ campos: Campos; visto: EstadoFormulario }>(
    { campos: VACIOS, visto: ESTADO_INICIAL },
  );

  const reciencambiada = estado.ok && estado !== borrador.visto;
  const campos = reciencambiada ? VACIOS : borrador.campos;

  function escribir(campo: keyof Campos, valor: string) {
    setBorrador({ campos: { ...campos, [campo]: valor }, visto: estado });
  }

  return (
    <section
      style={{ "--retraso": "0.16s" } as CSSProperties}
      className={TARJETA}
      aria-labelledby="perfil-password"
    >
      <header className="mb-[18px] flex items-center gap-2.5">
        <Lock aria-hidden="true" className="size-[17px] shrink-0 text-acento" />
        <div>
          <h2 id="perfil-password" className="text-[15px] font-bold tracking-[-0.01em]">
            Cambiar contrasena
          </h2>
          <p className="mt-[3px] text-xs text-suave">
            Se te pide la actual para confirmar que eres tu
          </p>
        </div>
      </header>

      <form action={enviar} noValidate>

        <div className="grid gap-[15px] sm:grid-cols-2">
          <Campo
            id="passwordActual"
            name="passwordActual"
            type="password"
            etiqueta="Contrasena actual"
            autoComplete="current-password"
            maxLength={MAXIMO}
            required
            className="sm:col-span-2"
            value={campos.actual}
            onChange={(evento) => escribir("actual", evento.target.value)}
            error={estado.errores?.passwordActual}
          />

          <Campo
            id="passwordNueva"
            name="passwordNueva"
            type="password"
            etiqueta="Nueva contrasena"
            autoComplete="new-password"
            maxLength={MAXIMO}
            required
            value={campos.nueva}
            onChange={(evento) => escribir("nueva", evento.target.value)}
            error={estado.errores?.passwordNueva}
          />

          <Campo
            id="passwordConfirmacion"
            name="passwordConfirmacion"
            type="password"
            etiqueta="Repite la nueva"
            autoComplete="new-password"
            maxLength={MAXIMO}
            required
            value={campos.confirmacion}
            onChange={(evento) => escribir("confirmacion", evento.target.value)}
            error={estado.errores?.passwordConfirmacion}
          />
        </div>

        {/*
          El acierto se marca en blackberry sobre claro y en dorado sobre navy.
          Ningun verde: quedaria fuera de los seis colores de la marca.
        */}
        <ul className="mt-3 flex flex-col gap-1.5">
          {REGLAS.map((regla) => {
            const cumplida = regla.cumple(campos.nueva);

            return (
              <li
                key={regla.texto}
                className={[
                  "flex items-center gap-2 text-[11.5px]",
                  cumplida ? "text-texto" : "text-suave",
                ].join(" ")}
              >
                {cumplida ? (
                  <Check
                    aria-hidden="true"
                    strokeWidth={3}
                    className="size-[13px] shrink-0 text-blackberry dark-tema:text-acento"
                  />
                ) : (
                  <Circle
                    aria-hidden="true"
                    strokeWidth={2.5}
                    className="size-[13px] shrink-0"
                  />
                )}
                {regla.texto}
                {/* La marca es un icono: quien no lo ve necesita el estado
                    dicho con palabras. */}
                <span className="sr-only">
                  {cumplida ? "(cumplida)" : "(pendiente)"}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="mt-5 flex justify-end gap-2.5 border-t border-borde pt-[18px]">
          <Boton
            type="button"
            variante="fantasma"
            onClick={() => setBorrador({ campos: VACIOS, visto: estado })}
            disabled={enviando}
          >
            Cancelar
          </Boton>

          <Boton type="submit" disabled={enviando}>
            {enviando ? (
              "Actualizando..."
            ) : (
              <>
                <KeyRound aria-hidden="true" />
                Actualizar contrasena
              </>
            )}
          </Boton>
        </div>
      </form>
    </section>
  );
}
