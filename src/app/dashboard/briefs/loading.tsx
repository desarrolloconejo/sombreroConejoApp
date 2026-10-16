/**
 * Esqueleto de la bandeja de briefs: la cabecera, las tres pestanas y la
 * lista, con la misma geometria que la page.
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

        <div className="mb-4 grid grid-cols-3 gap-1 rounded-[14px] border border-borde bg-campo p-1 sm:inline-grid sm:w-[360px]">
          {[0, 1, 2].map((pestana) => (
            <div key={pestana} className="hueso h-10 rounded-[10px]" />
          ))}
        </div>

        <div className={SECCION}>
          <div className="hueso mb-2 h-3 w-[200px]" />
          {[0, 1, 2, 3].map((fila) => (
            <div key={fila} className="flex items-center gap-3 border-b border-borde py-3.5 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="hueso h-4 w-[45%]" />
                <div className="hueso mt-2 h-3.5 w-[60%]" />
                <div className="hueso mt-2 h-3 w-[50%]" />
              </div>
              <div className="hueso hidden h-3 w-[70px] sm:block" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Cargando</span>
    </div>
  );
}
