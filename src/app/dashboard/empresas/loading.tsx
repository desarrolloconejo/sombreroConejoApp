import { REJILLA_EMPRESAS } from "@/components/empresas";

/**
 * Esqueleto del listado de empresas.
 *
 * Copia la geometria real en lugar de aproximarla: mismos altos, mismos
 * rellenos y, sobre todo, la MISMA rejilla que la tabla, importada de las
 * columnas del modulo. Asi las celdas caen donde van a caer y la pagina no da
 * un salto cuando llegan los datos.
 */

/**
 * Ancho de cada filtro desplegable. Son dos —sector y estado— y no miden lo
 * mismo porque el boton muestra el nombre del grupo y lo elegido.
 */
const FILTROS = ["136px", "232px"];

/** Anchos de las celdas de cada fila, para que no salgan todas iguales. */
const FILAS = [
  { nombre: 148, rif: 96, sector: 88, telefono: 118, contactos: 92 },
  { nombre: 122, rif: 104, sector: 112, telefono: 108, contactos: 78 },
  { nombre: 176, rif: 88, sector: 74, telefono: 126, contactos: 96 },
  { nombre: 134, rif: 100, sector: 128, telefono: 96, contactos: 84 },
  { nombre: 158, rif: 92, sector: 96, telefono: 122, contactos: 92 },
  { nombre: 116, rif: 108, sector: 84, telefono: 112, contactos: 78 },
];

const REJILLA = "grid items-center gap-3.5 px-5";

export default function CargandoEmpresas() {
  return (
    <div role="status" aria-label="Cargando las empresas">
      <div aria-hidden="true">
        {/* Migas */}
        <div className="mb-3 flex items-center gap-[7px] lg:mb-[13px]">
          <div className="hueso h-3 w-[78px]" />
          <div className="hueso size-[9px]" />
          <div className="hueso h-3 w-[68px]" />
        </div>

        {/* Cabecera del Wrapper */}
        <div className="mb-5 border-b border-borde pb-[18px] lg:mb-6 lg:pb-5">
          <div className="hueso h-3.5 w-[84px]" />
          <div className="hueso mt-2.5 h-[28px] w-[178px] lg:mt-[9px] lg:h-[42px] lg:w-[238px]" />
          <div className="hueso mt-2.5 h-3.5 w-full max-w-[470px] lg:mt-[11px]" />
        </div>

        <div className="rounded-[15px] border border-borde bg-superficie shadow-[var(--sombra)]">
          {/* Buscador y accion principal */}
          <div className="flex flex-wrap items-center gap-3 border-b border-borde px-5 py-4">
            <div className="hueso h-11 w-full min-w-0 flex-1 rounded-[10px] sm:max-w-[340px]" />
            <div className="hueso ml-auto h-10 w-[158px] rounded-xl" />
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-borde px-5 py-3">
            {FILTROS.map((ancho, indice) => (
              <div
                key={`filtro-${indice}`}
                style={{ width: ancho }}
                className="hueso h-10 rounded-[10px]"
              />
            ))}
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div
                style={{ gridTemplateColumns: REJILLA_EMPRESAS }}
                className={`${REJILLA} h-11 border-b border-borde bg-campo`}
              >
                <div className="hueso h-[11px] w-[64px]" />
                <div className="hueso h-[11px] w-[48px]" />
                <div className="hueso h-[11px] w-[60px]" />
                <div className="hueso h-[11px] ml-auto w-[42px]" />
                <div className="hueso h-[11px] w-[48px]" />
                <div />
              </div>

              {FILAS.map((fila, indice) => (
                <div
                  key={`fila-${indice}`}
                  style={{ gridTemplateColumns: REJILLA_EMPRESAS }}
                  className={`${REJILLA} min-h-[62px] border-b border-borde py-3 last:border-b-0`}
                >
                  {/* Empresa: el cuadro de iniciales, el nombre y el RIF */}
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="hueso size-9 shrink-0 rounded-[11px]" />
                    <div className="min-w-0">
                      <div className="hueso h-3 max-w-full" style={{ width: fila.nombre }} />
                      <div
                        className="hueso mt-[7px] h-[11px] max-w-full"
                        style={{ width: fila.rif }}
                      />
                    </div>
                  </div>

                  <div className="hueso h-3 max-w-full" style={{ width: fila.sector }} />

                  <div className="min-w-0">
                    <div className="hueso h-3 max-w-full" style={{ width: fila.telefono }} />
                    <div
                      className="hueso mt-[7px] h-[11px] max-w-full"
                      style={{ width: fila.contactos }}
                    />
                  </div>

                  <div className="ml-auto">
                    <div className="hueso h-3.5 w-[26px]" />
                    <div className="hueso mt-[7px] h-[11px] w-[34px]" />
                  </div>

                  <div className="hueso h-[22px] w-[74px] rounded-full" />
                  <div className="hueso ml-auto h-9 w-[116px] rounded-[10px]" />
                </div>
              ))}
            </div>
          </div>

          {/* Paginacion */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-borde px-5 py-[13px]">
            <div className="hueso h-3 w-[112px]" />
            <div className="hueso h-10 w-[104px] rounded-[9px]" />

            <div className="ml-auto flex items-center gap-1.5">
              {[0, 1, 2, 3, 4].map((numero) => (
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
