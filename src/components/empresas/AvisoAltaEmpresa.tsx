import { Building2 } from "lucide-react";

import { BotonEnlace } from "@/components/ui";

/**
 * Lo que ve quien no es administrador al pulsar «Nueva empresa» en hooks.
 *
 * POR QUE UN AVISO Y NO NADA
 * --------------------------
 * El alta de empresas se movio a su modulo, que es solo de administradores.
 * Quitar el boton sin mas dejaria a quien escribe hooks delante del mismo
 * callejon sin salida que habia antes de que existiera el alta: un desplegable
 * de clientes al que le falta uno y ninguna pista de que hacer.
 *
 * Y mandarlo al modulo seria peor: llegaria a una pantalla que no puede abrir,
 * porque el proxy la corta por rol.
 *
 * Asi que el boton se queda y dice quien lo hace. Es la respuesta a la pregunta
 * que uno tiene en ese momento, que no es «donde se crean» sino «como consigo
 * la que me falta».
 */
export function AvisoAltaEmpresa({ hrefCerrar }: { hrefCerrar: string }) {
  return (
    <div>
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-acento-tenue text-acento"
        >
          <Building2 className="size-5" />
        </span>

        <div className="min-w-0">
          <p>
            Las empresas cliente las registra un{" "}
            <strong className="font-semibold text-texto">administrador</strong>,
            desde el modulo de Empresas.
          </p>

          <p className="mt-3 text-suave">
            Pidele que la de de alta y aparecera en el desplegable de clientes.
            Es cosa de un minuto: solo hace falta el nombre.
          </p>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <BotonEnlace href={hrefCerrar} tamano="chico">
          Entendido
        </BotonEnlace>
      </div>
    </div>
  );
}
