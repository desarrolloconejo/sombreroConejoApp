import type { ReactNode } from "react";

/**
 * Esqueleto de Mi perfil.
 *
 * Copia la geometria real de la page: las dos columnas de arriba, las
 * tarjetas a todo el ancho de debajo y los mismos altos de campo. Es lo que evita que al llegar
 * los datos la pagina se reacomode delante de quien la esta mirando.
 *
 * Todo va marcado como decorativo salvo el aviso para lectores de pantalla:
 * la forma de las cajas no significa nada para quien no las ve, y el estado
 * de carga se anuncia una sola vez.
 */

const TARJETA =
  "rounded-[15px] border border-borde bg-superficie p-[22px] shadow-[var(--sombra)]";

/** Cabecera de tarjeta: el icono y sus dos lineas de texto. */
function CabeceraHueso() {
  return (
    <div className="mb-[18px] flex items-center gap-2.5">
      <div className="hueso size-[17px] shrink-0 rounded-md" />
      <div className="min-w-0 flex-1">
        <div className="hueso h-[15px] w-[130px]" />
        <div className="hueso mt-[5px] h-3 w-[190px]" />
      </div>
    </div>
  );
}

/** Etiqueta y control de un campo de formulario. */
function CampoHueso({
  ancho = "w-[70px]",
  className,
}: {
  ancho?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className={`hueso h-3 ${ancho}`} />
      <div className="hueso mt-2 h-11 rounded-xl" />
    </div>
  );
}

function Tarjeta({ children }: { children: ReactNode }) {
  return <div className={TARJETA}>{children}</div>;
}

export default function CargandoPerfil() {
  return (
    <div role="status" aria-label="Cargando tu perfil">
      <div aria-hidden="true">
        {/* Migas */}
        <div className="hueso mb-3 h-3 w-[150px] lg:mb-[13px]" />

        {/* Cabecera: kicker, titulo y descripcion */}
        <div className="mb-5 border-b border-borde pb-[18px] lg:mb-6 lg:pb-5">
          <div className="hueso h-3.5 w-[76px]" />
          <div className="hueso mt-[5px] h-[26px] w-[170px] lg:mt-1.5 lg:h-9 lg:w-[210px]" />
          <div className="hueso mt-2 h-3.5 w-[260px] lg:mt-[9px] lg:h-4 lg:w-[330px]" />
        </div>

        <div className="grid gap-5 lg:grid-cols-[348px_minmax(0,1fr)] lg:items-start">
          <div className="flex flex-col gap-5">
            {/* Foto */}
            <Tarjeta>
              <div className="flex flex-col items-center pt-1 pb-0.5">
                <div className="hueso size-[108px] rounded-full" />
                <div className="hueso mt-3.5 h-[17px] w-[150px]" />
                <div className="hueso mt-[5px] h-3 w-[170px]" />

                <div className="mt-3 flex gap-[7px]">
                  <div className="hueso h-[26px] w-[72px] rounded-full" />
                  <div className="hueso h-[26px] w-[92px] rounded-full" />
                </div>

                <div className="mt-4 w-full border-t border-borde pt-3.5">
                  <div className="hueso h-3 w-full" />
                  <div className="hueso mt-2 h-3 w-[60%]" />
                </div>
              </div>
            </Tarjeta>

            {/* Tema */}
            <Tarjeta>
              <CabeceraHueso />
              <div className="grid grid-cols-3 gap-[9px]">
                <div className="hueso h-[70px] rounded-[11px]" />
                <div className="hueso h-[70px] rounded-[11px]" />
                <div className="hueso h-[70px] rounded-[11px]" />
              </div>
            </Tarjeta>
          </div>

          <div className="flex flex-col gap-5">
            {/* Datos personales */}
            <Tarjeta>
              <CabeceraHueso />

              <div className="grid gap-[15px] sm:grid-cols-2">
                <CampoHueso ancho="w-[58px]" />
                <CampoHueso ancho="w-[62px]" />
                <CampoHueso ancho="w-[64px]" />
                <CampoHueso ancho="w-[46px]" />
                <CampoHueso ancho="w-[52px]" className="sm:col-span-2" />
              </div>

              <div className="mt-5 flex justify-end border-t border-borde pt-[18px]">
                <div className="hueso h-11 w-[168px] rounded-xl" />
              </div>
            </Tarjeta>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-5">
          {/* Cambiar contrasena */}
          <Tarjeta>
            <CabeceraHueso />

            <div className="grid gap-[15px] sm:grid-cols-2">
              <CampoHueso ancho="w-[112px]" className="sm:col-span-2" />
              <CampoHueso ancho="w-[118px]" />
              <CampoHueso ancho="w-[104px]" />
            </div>

            <div className="mt-3 flex flex-col gap-1.5">
              <div className="hueso h-3 w-[142px]" />
              <div className="hueso h-3 w-[186px]" />
              <div className="hueso h-3 w-[128px]" />
            </div>

            <div className="mt-5 flex justify-end gap-2.5 border-t border-borde pt-[18px]">
              <div className="hueso h-11 w-[104px] rounded-xl" />
              <div className="hueso h-11 w-[196px] rounded-xl" />
            </div>
          </Tarjeta>

          {/* Verificacion en dos pasos */}
          <Tarjeta>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="hueso h-3.5 w-[172px]" />
                <div className="hueso mt-[5px] h-3 w-full max-w-[420px]" />
              </div>
              <div className="hueso h-6 w-[86px] rounded-full" />
            </div>
            <div className="mt-5 border-t border-borde pt-5">
              <div className="hueso h-11 w-[186px] rounded-xl" />
            </div>
          </Tarjeta>

          {/* Sesiones abiertas */}
          <Tarjeta>
            <div className="hueso h-3.5 w-[128px]" />
            <div className="hueso mt-[5px] h-3 w-full max-w-[420px]" />

            <div className="mt-4 flex items-center gap-3 border-t border-borde py-3">
              <div className="hueso size-[18px] shrink-0 rounded" />
              <div className="min-w-0 flex-1">
                <div className="hueso h-3.5 w-[150px]" />
                <div className="hueso mt-1.5 h-3 w-[190px]" />
              </div>
              <div className="hueso h-6 w-[86px] rounded-full" />
            </div>
          </Tarjeta>

          {/* Cerrar sesion */}
          <Tarjeta>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="hueso h-3.5 w-[112px]" />
                <div className="hueso mt-[5px] h-3 w-full max-w-[380px]" />
                <div className="hueso mt-2.5 h-3 w-[210px]" />
              </div>
              <div className="hueso h-11 w-full rounded-xl sm:w-[160px]" />
            </div>
          </Tarjeta>
        </div>
      </div>

      <span className="sr-only">Cargando</span>
    </div>
  );
}
