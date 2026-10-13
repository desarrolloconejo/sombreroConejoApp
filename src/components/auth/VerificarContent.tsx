"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, CircleAlert, KeyRound } from "lucide-react";

import { verificarSegundoPaso } from "@/actions/dosPasos";
import { Alerta, Boton } from "@/components/ui";
import { ESTADO_INICIAL } from "@/types";
import { CAJA, CAJA_ERROR, ENTRADA, ERROR, ETIQUETA, ICONO, retraso } from "./estilosAcceso";

/**
 * El segundo paso del acceso: el codigo, tras acertar la contrasena.
 *
 * Es la misma pantalla que el login con otro campo: mismas medidas, mismos
 * estilos y la misma entrada. Para quien entra, la pagina no cambia; solo
 * cambia lo que se le pide.
 *
 * Admite el codigo de seis digitos de la app o uno de los de respaldo: es un
 * solo campo porque quien no tiene el telefono no deberia tener que buscar
 * otra pantalla.
 */
export function VerificarContent() {
  const [estado, enviar, enviando] = useActionState(verificarSegundoPaso, ESTADO_INICIAL);

  const errorCodigo = estado.errores?.codigo;

  return (
    <section className="flex flex-1 flex-col px-[26px] pt-[30px] pb-6 lg:items-center lg:justify-center lg:p-10">
      <div className="w-full lg:w-[400px]">
        <p className="surge m-0 mb-1.5 text-[12.5px] font-bold text-acento lg:mb-2 lg:text-[13.5px]">
          Un paso mas
        </p>

        <h1
          style={retraso("0.05s")}
          className="surge m-0 mb-[7px] text-[23px] leading-[1.1] font-extrabold tracking-[-0.025em] lg:mb-2.5 lg:text-[40px] lg:leading-[1.05] lg:tracking-[-0.035em]"
        >
          Escribe tu codigo
        </h1>

        <p
          style={retraso("0.09s")}
          className="surge m-0 mb-6 text-[13px] leading-[1.55] text-suave lg:mb-[34px] lg:text-sm lg:leading-relaxed"
        >
          Tu contrasena es correcta.
          <span className="hidden lg:inline">
            {" "}
            Abre tu app de codigos y escribe los seis digitos de Conejo App.
          </span>
        </p>

        <form action={enviar} noValidate>
          {estado.mensaje && (
            <Alerta className="surge mb-[18px] lg:mb-[22px]" icono={<CircleAlert />}>
              {estado.mensaje}
            </Alerta>
          )}

          <div style={retraso("0.13s")} className="surge">
            <label htmlFor="codigo" className={ETIQUETA}>
              Codigo de verificacion
            </label>
            <div className={`${CAJA} ${errorCodigo ? CAJA_ERROR : "border-borde"}`}>
              <KeyRound aria-hidden="true" className={ICONO} />
              <input
                id="codigo"
                name="codigo"
                type="text"
                inputMode="text"
                autoComplete="one-time-code"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                required
                maxLength={16}
                placeholder="123 456"
                aria-invalid={errorCodigo ? true : undefined}
                aria-describedby={errorCodigo ? "codigo-error" : "codigo-ayuda"}
                className={ENTRADA}
              />
            </div>
            {errorCodigo ? (
              <p id="codigo-error" role="alert" className={ERROR}>
                {errorCodigo}
              </p>
            ) : (
              <p id="codigo-ayuda" className="mt-1.5 text-[11.5px] leading-relaxed text-suave">
                Los seis digitos de tu app, o un codigo de respaldo.
              </p>
            )}
          </div>

          {/* La animacion va en el envoltorio y no en el boton, como en el
              login: puesta en el boton anularia el translateY del hover. */}
          <div style={retraso("0.2s")} className="surge mt-[22px] lg:mt-[26px]">
            <Boton
              type="submit"
              disabled={enviando}
              className="min-h-[52px] w-full text-[14.5px]"
            >
              {enviando ? "Entrando..." : "Entrar"}
              {!enviando && <ArrowRight aria-hidden="true" />}
            </Boton>
          </div>
        </form>

        <p
          style={retraso("0.24s")}
          className="surge mt-6 border-t border-borde pt-[18px] text-center text-[11.5px] leading-[1.55] text-suave lg:mt-[30px] lg:pt-[22px] lg:text-left lg:text-[12.5px] lg:leading-relaxed"
        >
          Sin telefono ni codigos de respaldo, un administrador puede retirarte
          la verificacion.{" "}
          <Link
            href="/login"
            className="font-semibold text-acento underline underline-offset-2"
          >
            Entrar con otra cuenta
          </Link>
        </p>
      </div>
    </section>
  );
}
