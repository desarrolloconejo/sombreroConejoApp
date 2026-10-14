/**
 * Esqueleto de Mi trabajo: dos grupos de tareas con su titulo y sus tarjetas.
 */

const GRUPOS = [
  { titulo: 150, tareas: [220, 180, 200] },
  { titulo: 116, tareas: [190, 160] },
];

export default function CargandoMiTrabajo() {
  return (
    <div role="status" aria-label="Cargando tus tareas">
      <div aria-hidden="true">
        <div className="mb-3 flex items-center gap-[7px] lg:mb-[13px]">
          <div className="hueso h-3 w-[78px]" />
          <div className="hueso size-[9px]" />
          <div className="hueso h-3 w-[70px]" />
        </div>

        <div className="mb-5 border-b border-borde pb-[18px] lg:mb-6 lg:pb-5">
          <div className="hueso h-3.5 w-[54px]" />
          <div className="hueso mt-2.5 h-[28px] w-[160px] lg:mt-[9px] lg:h-[42px] lg:w-[210px]" />
          <div className="hueso mt-2.5 h-3.5 w-full max-w-[520px] lg:mt-[11px]" />
        </div>

        <div className="flex flex-col gap-8">
          {GRUPOS.map((grupo, indice) => (
            <div key={indice}>
              <div className="hueso h-[19px]" style={{ width: grupo.titulo }} />
              <div className="hueso mt-2 mb-3 h-3 w-[260px] max-w-full" />
              <div className="flex flex-col gap-2.5">
                {grupo.tareas.map((ancho, t) => (
                  <div
                    key={t}
                    className="flex items-start gap-3 rounded-[15px] border border-borde bg-superficie px-4 py-3.5 shadow-[var(--sombra)]"
                  >
                    <div className="hueso size-8 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1">
                      <div className="hueso h-3.5 max-w-full" style={{ width: ancho }} />
                      <div className="hueso mt-2 h-3 w-[280px] max-w-full" />
                      <div className="hueso mt-1.5 h-3 w-[160px]" />
                      <div className="mt-2.5 flex gap-2">
                        <div className="hueso h-[30px] w-[104px] rounded-[10px]" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <span className="sr-only">Cargando</span>
    </div>
  );
}
