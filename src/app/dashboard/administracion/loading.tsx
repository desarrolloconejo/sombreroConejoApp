/**
 * Esqueleto de Administracion del cliente: la cabecera y las tres listas, con
 * la misma rejilla que la page.
 */

const SECCION = "rounded-[15px] border border-borde bg-superficie p-4 shadow-[var(--sombra)] sm:p-5";

function Lista({ filas }: { filas: number }) {
  return (
    <div className={SECCION}>
      {Array.from({ length: filas }, (_, indice) => (
        <div key={indice} className="flex items-center gap-3 border-b border-borde py-3 last:border-0">
          <div className="min-w-0 flex-1">
            <div className="hueso h-[10px] w-[78px]" />
            <div className="hueso mt-2 h-3.5 w-[60%]" />
            <div className="hueso mt-2 h-3 w-[40%]" />
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="hueso h-3.5 w-[72px]" />
            <div className="hueso h-[22px] w-[88px] rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CargandoAdministracion() {
  return (
    <div role="status" aria-label="Cargando la administracion">
      <div aria-hidden="true">
        <div className="mb-3 flex items-center gap-[7px] lg:mb-[13px]">
          <div className="hueso h-3 w-[78px]" />
          <div className="hueso size-[9px]" />
          <div className="hueso h-3 w-[96px]" />
        </div>

        <div className="mb-5 border-b border-borde pb-[18px] lg:mb-6 lg:pb-5">
          <div className="hueso h-3.5 w-[140px]" />
          <div className="hueso mt-2.5 h-[28px] w-[200px] lg:mt-[9px] lg:h-[42px] lg:w-[300px]" />
          <div className="hueso mt-2.5 h-3.5 w-full max-w-[460px] lg:mt-[11px]" />
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div>
            <div className="hueso mb-3 h-[22px] w-[120px]" />
            <Lista filas={2} />
          </div>
          <div>
            <div className="hueso mb-3 h-[22px] w-[110px]" />
            <Lista filas={2} />
          </div>
          <div className="lg:col-span-2">
            <div className="hueso mb-3 h-[22px] w-[210px]" />
            <Lista filas={2} />
          </div>
        </div>
      </div>

      <span className="sr-only">Cargando</span>
    </div>
  );
}
