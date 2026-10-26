/**
 * Esqueleto de Mis proyectos: el aviso de revision y el listado de sus
 * proyectos en tarjetas, con su barra.
 */
export default function CargandoMisProyectos() {
  return (
    <div role="status" aria-label="Cargando tus proyectos">
      <div aria-hidden="true">
        <div className="mb-3 flex items-center gap-[7px] lg:mb-[13px]">
          <div className="hueso h-3 w-[78px]" />
          <div className="hueso size-[9px]" />
          <div className="hueso h-3 w-[86px]" />
        </div>
        <div className="mb-5 border-b border-borde pb-[18px] lg:mb-6 lg:pb-5">
          <div className="hueso h-3.5 w-[140px]" />
          <div className="hueso mt-2.5 h-[28px] w-[180px] lg:mt-[9px] lg:h-[42px] lg:w-[240px]" />
          <div className="hueso mt-2.5 h-3.5 w-full max-w-[480px] lg:mt-[11px]" />
        </div>
        <div className="hueso h-[74px] rounded-[15px]" />
        <div className="mt-8 rounded-[15px] border border-borde bg-superficie shadow-[var(--sombra)]">
          <div className="flex flex-wrap items-center gap-3 border-b border-borde px-5 py-4">
            <div className="hueso h-11 w-full min-w-0 flex-1 rounded-[10px] sm:max-w-[340px]" />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b border-borde px-5 py-3">
            <div className="hueso h-10 w-[120px] rounded-[10px]" />
          </div>
          <div className="flex items-center gap-1.5 border-b border-borde px-5 py-3">
            <div className="hueso mr-1 h-3 w-[52px]" />
            <div className="hueso h-9 w-[110px] rounded-[10px]" />
            <div className="hueso h-9 w-[72px] rounded-[10px]" />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 p-4 sm:grid-cols-2 sm:p-5 2xl:grid-cols-3">
            {[0, 1, 2].map((indice) => (
              <div key={indice} className="rounded-[15px] border border-borde bg-superficie p-5 shadow-[var(--sombra)]">
                <div className="hueso h-4 w-[70%]" />
                <div className="hueso mt-2 h-3 w-[50%]" />
                <div className="mt-4 flex items-center gap-3">
                  <div className="hueso h-5 w-[136px] rounded-[5px]" />
                  <div className="hueso h-4 w-[40px]" />
                </div>
                <div className="hueso mt-4 h-3 w-[60%]" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">Cargando</span>
    </div>
  );
}
