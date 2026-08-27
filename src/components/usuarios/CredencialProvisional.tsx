"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, TriangleAlert } from "lucide-react";

/**
 * La contrasena provisional recien generada, para entregarla en mano.
 *
 * Se muestra UNA sola vez: en la base solo queda su hash, asi que si esta
 * pantalla se cierra sin copiarla, la unica salida es volver a restablecerla.
 * Todo lo de aqui esta puesto para que eso no ocurra por descuido:
 *
 * - Ocupa el panel entero en lugar de ser un aviso sobre el formulario. Antes
 *   la clave llegaba dentro de una frase, arriba de un cuerpo con scroll, y
 *   quien acababa de pulsar el boton estaba abajo: no se veia nunca.
 * - La clave va en monoespaciada y grande, que es como se dicta sin
 *   equivocarse. El alfabeto ya evita los caracteres que se confunden —ni ele
 *   minuscula ni i mayuscula ni uno, ni o mayuscula ni cero— porque esto se
 *   comunica de viva voz.
 * - El boton de copiar confirma que copio. Un boton que no responde deja a
 *   quien lo pulsa sin saber si puede cerrar ya.
 */
export function CredencialProvisional({
  email,
  password,
  titulo,
  descripcion,
}: {
  email: string;
  password: string;
  titulo: string;
  descripcion: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const [fallo, setFallo] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(password);
      setFallo(false);
      setCopiado(true);
      // Vuelve a su estado normal para que se pueda copiar otra vez sin
      // tener que recargar nada.
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      // El portapapeles puede estar denegado por permisos o por un contexto
      // no seguro. No es motivo para dejar a nadie sin la clave: sigue en
      // pantalla, y se avisa de que hay que copiarla a mano.
      setFallo(true);
    }
  }

  return (
    <div className="text-center">
      <span
        aria-hidden="true"
        className="mx-auto grid size-12 place-items-center rounded-full bg-acento text-acento-contraste [&>svg]:size-[22px]"
      >
        <KeyRound />
      </span>

      <h3 className="mt-4 text-[19px] leading-snug font-extrabold tracking-[-0.022em]">
        {titulo}
      </h3>

      <p className="mx-auto mt-2 max-w-[42ch] text-[12.5px] leading-relaxed text-suave">
        {descripcion}
      </p>

      <div className="mt-5 rounded-[15px] border border-borde bg-campo p-5 text-left">
        <p className="text-[10.5px] font-bold tracking-[0.1em] text-suave uppercase">
          Correo
        </p>
        <p className="mt-1 text-[13.5px] font-semibold break-all">{email}</p>

        <p className="mt-4 text-[10.5px] font-bold tracking-[0.1em] text-suave uppercase">
          Contrasena provisional
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
          <code className="min-w-0 flex-1 rounded-xl border border-borde bg-superficie px-3.5 py-3 font-mono text-[17px] font-semibold tracking-[0.06em] break-all">
            {password}
          </code>

          <button
            type="button"
            onClick={copiar}
            aria-live="polite"
            className="suave inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-acento px-4 text-[13px] font-semibold text-acento-contraste hover:bg-acento-hover"
          >
            {copiado ? (
              <>
                <Check aria-hidden="true" className="size-4" />
                Copiada
              </>
            ) : (
              <>
                <Copy aria-hidden="true" className="size-4" />
                Copiar
              </>
            )}
          </button>
        </div>

        {fallo && (
          <p role="alert" className="mt-2.5 text-[11.5px] leading-relaxed text-suave">
            El navegador no dejo copiar al portapapeles. Seleccionala y copiala
            a mano antes de cerrar.
          </p>
        )}
      </div>

      <p className="mt-4 flex items-start gap-2.5 rounded-xl border border-blackberry/25 bg-blackberry/[0.07] p-3.5 text-left text-[12.5px] leading-relaxed">
        <TriangleAlert
          aria-hidden="true"
          className="mt-px size-4 shrink-0 text-blackberry dark-tema:text-[#e9a9cd]"
        />
        <span>
          <b>No se vuelve a mostrar.</b> En la base solo queda cifrada. Si la
          pierdes, tendras que restablecerla desde el listado y entregar una
          nueva.
        </span>
      </p>
    </div>
  );
}
