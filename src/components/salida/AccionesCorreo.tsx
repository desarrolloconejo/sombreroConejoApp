"use client";

import { useActionState, useState } from "react";
import { Check, Copy, LoaderCircle, RotateCw } from "lucide-react";

import { marcarCorreoEntregado, reintentarCorreo } from "@/actions/correos";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { Boton } from "@/components/ui";
import { ESTADO_INICIAL } from "@/types";

/**
 * Lo que se puede hacer con un correo abierto: copiarlo, y segun su estado,
 * anotarlo como entregado a mano o reintentar el envio.
 *
 * Es de cliente por el portapapeles y por `useActionState`. El texto del
 * correo lo pinta el servidor; aqui solo llega para poder copiarlo.
 */
export function AccionesCorreo({
  id,
  texto,
  puedeMarcar,
  puedeReintentar,
}: {
  id: number;

  /** El correo completo, tal como se pegaria en otro sitio. */
  texto: string;
  puedeMarcar: boolean;
  puedeReintentar: boolean;
}) {
  const [copiado, setCopiado] = useState(false);

  const [marcado, marcar, marcando] = useActionState(
    marcarCorreoEntregado,
    ESTADO_INICIAL,
  );
  const [reintento, reintentar, reintentando] = useActionState(
    reintentarCorreo,
    ESTADO_INICIAL,
  );

  useAvisoDeAccion(marcado);
  useAvisoDeAccion(reintento);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2200);
    } catch {
      // Sin permiso para el portapapeles (o en http fuera de localhost) no
      // se puede copiar: el texto sigue a la vista para seleccionarlo.
      setCopiado(false);
    }
  }

  return (
    <div className="flex flex-wrap justify-end gap-2.5">
      <Boton type="button" variante="fantasma" tamano="chico" onClick={copiar}>
        {copiado ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        <span aria-live="polite">{copiado ? "Copiado" : "Copiar el correo"}</span>
      </Boton>

      {puedeReintentar && (
        <form action={reintentar}>
          <input type="hidden" name="id" value={id} />
          <Boton type="submit" tamano="chico" disabled={reintentando}>
            {reintentando ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <RotateCw aria-hidden="true" />
            )}
            Reintentar el envio
          </Boton>
        </form>
      )}

      {/* Una vez marcado el boton desaparece: dejarlo invitaria a pulsarlo
          otra vez sobre algo que ya esta hecho. */}
      {puedeMarcar && !marcado.ok && (
        <form action={marcar}>
          <input type="hidden" name="id" value={id} />
          <Boton type="submit" tamano="chico" disabled={marcando}>
            {marcando ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <Check aria-hidden="true" />
            )}
            Ya lo entregue
          </Boton>
        </form>
      )}
    </div>
  );
}
