/**
 * Esqueleto de Cobranza: tres cifras arriba y la tabla por empresa debajo.
 */
export default function CargandoCobranza() {
  return (
    <div role="status" aria-label="Cargando la cobranza">
      <div aria-hidden="true">
        <div className="mb-3 flex items-center gap-[7px] lg:mb-[13px]">
          <div className="hueso h-3 w-[78px]" />
          <div className="hueso size-[9px]" />
          <div className="hueso h-3 w-[70px]" />
        </div>
        <div className="mb-5 border-b border-borde pb-[18px] lg:mb-6 lg:pb-5">
          <div className="hueso h-3.5 w-[60px]" />
          <div className="hueso mt-2.5 h-[28px] w-[160px] lg:h-[42px] lg:w-[220px]" />
          <div className="hueso mt-2.5 h-3.5 w-full max-w-[560px]" />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-[15px] border border-borde bg-superficie p-4 shadow-[var(--sombra)] sm:p-5">
              <div className="hueso h-3 w-[80px]" />
              <div className="hueso mt-2 h-6 w-[130px]" />
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-[15px] border border-borde bg-superficie p-4 shadow-[var(--sombra)] sm:p-5">
          <div className="hueso mb-4 h-4 w-[100px]" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between gap-4 border-b border-borde py-3 last:border-0">
              <div className="hueso h-3.5 w-[180px]" />
              <div className="hueso h-3.5 w-[110px]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
