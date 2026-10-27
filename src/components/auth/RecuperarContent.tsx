"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, CircleAlert, MailCheck, Mail } from "lucide-react";

import { pedirRecuperacion } from "@/actions/recuperarClave";
import { Alerta, Boton } from "@/components/ui";
import { ESTADO_INICIAL } from "@/types";
import { CAJA, CAJA_ERROR, ENTRADA, ERROR, ETIQUETA, ICONO, retraso } from "./estilosAcceso";

/**
 * «Olvide mi contrasena»: se escribe el correo y llega un enlace.
 *
 * La respuesta es la misma exista o no la cuenta (lo decide la action): aqui
 * solo se pinta. Cuando sale bien, el formulario deja su sitio al aviso.
 */
export function RecuperarContent() {
  const [estado, enviar, enviando] = useActionState(pedirRecuperacion, ESTADO_INICIAL);
  const errorEmail = estado.errores?.email;

  return (
    <section className="flex flex-1 flex-col px-[26px] pt-[30px] pb-6 lg:items-center lg:justify-center lg:p-10">
      <div className="w-full lg:w-[400px]">
        <p className="surge m-0 mb-1.5 text-[12.5px] font-bold text-acento lg:mb-2 lg:text-[13.5px]">
          Olvide mi contrasena
        </p>

        <h1
          style={retraso("0.05s")}
          className="surge m-0 mb-[7px] text-[23px] leading-[1.1] font-extrabold tracking-[-0.025em] lg:mb-2.5 lg:text-[40px] lg:leading-[1.05] lg:tracking-[-0.035em]"
        >
          Elige una nueva
        </h1>

        <p
          style={retraso("0.09s")}
          className="surge m-0 mb-6 text-[13px] leading-[1.55] text-suave lg:mb-[34px] lg:text-sm lg:leading-relaxed"
        >
          Escribe el correo con el que entras y te enviaremos un enlace para elegir una
          contrasena nueva.
        </p>

        {estado.ok ? (
          <Alerta tono="info" className="surge" icono={<MailCheck />}>
            {estado.mensaje}
          </Alerta>
        ) : (
          <form action={enviar} noValidate>
            {estado.mensaje && (
              <Alerta className="surge mb-[18px] lg:mb-[22px]" icono={<CircleAlert />}>
                {estado.mensaje}
              </Alerta>
            )}

            <div style={retraso("0.13s")} className="surge">
              <label htmlFor="email" className={ETIQUETA}>
                Correo
              </label>
              <div className={`${CAJA} ${errorEmail ? CAJA_ERROR : "border-borde"}`}>
                <Mail aria-hidden="true" className={ICONO} />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  autoFocus
                  required
                  placeholder="tucorreo@conejo.test"
                  aria-invalid={errorEmail ? true : undefined}
                  aria-describedby={errorEmail ? "email-error" : undefined}
                  className={ENTRADA}
                />
              </div>
              {errorEmail && (
                <p id="email-error" role="alert" className={ERROR}>
                  {errorEmail}
                </p>
              )}
            </div>

            {/* La animacion va en el envoltorio y no en el boton, como en el login. */}
            <div style={retraso("0.2s")} className="surge mt-[22px] lg:mt-[26px]">
              <Boton type="submit" disabled={enviando} className="min-h-[52px] w-full text-[14.5px]">
                {enviando ? "Enviando..." : "Enviarme el enlace"}
                {!enviando && <ArrowRight aria-hidden="true" />}
              </Boton>
            </div>
          </form>
        )}

        <p
          style={retraso("0.24s")}
          className="surge mt-6 border-t border-borde pt-[18px] text-center text-[11.5px] leading-[1.55] text-suave lg:mt-[30px] lg:pt-[22px] lg:text-left lg:text-[12.5px] lg:leading-relaxed"
        >
          Si ya no usas ese correo, un administrador puede restablecerte la contrasena.{" "}
          <Link href="/login" className="font-semibold text-acento underline underline-offset-2">
            Volver a entrar
          </Link>
        </p>
      </div>
    </section>
  );
}
