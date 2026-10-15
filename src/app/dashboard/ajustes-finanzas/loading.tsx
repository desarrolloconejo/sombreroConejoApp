/**
 * Esqueleto de Ajustes de finanzas: dos columnas de tarjetas (emisor a la
 * izquierda; numeracion y formatos a la derecha) y los medios de pago debajo.
 */

function Tarjeta({ campos, alto = "h-[46px]" }: { campos: number; alto?: string }) {
  return (
    <div>
      <div className="hueso h-5 w-[180px]" />
      <div className="hueso mt-2 mb-3 h-3 w-full max-w-[360px]" />
      <div className="flex flex-col gap-3 rounded-[15px] border border-borde bg-superficie p-4 shadow-[var(--sombra)] sm:p-5">
        {Array.from({ length: campos }, (_, i) => (
          <div key={i} className={`hueso ${alto} rounded-xl`} />
        ))}
      </div>
    </div>
  );
}

export default function CargandoAjustesFinanzas() {
  return (
    <div role="status" aria-label="Cargando los ajustes de finanzas">
      <div aria-hidden="true">
        <div className="mb-3 flex items-center gap-[7px] lg:mb-[13px]">
          <div className="hueso h-3 w-[78px]" />
          <div className="hueso size-[9px]" />
          <div className="hueso h-3 w-[130px]" />
        </div>
        <div className="mb-5 border-b border-borde pb-[18px] lg:mb-6 lg:pb-5">
          <div className="hueso h-3.5 w-[60px]" />
          <div className="hueso mt-2.5 h-[28px] w-[240px] lg:h-[42px] lg:w-[340px]" />
          <div className="hueso mt-2.5 h-3.5 w-full max-w-[560px]" />
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-2">
          <Tarjeta campos={7} />
          <div className="flex flex-col gap-8">
            <Tarjeta campos={3} />
            <Tarjeta campos={2} alto="h-[52px]" />
          </div>
        </div>
        <div className="mt-8">
          <Tarjeta campos={4} alto="h-[52px]" />
        </div>
      </div>
    </div>
  );
}
