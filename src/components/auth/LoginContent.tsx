"use client";

import { useActionState, useState } from "react";
import {
  ArrowRight,
  CircleAlert,
  Eye,
  EyeOff,
  Lock,
  Mail,
} from "lucide-react";
import Link from "next/link";

import { iniciarSesion } from "@/actions/auth";
import { Alerta, Boton } from "@/components/ui";
import { ESTADO_INICIAL } from "@/types";
import { CAJA, CAJA_ERROR, ENTRADA, ERROR, ETIQUETA, ICONO, retraso } from "./estilosAcceso";

/**
 * El formulario de acceso.
 *
 * Es de cliente por dos motivos concretos: `useActionState` para pintar los
 * errores que devuelve la action sin recargar, y el conmutador de mostrar la
 * contrasena. El resto del login son componentes de servidor.
 */

/** Por que alguien llego al login sin haberlo pedido. */
export type MotivoSalida = "sin-acceso" | "caducada" | "clave-nueva";

const AVISOS: Record<MotivoSalida, string> = {
  "sin-acceso": "Tu cuenta ya no tiene acceso. Habla con un administrador",
  caducada: "Tu sesion termino. Vuelve a entrar para continuar",
  "clave-nueva": "Listo: tu contrasena cambio. Entra con la nueva",
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
            <Alerta
              tono={!estado.mensaje && motivo === "clave-nueva" ? "info" : undefined}
              className="surge mb-[18px] lg:mb-[22px]"
              icono={<CircleAlert />}
            >
              {mensaje}
            </Alerta>
          )}

          <div style={retraso("0.13s")} className="surge mb-[15px] lg:mb-[18px]">
            <label
              htmlFor="email"
              className={ETIQUETA}
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
              className={ETIQUETA}
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
            <p className="mt-2 text-right text-[12px]">
              <Link href="/recuperar" className="font-semibold text-acento underline-offset-2 hover:underline">
                ¿Olvidaste tu contrasena?
              </Link>
            </p>
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
