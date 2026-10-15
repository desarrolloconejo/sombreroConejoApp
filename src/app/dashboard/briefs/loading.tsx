/**
 * Esqueleto de la bandeja de briefs: la cabecera, «Por decidir» a la izquierda
 * y «En curso» a la derecha, con la misma rejilla que la page.
 */

const SECCION = "rounded-[15px] border border-borde bg-superficie p-4 shadow-[var(--sombra)] sm:p-5";

export default function CargandoBriefs() {
  return (
    <div role="status" aria-label="Cargando la bandeja de briefs">
      <div aria-hidden="true">
        <div className="mb-3 flex items-center gap-[7px] lg:mb-[13px]">
          <div className="hueso h-3 w-[78px]" />
          <div className="hueso size-[9px]" />
          <div className="hueso h-3 w-[70px]" />
        </div>
        <div className="mb-5 border-b border-borde pb-[18px] lg:mb-6 lg:pb-5">
          <div className="hueso h-3.5 w-[140px]" />
          <div className="hueso mt-2.5 h-[28px] w-[180px] lg:mt-[9px] lg:h-[42px] lg:w-[240px]" />
          <div className="hueso mt-2.5 h-3.5 w-full max-w-[520px] lg:mt-[11px]" />
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
          <div>
            <div className="hueso mb-3 h-[22px] w-[110px]" />
            <div className={SECCION}>
              {[0, 1, 2].map((fila) => (
                <div key={fila} className="flex items-center gap-3 border-b border-borde py-3 last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="hueso h-[10px] w-[150px]" />
                    <div className="hueso mt-2 h-3.5 w-[60%]" />
                    <div className="hueso mt-2 h-3 w-[40%]" />
                  </div>
                  <div className="hueso h-[22px] w-[88px] rounded-full" />
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="hueso mb-3 h-[22px] w-[150px]" />
            <div className={SECCION}>
              <div className="hueso h-4 w-[70%]" />
              <div className="hueso mt-2 h-3 w-[50%]" />
              <div className="hueso mt-4 h-11 w-[120px] rounded-xl" />
            </div>
          </div>
        </div>
      </div>
      <span className="sr-only">Cargando</span>
    </div>
  );
}
