/**
 * Esqueleto del tablero: las cuatro tarjetas de alertas, los filtros y la
 * tabla de proyectos en curso.
 */

const FILAS = [
  { empresa: 140, proyecto: 120, fase: 168 },
  { empresa: 118, proyecto: 150, fase: 142 },
  { empresa: 152, proyecto: 104, fase: 176 },
  { empresa: 126, proyecto: 138, fase: 150 },
];

export default function CargandoTablero() {
  return (
    <div role="status" aria-label="Cargando el tablero">
      <div aria-hidden="true">
        <div className="mb-3 flex items-center gap-[7px] lg:mb-[13px]">
          <div className="hueso h-3 w-[78px]" />
          <div className="hueso size-[9px]" />
          <div className="hueso h-3 w-[54px]" />
        </div>

        <div className="mb-5 border-b border-borde pb-[18px] lg:mb-6 lg:pb-5">
          <div className="hueso h-3.5 w-[54px]" />
          <div className="hueso mt-2.5 h-[28px] w-[220px] lg:mt-[9px] lg:h-[42px] lg:w-[300px]" />
          <div className="hueso mt-2.5 h-3.5 w-full max-w-[460px] lg:mt-[11px]" />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((indice) => (
            <div key={indice} className="rounded-[15px] border border-borde bg-superficie px-4 py-3.5 shadow-[var(--sombra)]">
              <div className="hueso h-3.5 w-[110px]" />
              <div className="hueso mt-2.5 h-[30px] w-[36px]" />
              <div className="hueso mt-2 h-[10px] w-[44px]" />
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-end gap-2.5">
          {[0, 1, 2].map((indice) => (
            <div key={indice}>
              <div className="hueso mb-1.5 h-[10px] w-[56px]" />
              <div className="hueso h-10 w-[180px] rounded-xl" />
            </div>
          ))}
          <div className="hueso h-10 w-[96px] rounded-[12px]" />
        </div>

        <div className="hueso mt-6 mb-3 h-[19px] w-[190px]" />

        <div className="rounded-[15px] border border-borde bg-superficie shadow-[var(--sombra)]">
          <div className="hidden h-11 border-b border-borde bg-campo lg:block" />
          {FILAS.map((fila, indice) => (
            <div
              key={indice}
              className="flex flex-col gap-3 border-b border-borde px-5 py-4 last:border-b-0 lg:grid lg:grid-cols-[minmax(0,1.7fr)_minmax(0,0.9fr)_176px_minmax(0,1.6fr)_80px_minmax(0,1fr)_40px] lg:items-center lg:gap-4"
            >
              <div>
                <div className="hueso h-3 max-w-full" style={{ width: fila.empresa }} />
                <div className="hueso mt-[7px] h-[11px] max-w-full" style={{ width: fila.proyecto }} />
              </div>
              <div className="hueso h-3 w-[88px]" />
              <div className="flex items-center gap-2.5">
                <div className="hueso h-3.5 w-[96px] rounded-[5px]" />
                <div className="hueso h-3 w-[30px]" />
              </div>
              <div>
                <div className="hueso h-3 max-w-full" style={{ width: fila.fase }} />
                <div className="hueso mt-[7px] h-[11px] w-[110px]" />
              </div>
              <div className="hueso h-3 w-[48px]" />
              <div className="hueso h-[24px] w-[104px] rounded-full" />
              <div />
            </div>
          ))}
        </div>
      </div>

      <span className="sr-only">Cargando</span>
    </div>
  );
}
