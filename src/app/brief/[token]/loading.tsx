/**
 * El esqueleto del brief por enlace, con su geometria: la marca, el
 * encabezado y el formulario por pasos.
 */
export default function CargandoBriefPorEnlace() {
  return (
    <main role="status" className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8 flex items-center gap-[11px]">
        <div className="hueso size-8 rounded-full" />
        <div className="hueso h-4 w-[180px]" />
      </div>
      <div className="hueso h-3.5 w-[140px]" />
      <div className="hueso mt-2.5 h-9 w-[340px] max-w-full" />
      <div className="hueso mt-4 mb-7 h-3 w-full max-w-[520px]" />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="hidden flex-col gap-2 lg:flex">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="hueso h-10 rounded-xl" />
          ))}
        </div>
        <div className="rounded-[15px] border border-borde bg-superficie p-[22px] shadow-[var(--sombra)]">
          <div className="hueso h-5 w-[200px]" />
          <div className="mt-5 flex flex-col gap-[15px]">
            <div className="hueso h-[46px] rounded-xl" />
            <div className="hueso h-[46px] rounded-xl" />
            <div className="hueso h-[96px] rounded-xl" />
          </div>
        </div>
      </div>

      <span className="sr-only">Cargando</span>
    </main>
  );
}
