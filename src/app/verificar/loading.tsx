/** El esqueleto de la pantalla del codigo, con su misma geometria. */
export default function CargandoVerificar() {
  return (
    <main
      role="status"
      className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-1 flex-col justify-center px-5 py-10"
    >
      <div className="hueso size-12 rounded-full" />
      <div className="hueso mt-5 h-3.5 w-[88px]" />
      <div className="hueso mt-2.5 h-9 w-[240px] max-w-full" />
      <div className="hueso mt-4 h-3 w-full" />
      <div className="hueso mt-2 mb-7 h-3 w-[70%]" />

      <div className="hueso h-3 w-[150px]" />
      <div className="hueso mt-2 h-[46px] rounded-xl" />
      <div className="mt-6 flex justify-end">
        <div className="hueso h-11 w-[112px] rounded-xl" />
      </div>

      <span className="sr-only">Cargando</span>
    </main>
  );
}
