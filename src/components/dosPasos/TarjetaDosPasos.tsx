"use client";

import { useActionState, type CSSProperties } from "react";
import { LoaderCircle, ShieldCheck, ShieldOff } from "lucide-react";

import { desactivarDosPasos } from "@/actions/dosPasos";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { Boton, Campo, Etiqueta } from "@/components/ui";
import { ESTADO_INICIAL, type EstadoDosPasos } from "@/types";

import { ConfigurarDosPasos } from "./ConfigurarDosPasos";

/**
 * La verificacion en dos pasos, en Mi perfil.
 *
 * Activada, dice desde cuando y cuantos codigos de respaldo quedan, y deja
 * desactivarla con la contrasena. Sin activar, ofrece configurarla.
 */

const TARJETA =
  "surge rounded-[15px] border border-borde bg-superficie p-[22px] shadow-[var(--sombra)]";

export function TarjetaDosPasos({
  activado,
  desde,
  respaldos,
}: {
  activado: boolean;

  /** Cuando se activo, ya formateado en el servidor. */
  desde: string | null;
  respaldos: number;
}) {
  const [estado, desactivar, desactivando] = useActionState(
    desactivarDosPasos,
    ESTADO_INICIAL as EstadoDosPasos,
  );

  useAvisoDeAccion(estado);

  return (
    <section
      style={{ "--retraso": "0.14s" } as CSSProperties}
      className={TARJETA}
      aria-labelledby="perfil-dos-pasos"
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <b id="perfil-dos-pasos" className="block text-[13.5px] font-semibold">
            Verificacion en dos pasos
          </b>

          <p className="mt-[3px] text-xs leading-[1.5] text-suave">
            Ademas de la contrasena, al entrar se pide un codigo de tu app de
            codigos (Google Authenticator o compatible). Aunque alguien conozca
            tu contrasena, sin tu telefono no entra.
          </p>
        </div>

        <Etiqueta>{activado ? "Activada" : "Sin activar"}</Etiqueta>
      </div>

      <div className="mt-5 border-t border-borde pt-5">
        {activado ? (
          <>
            <p className="flex items-center gap-2 text-[12.5px]">
              <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-acento" />
              <span>
                Activa{desde ? ` desde el ${desde}` : ""}. Te{" "}
                {respaldos === 1 ? "queda" : "quedan"}{" "}
                <b className="font-semibold">{respaldos}</b>{" "}
                {respaldos === 1 ? "codigo" : "codigos"} de respaldo.
              </span>
            </p>

            <form action={desactivar} className="mt-5" noValidate>
              <Campo
                id="dos-pasos-password"
                name="password"
                type="password"
                etiqueta="Para desactivarla, escribe tu contrasena"
                autoComplete="current-password"
                error={estado.errores?.password}
                required
              />

              <div className="mt-4 flex justify-end">
                <Boton type="submit" variante="peligro" disabled={desactivando}>
                  {desactivando ? (
                    <LoaderCircle aria-hidden="true" className="animate-spin" />
                  ) : (
                    <ShieldOff aria-hidden="true" />
                  )}
                  Desactivar
                </Boton>
              </div>
            </form>
          </>
        ) : (
          <ConfigurarDosPasos hrefAlTerminar="/dashboard/perfil" />
        )}
      </div>
    </section>
  );
}
