/** Esqueleto de un proyecto del cliente: su bateria y la lista de piezas. */
export default function CargandoMiProyecto() {
  return (
    <div role="status" aria-label="Cargando el proyecto">
      <div aria-hidden="true">
        <div className="mb-3 flex items-center gap-[7px] lg:mb-[13px]">
          <div className="hueso h-3 w-[78px]" />
          <div className="hueso size-[9px]" />
          <div className="hueso h-3 w-[86px]" />
          <div className="hueso size-[9px]" />
          <div className="hueso h-3 w-[110px]" />
        </div>
        <div className="mb-5 border-b border-borde pb-[18px] lg:mb-6 lg:pb-5">
          <div className="hueso h-3.5 w-[140px]" />
          <div className="hueso mt-2.5 h-[28px] w-[220px] lg:mt-[9px] lg:h-[42px] lg:w-[300px]" />
        </div>
        <div className="mb-8 flex items-center gap-5 rounded-[15px] border border-borde bg-superficie p-5 shadow-[var(--sombra)] sm:p-6">
          <div className="hueso h-7 w-[190px] rounded-[6px]" />
          <div>
            <div className="hueso h-[30px] w-[70px]" />
            <div className="hueso mt-2 h-3 w-[200px]" />
          </div>
        </div>
        <div className="hueso mb-3 h-[19px] w-[70px]" />
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2, 3, 4].map((indice) => (
            <div key={indice} className="flex items-center gap-3.5 rounded-[15px] border border-borde bg-superficie px-4 py-3.5 shadow-[var(--sombra)]">
              <div className="min-w-0 flex-1">
                <div className="hueso h-3.5 w-[55%]" />
                <div className="hueso mt-2 h-3 w-[40%]" />
              </div>
              <div className="hueso hidden h-3.5 w-[96px] rounded-[5px] sm:block" />
              <div className="hueso h-9 w-[74px] rounded-[10px]" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Cargando</span>
    </div>
  );
}
