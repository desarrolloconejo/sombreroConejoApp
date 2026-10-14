import { REJILLA_PROFORMAS } from "@/components/proformas";

/**
 * Esqueleto del listado de proformas. Copia la geometria real: la misma
 * rejilla que la tabla, importada de sus columnas.
 */

const FILTROS = ["112px", "120px", "124px"];

const FILAS = [
  { empresa: 138, titulo: 176 },
  { empresa: 116, titulo: 150 },
  { empresa: 152, titulo: 188 },
  { empresa: 124, titulo: 140 },
  { empresa: 146, titulo: 166 },
];

const REJILLA = "grid items-center gap-3.5 px-5";

export default function CargandoProformas() {
  return (
    <div role="status" aria-label="Cargando las proformas">
      <div aria-hidden="true">
        <div className="mb-3 flex items-center gap-[7px] lg:mb-[13px]">
          <div className="hueso h-3 w-[78px]" />
          <div className="hueso size-[9px]" />
          <div className="hueso h-3 w-[84px]" />
        </div>

        <div className="mb-5 border-b border-borde pb-[18px] lg:mb-6 lg:pb-5">
          <div className="hueso h-3.5 w-[60px]" />
          <div className="hueso mt-2.5 h-[28px] w-[180px] lg:mt-[9px] lg:h-[42px] lg:w-[250px]" />
          <div className="hueso mt-2.5 h-3.5 w-full max-w-[560px] lg:mt-[11px]" />
        </div>

        <div className="rounded-[15px] border border-borde bg-superficie shadow-[var(--sombra)]">
          <div className="flex flex-wrap items-center gap-3 border-b border-borde px-5 py-4">
            <div className="hueso h-11 w-full min-w-0 flex-1 rounded-[10px] sm:max-w-[340px]" />
            
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-borde px-5 py-3">
            {FILTROS.map((ancho, indice) => (
              <div key={`filtro-${indice}`} style={{ width: ancho }} className="hueso h-10 rounded-[10px]" />
            ))}
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div
                style={{ gridTemplateColumns: REJILLA_PROFORMAS }}
                className={`${REJILLA} h-11 border-b border-borde bg-campo`}
              >
                <div className="hueso h-[11px] w-[56px]" />
                <div className="hueso h-[11px] w-[120px]" />
                <div className="hueso h-[11px] w-[48px]" />
                <div className="hueso h-[11px] w-[64px]" />
                <div className="hueso ml-auto h-[11px] w-[40px]" />
                <div />
              </div>

              {FILAS.map((fila, indice) => (
                <div
                  key={`fila-${indice}`}
                  style={{ gridTemplateColumns: REJILLA_PROFORMAS }}
                  className={`${REJILLA} min-h-[64px] border-b border-borde py-3 last:border-b-0`}
                >
                  <div className="hueso h-3 w-[78px]" />
                  <div className="min-w-0">
                    <div className="hueso h-3 max-w-full" style={{ width: fila.empresa }} />
                    <div className="hueso mt-[7px] h-[11px] max-w-full" style={{ width: fila.titulo }} />
                  </div>
                  <div className="hueso h-[24px] w-[92px] rounded-full" />
                  <div className="hueso h-3 w-[84px]" />
                  <div className="hueso ml-auto h-3 w-[72px]" />
                  <div className="hueso ml-auto size-9 rounded-[10px]" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-borde px-5 py-[13px]">
            <div className="hueso h-3 w-[112px]" />
            <div className="hueso h-10 w-[104px] rounded-[9px]" />
            <div className="ml-auto flex items-center gap-1.5">
              {[0, 1, 2].map((numero) => (
                <div key={numero} className="hueso size-10 rounded-[9px]" />
              ))}
            </div>
          </div>
        </div>
      </div>

      <span className="sr-only">Cargando</span>
    </div>
  );
}
