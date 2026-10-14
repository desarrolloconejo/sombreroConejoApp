/**
 * Esqueleto de la ficha de un documento de finanzas: migas, cabecera, la
 * linea de estado, los renglones con sus importes y la columna lateral.
 *
 * Lo comparten presupuestos y proformas, del operador y del cliente: las
 * cuatro fichas tienen la misma geometria.
 */

const SECCION = "rounded-[15px] border border-borde bg-superficie p-4 shadow-[var(--sombra)] sm:p-5";

export function EsqueletoDocumento({ etiqueta }: { etiqueta: string }) {
  return (
    <div role="status" aria-label={etiqueta}>
      <div aria-hidden="true">
        <div className="mb-3 flex items-center gap-[7px] lg:mb-[13px]">
          <div className="hueso h-3 w-[78px]" />
          <div className="hueso size-[9px]" />
          <div className="hueso h-3 w-[84px]" />
          <div className="hueso size-[9px]" />
          <div className="hueso h-3 w-[78px]" />
        </div>

        <div className="mb-5 border-b border-borde pb-[18px] lg:mb-6 lg:pb-5">
          <div className="hueso h-3.5 w-[180px]" />
          <div className="hueso mt-2.5 h-[28px] w-[240px] max-w-full lg:mt-[9px] lg:h-[42px] lg:w-[380px]" />
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="hueso h-[24px] w-[96px] rounded-full" />
          <div className="hueso h-3 w-[150px]" />
          <div className="hueso h-3 w-[130px]" />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div>
            <div className="hueso mb-3 h-[22px] w-[120px]" />
            <div className={SECCION}>
              {[0, 1, 2].map((fila) => (
                <div key={fila} className="flex items-center justify-between gap-4 border-b border-borde py-3 last:border-0">
                  <div className="hueso h-3 w-[46%]" />
                  <div className="hueso h-3 w-[64px]" />
                </div>
              ))}
              <div className="ml-auto mt-4 flex w-full max-w-[320px] flex-col gap-2.5 border-t border-borde pt-4">
                <div className="hueso h-3 w-full" />
                <div className="hueso h-3 w-full" />
                <div className="hueso h-3 w-full" />
                <div className="hueso mt-1 h-[18px] w-full" />
              </div>
            </div>
          </div>

          <div>
            <div className="hueso mb-3 h-[22px] w-[160px]" />
            <div className={SECCION}>
              <div className="hueso h-3 w-full" />
              <div className="hueso mt-3 h-3 w-[70%]" />
              <div className="hueso mt-5 h-9 w-[180px] rounded-xl" />
            </div>
          </div>
        </div>
      </div>

      <span className="sr-only">Cargando</span>
    </div>
  );
}
