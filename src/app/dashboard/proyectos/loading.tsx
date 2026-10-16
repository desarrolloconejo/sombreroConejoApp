/**
 * Esqueleto del listado de proyectos. Copia la geometria real: el control de
 * orden y la rejilla de tarjetas, con la bateria a lo ancho arriba.
 */

const FILTROS = ["112px", "104px", "124px"];

const TARJETAS = [
  { empresa: 170, proyecto: 210 },
  { empresa: 150, proyecto: 180 },
  { empresa: 190, proyecto: 200 },
  { empresa: 140, proyecto: 170 },
  { empresa: 180, proyecto: 220 },
  { empresa: 160, proyecto: 190 },
];

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

          <div className="flex items-center gap-1.5 border-b border-borde px-5 py-3">
            <div className="hueso mr-1 h-3 w-[52px]" />
            <div className="hueso h-9 w-[84px] rounded-[10px]" />
            <div className="hueso h-9 w-[72px] rounded-[10px]" />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
            {TARJETAS.map((tarjeta, indice) => (
              <div key={`tarjeta-${indice}`} className="rounded-[15px] border border-borde p-5">
                <div className="flex items-center gap-3">
                  <div className="hueso h-8 min-w-0 flex-1 rounded-[5px]" />
                  <div className="hueso h-[22px] w-[48px]" />
                </div>
                <div className="hueso mt-2 h-3 w-[140px]" />
                <div className="hueso mt-4 h-4 max-w-full" style={{ width: tarjeta.empresa }} />
                <div className="hueso mt-2 h-3 max-w-full" style={{ width: tarjeta.proyecto }} />
                <div className="mt-4 flex gap-4 border-t border-borde pt-3.5">
                  <div className="hueso h-3 w-[90px]" />
                  <div className="hueso h-3 w-[86px]" />
                </div>
                <div className="hueso mt-3 h-3 w-[48px]" />
              </div>
            ))}
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
