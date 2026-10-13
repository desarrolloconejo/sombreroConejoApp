/** El esqueleto de la pantalla de los dos pasos, con su misma geometria. */
export default function CargandoDosPasos() {
  return (
    <main
      role="status"
      className="mx-auto flex min-h-dvh w-full max-w-[620px] flex-1 flex-col justify-center px-4 py-10"
    >
      <div className="hueso size-12 rounded-full" />
      <div className="hueso mt-5 h-3.5 w-[120px]" />
      <div className="hueso mt-2.5 h-9 w-[420px] max-w-full" />
      <div className="hueso mt-4 h-3 w-full max-w-[480px]" />
      <div className="hueso mt-2 h-3 w-full max-w-[440px]" />
      <div className="hueso mt-2 mb-6 h-3 w-full max-w-[300px]" />

      <div className="rounded-[15px] border border-borde bg-superficie p-[22px] shadow-[var(--sombra)]">
        <div className="hueso h-11 w-[186px] rounded-xl" />
      </div>

      <div className="mt-5 flex justify-end">
        <div className="hueso h-11 w-[214px] rounded-xl" />
      </div>

      <span className="sr-only">Cargando</span>
    </main>
  );
}
