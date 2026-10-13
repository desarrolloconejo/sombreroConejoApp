"use client";

import { useActionState, useState } from "react";
import { Check, Copy, KeyRound, LoaderCircle, Smartphone } from "lucide-react";

import { confirmarDosPasos, iniciarDosPasos } from "@/actions/dosPasos";
import { Alerta, Boton, Campo } from "@/components/ui";
import { ESTADO_INICIAL, type EstadoDosPasos } from "@/types";

/**
 * La configuracion de la verificacion en dos pasos, en tres momentos:
 *
 *   1. Empezar.
 *   2. Registrar la cuenta en la app de codigos y confirmar con un codigo.
 *   3. Guardar los codigos de respaldo, que solo se ven aqui.
 *
 * Es de cliente porque cada momento depende de la respuesta del anterior. El
 * secreto y los codigos de respaldo llegan de la action y viven solo en el
 * estado de este componente: no se guardan en el navegador.
 */

/** La action de empezar no usa lo que `useActionState` le pasa. */
async function empezar(): Promise<EstadoDosPasos> {
  return iniciarDosPasos();
}

export function ConfigurarDosPasos({
  hrefAlTerminar,
}: {
  /** A donde lleva el boton final, una vez guardados los codigos. */
  hrefAlTerminar: string;
}) {
  const [inicio, iniciar, iniciando] = useActionState(
    empezar,
    ESTADO_INICIAL as EstadoDosPasos,
  );
  const [confirmacion, confirmar, confirmando] = useActionState(
    confirmarDosPasos,
    ESTADO_INICIAL as EstadoDosPasos,
  );
  const [copiado, setCopiado] = useState(false);

  // Tras un codigo equivocado la action devuelve el mismo secreto: manda la
  // respuesta mas reciente.
  const secreto = confirmacion.secreto ?? inicio.secreto;
  const enlace = confirmacion.enlace ?? inicio.enlace;
  const respaldos = confirmacion.respaldos;

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2200);
    } catch {
      // Sin permiso para el portapapeles, el texto sigue a la vista.
    }
  }

  // --- 3. Activada: los codigos de respaldo, una sola vez -------------------
  if (respaldos) {
    return (
      <div>
        <Alerta className="mb-5" icono={<Check />}>
          <b className="font-semibold">Quedo activada.</b> A partir de ahora, al
          entrar se te pedira el codigo de tu app.
        </Alerta>

        <p className="text-[13.5px] font-semibold">Guarda estos codigos de respaldo</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-suave">
          Cada uno sirve una vez para entrar si no tienes el telefono. No se
          vuelven a mostrar: copialos ahora y guardalos fuera de este equipo.
        </p>

        <ul
          aria-label="Codigos de respaldo"
          className="mt-4 grid grid-cols-2 gap-2 rounded-[13px] border border-borde bg-campo p-4 font-mono text-[13px] tabular-nums"
        >
          {respaldos.map((codigo) => (
            <li key={codigo}>{codigo}</li>
          ))}
        </ul>

        <div className="mt-5 flex flex-wrap justify-end gap-2.5">
          <Boton
            type="button"
            variante="fantasma"
            onClick={() => copiar(respaldos.join("\n"))}
          >
            {copiado ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            <span aria-live="polite">{copiado ? "Copiados" : "Copiar los codigos"}</span>
          </Boton>

          {/*
            Carga completa y con `replace`, no un enlace del router: hay que
            volver a pedir la pantalla al servidor, ya con los dos pasos
            activados, y los codigos no deben quedar a un «atras» de distancia.
          */}
          <Boton type="button" onClick={() => window.location.replace(hrefAlTerminar)}>
            Ya los guarde
          </Boton>
        </div>
      </div>
    );
  }

  // --- 2. Con el secreto: registrar en la app y confirmar -------------------
  if (secreto && enlace) {
    return (
      <div>
        <ol className="flex flex-col gap-4 text-[13px] leading-relaxed">
          <li>
            <b className="font-semibold">1. Abre tu app de codigos</b>
            <span className="block text-suave">
              Google Authenticator, Microsoft Authenticator o Authy. Elige «anadir
              cuenta» y «introducir clave de configuracion».
            </span>
          </li>

          <li>
            <b className="font-semibold">2. Escribe esta clave</b>
            <span className="mt-2 flex flex-wrap items-center gap-2.5">
              <code className="rounded-[10px] border border-borde bg-campo px-3 py-2 font-mono text-[13px] tracking-wide break-all">
                {secreto}
              </code>
              <Boton
                type="button"
                variante="fantasma"
                tamano="chico"
                onClick={() => copiar(secreto.replace(/\s/g, ""))}
              >
                {copiado ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                <span aria-live="polite">{copiado ? "Copiada" : "Copiar"}</span>
              </Boton>
            </span>
            <span className="mt-2 block text-suave">
              Tipo de clave: basada en tiempo. Si estas en el telefono,{" "}
              <a href={enlace} className="font-semibold text-acento underline">
                abre la app con este enlace
              </a>{" "}
              y se registra sola.
            </span>
          </li>

          <li>
            <b className="font-semibold">3. Escribe el codigo que te muestra</b>
          </li>
        </ol>

        <form action={confirmar} className="mt-3" noValidate>
          <Campo
            id="dos-pasos-codigo"
            name="codigo"
            etiqueta="Codigo de seis digitos"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            placeholder="123 456"
            error={confirmacion.errores?.codigo}
            icono={<KeyRound />}
            required
          />

          {confirmacion.mensaje && !confirmacion.ok && (
            <Alerta className="mt-4">{confirmacion.mensaje}</Alerta>
          )}

          <div className="mt-5 flex justify-end">
            <Boton type="submit" disabled={confirmando}>
              {confirmando ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : (
                <Check aria-hidden="true" />
              )}
              Activar
            </Boton>
          </div>
        </form>
      </div>
    );
  }

  // --- 1. Empezar ----------------------------------------------------------
  return (
    <form action={iniciar}>
      {inicio.mensaje && !inicio.ok && <Alerta className="mb-4">{inicio.mensaje}</Alerta>}

      <Boton type="submit" disabled={iniciando}>
        {iniciando ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : (
          <Smartphone aria-hidden="true" />
        )}
        Configurar ahora
      </Boton>
    </form>
  );
}
