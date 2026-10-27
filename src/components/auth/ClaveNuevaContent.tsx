"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowRight, CircleAlert, Eye, EyeOff, Lock } from "lucide-react";

import { ponerClaveNueva } from "@/actions/recuperarClave";
import { Alerta, Boton } from "@/components/ui";
import { ESTADO_INICIAL } from "@/types";
import { CAJA, CAJA_ERROR, ENTRADA, ERROR, ETIQUETA, ICONO, retraso } from "./estilosAcceso";

/**
 * La contrasena nueva, desde el enlace del correo.
 *
 * El token viaja en un campo oculto; la action lo vuelve a comprobar y lo
 * gasta. Si el enlace ya no sirve (`valido` en false, o lo dice la action),
 * se ofrece pedir otro.
 */
export function ClaveNuevaContent({ token, valido }: { token: string; valido: boolean }) {
  const [estado, enviar, enviando] = useActionState(ponerClaveNueva, ESTADO_INICIAL);
  const [ver, setVer] = useState(false);

  // Controlados: React vacia los campos al terminar la action, y un error en
  // la confirmacion borraria tambien la contrasena ya escrita.
  const [valores, setValores] = useState({ passwordNueva: "", passwordConfirmacion: "" });

  const errorNueva = estado.errores?.passwordNueva;
  const errorConfirmacion = estado.errores?.passwordConfirmacion;
  const caducado = !valido || Boolean(estado.mensaje && !estado.errores);

  return (
    <section className="flex flex-1 flex-col px-[26px] pt-[30px] pb-6 lg:items-center lg:justify-center lg:p-10">
      <div className="w-full lg:w-[400px]">
        <p className="surge m-0 mb-1.5 text-[12.5px] font-bold text-acento lg:mb-2 lg:text-[13.5px]">
          Contrasena nueva
        </p>

        <h1
          style={retraso("0.05s")}
          className="surge m-0 mb-[7px] text-[23px] leading-[1.1] font-extrabold tracking-[-0.025em] lg:mb-2.5 lg:text-[40px] lg:leading-[1.05] lg:tracking-[-0.035em]"
        >
          {caducado ? "Este enlace ya no sirve" : "Elige tu contrasena"}
        </h1>

        {caducado ? (
          <>
            <p
              style={retraso("0.09s")}
              className="surge m-0 mb-6 text-[13px] leading-[1.55] text-suave lg:mb-[34px] lg:text-sm lg:leading-relaxed"
            >
              {estado.mensaje ??
                "Vencio, ya se uso o se pidio otro despues. Cada enlace sirve una vez y durante 30 minutos."}
            </p>
            <div style={retraso("0.13s")} className="surge">
              <Link
                href="/recuperar"
                className="suave inline-flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-xl bg-acento px-5 text-[14.5px] font-semibold text-acento-contraste hover:-translate-y-0.5 hover:bg-acento-hover [&>svg]:size-[17px]"
              >
                Pedir otro enlace
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </>
        ) : (
          <>
            <p
              style={retraso("0.09s")}
              className="surge m-0 mb-6 text-[13px] leading-[1.55] text-suave lg:mb-[34px] lg:text-sm lg:leading-relaxed"
            >
              Al guardarla se cierran las sesiones que tengas abiertas; despues entras con ella.
            </p>

            <form action={enviar} noValidate>
              <input type="hidden" name="token" value={token} />

              {(
                [
                  ["passwordNueva", "Contrasena nueva", errorNueva, "new-password"],
                  ["passwordConfirmacion", "Repitela", errorConfirmacion, "new-password"],
                ] as const
              ).map(([nombre, etiqueta, error, autocompletar], indice) => (
                <div
                  key={nombre}
                  style={retraso(indice === 0 ? "0.13s" : "0.17s")}
                  className="surge mb-[15px] lg:mb-[18px]"
                >
                  <label htmlFor={nombre} className={ETIQUETA}>
                    {etiqueta}
                  </label>
                  <div className={`${CAJA} ${error ? CAJA_ERROR : "border-borde"}`}>
                    <Lock aria-hidden="true" className={ICONO} />
                    <input
                      id={nombre}
                      name={nombre}
                      type={ver ? "text" : "password"}
                      value={valores[nombre]}
                      onChange={(evento) => setValores((previos) => ({ ...previos, [nombre]: evento.target.value }))}
                      autoComplete={autocompletar}
                      autoFocus={indice === 0}
                      required
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? `${nombre}-error` : undefined}
                      className={ENTRADA}
                    />
                    {indice === 0 && (
                      <button
                        type="button"
                        onClick={() => setVer((visible) => !visible)}
                        aria-label={ver ? "Ocultar contrasena" : "Mostrar contrasena"}
                        aria-pressed={ver}
                        className="suave -mr-2.5 ml-auto grid size-11 shrink-0 place-items-center rounded-[10px] text-suave hover:bg-acento-tenue hover:text-acento lg:-mr-[11px]"
                      >
                        {ver ? (
                          <EyeOff aria-hidden="true" className="size-[18px]" />
                        ) : (
                          <Eye aria-hidden="true" className="size-[18px]" />
                        )}
                      </button>
                    )}
                  </div>
                  {error && (
                    <p id={`${nombre}-error`} role="alert" className={ERROR}>
                      {error}
                    </p>
                  )}
                </div>
              ))}

              {estado.mensaje && estado.errores && (
                <Alerta className="mb-[18px]" icono={<CircleAlert />}>
                  {estado.mensaje}
                </Alerta>
              )}

              <div style={retraso("0.21s")} className="surge mt-[22px] lg:mt-[26px]">
                <Boton type="submit" disabled={enviando} className="min-h-[52px] w-full text-[14.5px]">
                  {enviando ? "Guardando..." : "Guardar la contrasena"}
                  {!enviando && <ArrowRight aria-hidden="true" />}
                </Boton>
              </div>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
