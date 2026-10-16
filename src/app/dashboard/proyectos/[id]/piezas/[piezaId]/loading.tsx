/**
 * Esqueleto de la ficha de una pieza: la cabecera con su bateria, las cinco
 * fases a la izquierda y el copy y los comentarios a la derecha.
 */

export default function CargandoPieza() {
  return (
    <div role="status" aria-label="Cargando la pieza">
      <div aria-hidden="true">
        <div className="mb-3 flex items-center gap-[7px] lg:mb-[13px]">
          <div className="hueso h-3 w-[78px]" />
          <div className="hueso size-[9px]" />
          <div className="hueso h-3 w-[62px]" />
          <div className="hueso size-[9px]" />
          <div className="hueso h-3 w-[110px]" />
          <div className="hueso size-[9px]" />
          <div className="hueso h-3 w-[96px]" />
        </div>

        <div className="mb-5 border-b border-borde pb-[18px] lg:mb-6 lg:pb-5">
          <div className="hueso h-3.5 w-[180px]" />
          <div className="hueso mt-2.5 h-[28px] w-[240px] lg:mt-[9px] lg:h-[42px] lg:w-[340px]" />
        </div>

        <div className="rounded-[15px] border border-borde bg-superficie p-5 shadow-[var(--sombra)] sm:p-6">
          <div className="flex items-center gap-4">
            <div className="hueso h-7 w-[190px] rounded-[6px]" />
            <div>
              <div className="hueso h-4 w-[220px]" />
              <div className="hueso mt-2 h-3 w-[180px]" />
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div>
            <div className="hueso mb-4 h-[19px] w-[140px]" />
            <div className="flex flex-col gap-4">
              {[0, 1, 2, 3, 4].map((indice) => (
                <div
                  key={indice}
                  className="flex items-start gap-4 rounded-[15px] border border-borde bg-superficie p-5 shadow-[var(--sombra)] sm:p-6"
                >
                  <div className="hueso size-9 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <div className="hueso h-4 w-[60%]" />
                    <div className="hueso mt-2 h-3 w-[40%]" />
                    {(indice === 0 || indice === 2) && (
                      <div className="mt-4 flex flex-col gap-2.5">
                        <div className="hueso h-14 rounded-xl" />
                        <div className="hueso h-14 rounded-xl" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="hueso -mb-2 h-[19px] w-[90px]" />
            {[240, 200].map((alto) => (
              <div
                key={alto}
                style={{ height: alto }}
                className="rounded-[15px] border border-borde bg-superficie p-5 shadow-[var(--sombra)] sm:p-6"
              >
                <div className="hueso h-4 w-[110px]" />
                <div className="hueso mt-5 h-[76px] rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <span className="sr-only">Cargando</span>
    </div>
  );
}
