import { REJILLA_PROYECTOS } from "@/components/proyectos";

/**
 * Esqueleto del listado de proyectos. Copia la geometria real: la misma
 * rejilla que la tabla, importada de sus columnas, y la bateria en su sitio.
 */

const FILTROS = ["112px", "104px", "124px"];

const FILAS = [
  { empresa: 138, proyecto: 176, ejecutivo: 84, alertas: [104, 88] },
  { empresa: 116, proyecto: 150, ejecutivo: 96, alertas: [96] },
  { empresa: 152, proyecto: 188, ejecutivo: 78, alertas: [] },
  { empresa: 124, proyecto: 140, ejecutivo: 90, alertas: [112] },
  { empresa: 146, proyecto: 166, ejecutivo: 86, alertas: [88, 104] },
];

const REJILLA = "grid items-center gap-3.5 px-5";

export default function CargandoProyectos() {
  return (
    <div role="status" aria-label="Cargando los proyectos">
      <div aria-hidden="true">
        <div className="mb-3 flex items-center gap-[7px] lg:mb-[13px]">
          <div className="hueso h-3 w-[78px]" />
          <div className="hueso size-[9px]" />
          <div className="hueso h-3 w-[62px]" />
        </div>

        <div className="mb-5 border-b border-borde pb-[18px] lg:mb-6 lg:pb-5">
          <div className="hueso h-3.5 w-[54px]" />
          <div className="hueso mt-2.5 h-[28px] w-[150px] lg:mt-[9px] lg:h-[42px] lg:w-[196px]" />
          <div className="hueso mt-2.5 h-3.5 w-full max-w-[560px] lg:mt-[11px]" />
        </div>

        <div className="rounded-[15px] border border-borde bg-superficie shadow-[var(--sombra)]">
          <div className="flex flex-wrap items-center gap-3 border-b border-borde px-5 py-4">
            <div className="hueso h-11 w-full min-w-0 flex-1 rounded-[10px] sm:max-w-[340px]" />
            <div className="hueso ml-auto h-11 w-[160px] rounded-[12px]" />
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-borde px-5 py-3">
            {FILTROS.map((ancho, indice) => (
              <div key={`filtro-${indice}`} style={{ width: ancho }} className="hueso h-10 rounded-[10px]" />
            ))}
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[860px]">
              <div
                style={{ gridTemplateColumns: REJILLA_PROYECTOS }}
                className={`${REJILLA} h-11 border-b border-borde bg-campo`}
              >
                <div className="hueso h-[11px] w-[110px]" />
                <div className="hueso h-[11px] w-[64px]" />
                <div className="hueso h-[11px] w-[52px]" />
                <div className="hueso h-[11px] w-[44px]" />
                <div className="hueso h-[11px] w-[52px]" />
                <div />
              </div>

              {FILAS.map((fila, indice) => (
                <div
                  key={`fila-${indice}`}
                  style={{ gridTemplateColumns: REJILLA_PROYECTOS }}
                  className={`${REJILLA} min-h-[64px] border-b border-borde py-3 last:border-b-0`}
                >
                  <div className="min-w-0">
                    <div className="hueso h-3 max-w-full" style={{ width: fila.empresa }} />
                    <div className="hueso mt-[7px] h-[11px] max-w-full" style={{ width: fila.proyecto }} />
                  </div>
                  <div className="hueso h-3 max-w-full" style={{ width: fila.ejecutivo }} />
                  <div className="flex items-center gap-2.5">
                    <div className="hueso h-3.5 w-[96px] rounded-[5px]" />
                    <div className="hueso h-3 w-[30px]" />
                  </div>
                  <div className="hueso h-3 w-[48px]" />
                  <div className="flex gap-1.5">
                    {fila.alertas.length === 0 ? (
                      <div className="hueso h-3 w-[40px]" />
                    ) : (
                      fila.alertas.map((ancho, a) => (
                        <div key={a} className="hueso h-[24px] rounded-full" style={{ width: ancho }} />
                      ))
                    )}
                  </div>
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
