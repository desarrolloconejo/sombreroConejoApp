/**
 * Esqueleto de Nombres de archivo: la tarjeta de datos a la izquierda y, a la
 * derecha, el nombre armado y las reglas.
 */

const CAMPOS = [96, 120, 104, 70, 80];

export default function CargandoNombresArchivo() {
  return (
    <div role="status" aria-label="Cargando el armador de nombres">
      <div aria-hidden="true">
        <div className="mb-3 flex items-center gap-[7px] lg:mb-[13px]">
          <div className="hueso h-3 w-[78px]" />
          <div className="hueso size-[9px]" />
          <div className="hueso h-3 w-[120px]" />
        </div>

        <div className="mb-5 border-b border-borde pb-[18px] lg:mb-6 lg:pb-5">
          <div className="hueso h-3.5 w-[96px]" />
          <div className="hueso mt-2.5 h-[28px] w-[220px] lg:mt-[9px] lg:h-[42px] lg:w-[320px]" />
          <div className="hueso mt-2.5 h-3.5 w-full max-w-[620px] lg:mt-[11px]" />
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="rounded-[15px] border border-borde bg-superficie p-5 shadow-[var(--sombra)]">
            <div className="hueso mb-4 h-[18px] w-[90px]" />
            <div className="flex flex-col gap-5">
              {CAMPOS.map((ancho, indice) => (
                <div key={indice}>
                  <div className="hueso h-3 rounded" style={{ width: ancho }} />
                  <div className="hueso mt-1.5 h-11 w-full rounded-xl" />
                </div>
              ))}
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: 12 }, (_, indice) => (
                  <div key={indice} className="hueso h-[30px] w-[48px] rounded-lg" />
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-[15px] border border-borde bg-superficie p-5 shadow-[var(--sombra)]">
              <div className="hueso mb-4 h-[18px] w-[100px]" />
              <div className="hueso h-[76px] w-full rounded-xl" />
              <div className="hueso mt-3 h-3 w-[70%]" />
              <div className="hueso mt-4 h-11 w-full rounded-xl" />
            </div>
            <div className="rounded-[15px] border border-borde bg-superficie p-5 shadow-[var(--sombra)]">
              <div className="hueso mb-4 h-[18px] w-[80px]" />
              <div className="flex flex-col gap-2.5">
                {[90, 75, 80, 70, 95, 65].map((ancho, indice) => (
                  <div key={indice} className="hueso h-3" style={{ width: `${ancho}%` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <span className="sr-only">Cargando</span>
    </div>
  );
}
