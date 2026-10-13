import { PanelMarca } from "@/components/auth";

/**
 * Esqueleto de la pantalla del codigo.
 *
 * Como el del login, reutiliza PanelMarca: el panel no espera a ningun dato,
 * asi que entre la contrasena y el codigo se queda quieto y solo se repinta
 * la columna del formulario.
 */
export default function CargandoVerificar() {
  return (
    <main className="relative flex min-h-dvh flex-1 flex-col bg-white lg:flex-row dark-tema:bg-fondo">
      <PanelMarca />

      <section
        role="status"
        aria-label="Cargando la verificacion"
        className="flex flex-1 flex-col px-[26px] pt-[30px] pb-6 lg:items-center lg:justify-center lg:p-10"
      >
        <div aria-hidden="true" className="w-full lg:w-[400px]">
          <div className="hueso h-3.5 w-[90px] lg:h-4 lg:w-[100px]" />

          <div className="hueso mt-1.5 h-[26px] w-[210px] lg:mt-2 lg:h-[42px] lg:w-[340px]" />

          <div className="mt-[7px] mb-6 lg:mt-2.5 lg:mb-[34px]">
            <div className="hueso h-3.5 w-[60%] lg:w-full" />
            <div className="hueso mt-2 hidden h-3.5 w-[62%] lg:block" />
          </div>

          <div>
            <div className="hueso h-3 w-[150px]" />
            <div className="hueso mt-[7px] h-[50px] rounded-[11px] lg:mt-2" />
            <div className="hueso mt-2 h-3 w-[70%]" />
          </div>

          <div className="hueso mt-[22px] h-[52px] rounded-xl lg:mt-[26px]" />

          <div className="mt-6 border-t border-borde pt-[18px] lg:mt-[30px] lg:pt-[22px]">
            <div className="hueso mx-auto h-3 w-[80%] lg:mx-0 lg:w-full" />
            <div className="hueso mt-2 hidden h-3 w-[45%] lg:block" />
          </div>
        </div>

        <span className="sr-only">Cargando</span>
      </section>
    </main>
  );
}
