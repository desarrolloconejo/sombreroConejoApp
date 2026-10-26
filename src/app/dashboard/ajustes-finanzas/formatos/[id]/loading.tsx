/**
 * Esqueleto del editor de un formato: la tabla de datos a la izquierda y la
 * hoja a escala a la derecha.
 */
export default function CargandoFormato() {
  return (
    <div role="status" aria-label="Cargando el formato">
      <div aria-hidden="true">
        <div className="mb-3 flex items-center gap-[7px] lg:mb-[13px]">
          <div className="hueso h-3 w-[78px]" />
          <div className="hueso size-[9px]" />
          <div className="hueso h-3 w-[130px]" />
          <div className="hueso size-[9px]" />
          <div className="hueso h-3 w-[100px]" />
        </div>
        <div className="mb-5 border-b border-borde pb-[18px] lg:mb-6 lg:pb-5">
          <div className="hueso h-3.5 w-[120px]" />
          <div className="hueso mt-2.5 h-[28px] w-[220px] lg:h-[42px] lg:w-[300px]" />
          <div className="hueso mt-2.5 h-3.5 w-full max-w-[460px]" />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 rounded-[15px] border border-borde bg-superficie p-4 shadow-[var(--sombra)] sm:p-5 2xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-2">
            <div className="hueso h-[46px] rounded-xl" />
            {Array.from({ length: 13 }, (_, i) => (
              <div key={i} className="hueso h-9 rounded-lg" />
            ))}
          </div>
          <div className="hueso aspect-[216/279] w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
