/**
 * Esqueleto de la ficha de un brief recibido: el brief completo a la
 * izquierda y, a la derecha, las tarjetas de estado, fecha y decision. Todas
 * con su cabecera dentro, como la page, para que las dos columnas arranquen
 * a la misma altura.
 */

const SECCION = "rounded-[15px] border border-borde bg-superficie p-4 shadow-[var(--sombra)] sm:p-5";

function Cabecera({ ancho }: { ancho: string }) {
  return <div className={`hueso mb-4 h-4 ${ancho}`} />;
}

export default function CargandoBrief() {
  return (
    <div role="status" aria-label="Cargando el brief">
      <div aria-hidden="true">
        <div className="mb-3 flex items-center gap-[7px] lg:mb-[13px]">
          <div className="hueso h-3 w-[78px]" />
          <div className="hueso size-[9px]" />
          <div className="hueso h-3 w-[50px]" />
          <div className="hueso size-[9px]" />
          <div className="hueso h-3 w-[130px]" />
        </div>
        <div className="mb-5 border-b border-borde pb-[18px] lg:mb-6 lg:pb-5">
          <div className="hueso h-3.5 w-[150px]" />
          <div className="hueso mt-2.5 h-[28px] w-[240px] max-w-full lg:mt-[9px] lg:h-[42px] lg:w-[420px]" />
          <div className="hueso mt-2.5 h-3.5 w-[260px] max-w-full lg:mt-[11px]" />
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className={SECCION}>
            <Cabecera ancho="w-[130px]" />
            {[0, 1, 2, 3, 4].map((fila) => (
              <div key={fila} className="border-b border-borde py-3 last:border-0">
                <div className="hueso h-3 w-[140px]" />
                <div className="hueso mt-2 h-3.5 w-[60%]" />
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-4">
            <div className={SECCION}>
              <Cabecera ancho="w-[70px]" />
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {[0, 1, 2, 3].map((dato) => (
                  <div key={dato}>
                    <div className="hueso h-2.5 w-[60px]" />
                    <div className="hueso mt-1.5 h-3.5 w-[110px]" />
                  </div>
                ))}
              </div>
            </div>
            <div className={SECCION}>
              <Cabecera ancho="w-[120px]" />
              <div className="hueso h-10 w-full rounded-xl" />
              <div className="hueso mt-2 h-10 w-full rounded-xl" />
            </div>
            <div className={SECCION}>
              <Cabecera ancho="w-[80px]" />
              <div className="hueso h-11 w-full rounded-xl" />
              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                <div className="hueso h-11 rounded-xl" />
                <div className="hueso h-11 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <span className="sr-only">Cargando</span>
    </div>
  );
}
