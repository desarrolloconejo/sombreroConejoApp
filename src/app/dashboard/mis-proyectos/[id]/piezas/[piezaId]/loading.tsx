/** Esqueleto de la revision: el visor a la izquierda y la decision a la derecha. */
export default function CargandoRevision() {
  return (
    <div role="status" aria-label="Cargando la revision">
      <div aria-hidden="true">
        <div className="mb-3 flex items-center gap-[7px] lg:mb-[13px]">
          <div className="hueso h-3 w-[78px]" />
          <div className="hueso size-[9px]" />
          <div className="hueso h-3 w-[86px]" />
          <div className="hueso size-[9px]" />
          <div className="hueso h-3 w-[110px]" />
        </div>
        <div className="mb-5 border-b border-borde pb-[18px] lg:mb-6 lg:pb-5">
          <div className="hueso h-3.5 w-[120px]" />
          <div className="hueso mt-2.5 h-[28px] w-[240px] lg:mt-[9px] lg:h-[42px] lg:w-[320px]" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="hueso h-[420px] rounded-[15px]" />
          <div className="flex flex-col gap-6">
            <div className="hueso h-[72px] rounded-[15px]" />
            <div className="hueso h-[150px] rounded-[15px]" />
            <div className="hueso h-[200px] rounded-[15px]" />
          </div>
        </div>
      </div>
      <span className="sr-only">Cargando</span>
    </div>
  );
}
