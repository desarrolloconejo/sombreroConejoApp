"use client";

import { useActionState, useState } from "react";
import type { CSSProperties } from "react";
import {
  ArrowRight,
  CircleAlert,
  Eye,
  EyeOff,
  Lock,
  Mail,
} from "lucide-react";
import { iniciarSesion } from "@/actions/auth";
import { Alerta, Boton } from "@/components/ui";
import { ESTADO_INICIAL } from "@/types";

/**
 * El formulario de acceso.
 *
 * Es de cliente por dos motivos concretos: `useActionState` para pintar los
 * errores que devuelve la action sin recargar, y el conmutador de mostrar la
 * contrasena. El resto del login son componentes de servidor.
 */

/**
 * La caja del campo. El borde y el foco viven en el contenedor y no en el
 * input porque dentro tambien hay un icono y, en la contrasena, un boton.
 * De ahi `focus-within` en lugar de `focus`.
 *
 * Al enfocar, el campo se ELEVA: fondo blanco, borde navy y una sombra
 * suave. Un halo de color alrededor se lee como un error, y ademas pisa la
 * senal que si tiene que significar eso.
 */
const CAJA =
  "flex min-h-[50px] items-center gap-2.5 rounded-[11px] border-[1.5px] bg-campo px-3.5 " +

  "focus-within:border-acento focus-within:bg-superficie focus-within:shadow-[var(--foco)] " +
  "" +
  "lg:gap-[11px] lg:px-[15px]";

const CAJA_ERROR = "border-blackberry dark-tema:border-[#e9a9cd]";

const ENTRADA =
  "w-full min-w-0 border-none bg-transparent text-[13.5px] text-texto " +
  // El foco lo pinta la caja de fuera con focus-within. Si el input pintara
  // ademas el suyo, se verian dos anillos superpuestos.
  "outline-none focus:outline-none focus-visible:outline-none " +
  "placeholder:text-suave lg:text-sm";

const ICONO = "size-4 shrink-0 text-suave lg:size-[17px]";

const ERROR =
  "mt-1.5 text-[11.5px] font-medium leading-relaxed text-blackberry dark-tema:text-[#e9a9cd]";

function retraso(segundos: string): CSSProperties {
  return { "--retraso": segundos } as CSSProperties;
}

/** Por que alguien llego al login sin haberlo pedido. */
export type MotivoSalida = "sin-acceso" | "caducada";

const AVISOS: Record<MotivoSalida, string> = {
  "sin-acceso": "Tu cuenta ya no tiene acceso. Habla con un administrador",
  caducada: "Tu sesion termino. Vuelve a entrar para continuar",
};

export function LoginContent({
  volverA,
  motivo,
}: {
  volverA: string;
  motivo: MotivoSalida | null;
}) {
  const [estado, enviar, enviando] = useActionState(iniciarSesion, ESTADO_INICIAL);
  const [verPassword, setVerPassword] = useState(false);

  // El aviso de salida forzada cede el sitio al resultado del intento: en
  // cuanto la persona envia el formulario, lo que importa es esa respuesta.
  const mensaje = estado.mensaje ?? (motivo ? AVISOS[motivo] : undefined);

  const errorEmail = estado.errores?.email;
  const errorPassword = estado.errores?.password;

  return (
    <section className="flex flex-1 flex-col px-[26px] pt-[30px] pb-6 lg:items-center lg:justify-center lg:p-10">
      <div className="w-full lg:w-[400px]">
        <p className="surge m-0 mb-1.5 text-[12.5px] font-bold text-acento lg:mb-2 lg:text-[13.5px]">
          Bienvenido de vuelta
        </p>

        <h1
          style={retraso("0.05s")}
          className="surge m-0 mb-[7px] text-[23px] leading-[1.1] font-extrabold tracking-[-0.025em] lg:mb-2.5 lg:text-[40px] lg:leading-[1.05] lg:tracking-[-0.035em]"
        >
          Inicia sesion
        </h1>

        <p
          style={retraso("0.09s")}
          className="surge m-0 mb-6 text-[13px] leading-[1.55] text-suave lg:mb-[34px] lg:text-sm lg:leading-relaxed"
        >
          Entra con el correo que la agencia te asigno.
          <span className="hidden lg:inline">
            {" "}
            Si aun no tienes acceso, un administrador debe crearte la cuenta.
          </span>
        </p>

        <form action={enviar} noValidate>
          {/* A donde volver despues de entrar. La action comprueba que sea una
              ruta interna antes de usarlo. */}
          <input type="hidden" name="volverA" value={volverA} />

          {mensaje && (
            <Alerta className="surge mb-[18px] lg:mb-[22px]" icono={<CircleAlert />}>
              {mensaje}
            </Alerta>
          )}

          <div style={retraso("0.13s")} className="surge mb-[15px] lg:mb-[18px]">
            <label
              htmlFor="email"
              className="mb-[7px] block text-xs font-semibold lg:mb-2 lg:text-[12.5px]"
            >
              Correo
            </label>
            <div className={`${CAJA} ${errorEmail ? CAJA_ERROR : "border-borde"}`}>
              <Mail aria-hidden="true" className={ICONO} />
              <input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
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

          <div style={retraso("0.17s")} className="surge">
            <label
              htmlFor="password"
              className="mb-[7px] block text-xs font-semibold lg:mb-2 lg:text-[12.5px]"
            >
              Contrasena
            </label>
            <div className={`${CAJA} ${errorPassword ? CAJA_ERROR : "border-borde"}`}>
              <Lock aria-hidden="true" className={ICONO} />
              <input
                id="password"
                name="password"
                type={verPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                placeholder="Tu contrasena"
                aria-invalid={errorPassword ? true : undefined}
                aria-describedby={errorPassword ? "password-error" : undefined}
                className={ENTRADA}
              />
              {/*
                El area tactil es el boton, no el icono: agrandar el svg con
                padding lo saca de la caja del campo.
              */}
              <button
                type="button"
                onClick={() => setVerPassword((visible) => !visible)}
                aria-label={verPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                aria-pressed={verPassword}
                aria-controls="password"
                className={
                  "-mr-2.5 ml-auto grid size-11 shrink-0 cursor-pointer place-items-center " +
                  "rounded-[10px] text-suave " +
                  "suave hover:bg-acento-tenue hover:text-acento lg:-mr-[11px]"
                }
              >
                {verPassword ? (
                  <EyeOff aria-hidden="true" className="size-[18px]" />
                ) : (
                  <Eye aria-hidden="true" className="size-[18px]" />
                )}
              </button>
            </div>
            {errorPassword && (
              <p id="password-error" role="alert" className={ERROR}>
                {errorPassword}
              </p>
            )}
          </div>

          {/*
            La animacion va en el envoltorio y no en el boton: `surge` termina
            con animation-fill-mode both, y una declaracion de animacion gana
            a una normal. Puesta en el boton, su `transform: none` final
            anularia para siempre el translateY del hover.
          */}
          <div style={retraso("0.24s")} className="surge mt-[22px] lg:mt-[26px]">
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
          style={retraso("0.28s")}
          className="surge mt-6 border-t border-borde pt-[18px] text-center text-[11.5px] leading-[1.55] text-suave lg:mt-[30px] lg:pt-[22px] lg:text-left lg:text-[12.5px] lg:leading-relaxed"
        >
          Las cuentas las crea unicamente un administrador.
          <span className="hidden lg:inline">
            {" "}
            Si necesitas acceso, escribe a soporte interno.
          </span>
        </p>
      </div>
    </section>
  );
}
