/**
 * El esqueleto de la pantalla de cambio de contrasena, con su misma
 * geometria: la insignia, el titular y la tarjeta del formulario.
 */
export default function CargandoCambiarClave() {
  return (
    <main
      role="status"
      className="mx-auto flex min-h-dvh w-full max-w-[620px] flex-1 flex-col justify-center px-4 py-10"
    >
      <div className="hueso size-12 rounded-full" />
      <div className="hueso mt-5 h-3.5 w-[120px]" />
      <div className="hueso mt-2.5 h-9 w-[280px] max-w-full" />
      <div className="hueso mt-4 h-3 w-full max-w-[460px]" />
      <div className="hueso mt-2 mb-6 h-3 w-full max-w-[380px]" />

      <div className="rounded-[15px] border border-borde bg-superficie p-[22px] shadow-[var(--sombra)]">
        <div className="hueso h-3.5 w-[160px]" />

        <div className="mt-5 grid gap-[15px] sm:grid-cols-2">
          <div className="hueso h-[46px] rounded-xl sm:col-span-2" />
          <div className="hueso h-[46px] rounded-xl" />
          <div className="hueso h-[46px] rounded-xl" />
        </div>

        <div className="mt-5 flex justify-end border-t border-borde pt-[18px]">
          <div className="hueso h-11 w-[196px] rounded-xl" />
        </div>
      </div>

      <span className="sr-only">Cargando</span>
    </main>
  );
}
