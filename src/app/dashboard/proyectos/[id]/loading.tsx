/**
 * Esqueleto de un proyecto: el resumen con la bateria grande y la matriz de
 * piezas por fases, con sus mismas medidas.
 */

const PIEZAS = [168, 132, 186, 148, 120, 174];

const REJILLA =
  "grid grid-cols-[minmax(150px,1.6fr)_repeat(5,minmax(92px,1fr))_minmax(96px,0.9fr)] items-center gap-2";

export default function CargandoProyecto() {
  return (
    <div role="status" aria-label="Cargando el proyecto">
      <div aria-hidden="true">
        <div className="mb-3 flex items-center gap-[7px] lg:mb-[13px]">
          <div className="hueso h-3 w-[78px]" />
          <div className="hueso size-[9px]" />
          <div className="hueso h-3 w-[62px]" />
          <div className="hueso size-[9px]" />
          <div className="hueso h-3 w-[118px]" />
        </div>

        <div className="mb-5 border-b border-borde pb-[18px] lg:mb-6 lg:pb-5">
          <div className="hueso h-3.5 w-[140px]" />
          <div className="hueso mt-2.5 h-[28px] w-[220px] lg:mt-[9px] lg:h-[42px] lg:w-[320px]" />
        </div>

        <div className="rounded-[15px] border border-borde bg-superficie p-5 shadow-[var(--sombra)] sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="hueso h-7 w-[190px] rounded-[6px]" />
              <div>
                <div className="hueso h-[30px] w-[70px]" />
                <div className="hueso mt-2 h-3 w-[132px]" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="hueso h-10 w-[92px] rounded-[12px]" />
              <div className="hueso h-10 w-[92px] rounded-[12px]" />
              <div className="hueso h-10 w-[128px] rounded-[12px]" />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-borde pt-5 sm:grid-cols-4">
            {[0, 1, 2, 3].map((indice) => (
              <div key={indice}>
                <div className="hueso h-[10px] w-[64px]" />
                <div className="hueso mt-2 h-3.5 w-[104px]" />
              </div>
            ))}
          </div>
        </div>

        <div className="hueso mt-8 mb-3 h-[19px] w-[160px]" />

        <div className="overflow-x-auto rounded-[15px] border border-borde bg-superficie shadow-[var(--sombra)]">
          <div className="min-w-[760px] p-4 sm:p-5">
            <div className={`${REJILLA} border-b border-borde pb-3`}>
              <div className="hueso h-[10px] w-[44px]" />
              {[0, 1, 2, 3, 4].map((indice) => (
                <div key={indice} className="hueso mx-auto h-[10px] w-[76px]" />
              ))}
              <div className="hueso h-[10px] w-[44px]" />
            </div>
            {PIEZAS.map((ancho, indice) => (
              <div key={indice} className={`${REJILLA} border-b border-borde py-2 last:border-b-0`}>
                <div>
                  <div className="hueso h-3 max-w-full" style={{ width: ancho }} />
                  <div className="hueso mt-1.5 h-[10px] w-[56px]" />
                </div>
                {[0, 1, 2, 3, 4].map((celda) => (
                  <div key={celda} className="hueso h-10 rounded-[9px]" />
                ))}
                <div className="hueso h-3 w-[72px]" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <span className="sr-only">Cargando</span>
    </div>
  );
}
