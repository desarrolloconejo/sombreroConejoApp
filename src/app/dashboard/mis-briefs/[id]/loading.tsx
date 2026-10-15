/**
 * Esqueleto de un brief: la tarjeta de avance y las tres columnas del
 * formulario (pasos, preguntas y el panel de envio). Si el brief ya se envio
 * la page pinta dos columnas, pero el formulario es el caso que mas tarda.
 */

const SECCION = "rounded-[15px] border border-borde bg-superficie p-4 shadow-[var(--sombra)] sm:p-5";

export default function CargandoMiBrief() {
  return (
    <div role="status" aria-label="Cargando el brief">
      <div aria-hidden="true">
        <div className="mb-3 flex items-center gap-[7px] lg:mb-[13px]">
          <div className="hueso h-3 w-[78px]" />
          <div className="hueso size-[9px]" />
          <div className="hueso h-3 w-[70px]" />
        </div>
        <div className="mb-5 border-b border-borde pb-[18px] lg:mb-6 lg:pb-5">
          <div className="hueso h-3.5 w-[120px]" />
          <div className="hueso mt-2.5 h-[28px] w-[260px] max-w-full lg:mt-[9px] lg:h-[42px] lg:w-[420px]" />
        </div>

        <div className={`${SECCION} mb-5`}>
          <div className="hueso h-3.5 w-[220px]" />
          <div className="hueso mt-2.5 h-1.5 w-full rounded-full" />
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[220px_minmax(0,1fr)_280px]">
          <div className={`${SECCION} hidden lg:block`}>
            {[0, 1, 2, 3, 4, 5].map((fila) => (
              <div key={fila} className="flex items-center gap-2.5 py-2">
                <div className="hueso size-6 rounded-full" />
                <div className="hueso h-3 w-[110px]" />
              </div>
            ))}
          </div>
          <div className={SECCION}>
            <div className="hueso h-[22px] w-[200px]" />
            {[0, 1, 2].map((fila) => (
              <div key={fila} className="mt-5">
                <div className="hueso h-3.5 w-[60%]" />
                <div className="hueso mt-2.5 h-11 w-full rounded-xl" />
              </div>
            ))}
          </div>
          <div className={SECCION}>
            <div className="hueso h-4 w-[90px]" />
            <div className="hueso mt-3 h-11 w-full rounded-xl" />
            <div className="hueso mt-4 h-3 w-full" />
            <div className="hueso mt-2 h-3 w-[70%]" />
            <div className="hueso mt-5 h-11 w-full rounded-xl" />
          </div>
        </div>
      </div>
      <span className="sr-only">Cargando</span>
    </div>
  );
}
