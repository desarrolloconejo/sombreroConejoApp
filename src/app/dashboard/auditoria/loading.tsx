import { REJILLA_AUDITORIA } from "@/components/auditoria";

/**
 * Esqueleto del listado de auditoria.
 *
 * Copia la geometria real: mismos altos, mismos rellenos y la MISMA rejilla
 * que la tabla, importada de las columnas del modulo. No lleva boton de alta
 * porque el listado tampoco: la auditoria es de solo lectura.
 */

/** Ancho de cada filtro desplegable: modulo y periodo. */
const FILTROS = ["128px", "136px"];

/** Anchos de las celdas de cada fila, para que no salgan todas iguales. */
const FILAS = [
  { fecha: 86, nombre: 142, correo: 168, accion: 132, clave: 112, empresa: 104 },
  { fecha: 92, nombre: 118, correo: 152, accion: 158, clave: 128, empresa: 0 },
  { fecha: 84, nombre: 156, correo: 174, accion: 116, clave: 104, empresa: 126 },
  { fecha: 90, nombre: 128, correo: 146, accion: 146, clave: 136, empresa: 92 },
  { fecha: 88, nombre: 164, correo: 182, accion: 124, clave: 108, empresa: 0 },
  { fecha: 86, nombre: 112, correo: 158, accion: 152, clave: 120, empresa: 118 },
];

const REJILLA = "grid items-center gap-3.5 px-5";

export default function CargandoAuditoria() {
  return (
    <div role="status" aria-label="Cargando la auditoria">
      <div aria-hidden="true">
        {/* Migas */}
        <div className="mb-3 flex items-center gap-[7px] lg:mb-[13px]">
          <div className="hueso h-3 w-[78px]" />
          <div className="hueso size-[9px]" />
          <div className="hueso h-3 w-[64px]" />
        </div>

        {/* Cabecera del Wrapper */}
        <div className="mb-5 border-b border-borde pb-[18px] lg:mb-6 lg:pb-5">
          <div className="hueso h-3.5 w-[62px]" />
          <div className="hueso mt-2.5 h-[28px] w-[168px] lg:mt-[9px] lg:h-[42px] lg:w-[224px]" />
          <div className="hueso mt-2.5 h-3.5 w-full max-w-[520px] lg:mt-[11px]" />
        </div>

        <div className="rounded-[15px] border border-borde bg-superficie shadow-[var(--sombra)]">
          {/* Buscador, sin accion principal */}
          <div className="flex flex-wrap items-center gap-3 border-b border-borde px-5 py-4">
            <div className="hueso h-11 w-full min-w-0 flex-1 rounded-[10px] sm:max-w-[340px]" />
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
                style={{ gridTemplateColumns: REJILLA_AUDITORIA }}
                className={`${REJILLA} h-11 border-b border-borde bg-campo`}
              >
                <div className="hueso h-[11px] w-[56px]" />
                <div className="hueso h-[11px] w-[44px]" />
                <div className="hueso h-[11px] w-[62px]" />
                <div className="hueso h-[11px] w-[58px]" />
                <div />
              </div>

              {FILAS.map((fila, indice) => (
                <div
                  key={`fila-${indice}`}
                  style={{ gridTemplateColumns: REJILLA_AUDITORIA }}
                  className={`${REJILLA} min-h-[62px] border-b border-borde py-3 last:border-b-0`}
                >
                  <div className="min-w-0">
                    <div className="hueso h-3 max-w-full" style={{ width: fila.fecha }} />
                    <div className="hueso mt-[7px] h-[11px] w-[52px]" />
                  </div>

                  <div className="min-w-0">
                    <div className="hueso h-3 max-w-full" style={{ width: fila.nombre }} />
                    <div
                      className="hueso mt-[7px] h-[11px] max-w-full"
                      style={{ width: fila.correo }}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="hueso h-3 max-w-full" style={{ width: fila.accion }} />
                    <div
                      className="hueso mt-[7px] h-[11px] max-w-full"
                      style={{ width: fila.clave }}
                    />
                  </div>

                  {fila.empresa > 0 ? (
                    <div className="hueso h-3 max-w-full" style={{ width: fila.empresa }} />
                  ) : (
                    <div className="hueso h-3 w-[14px]" />
                  )}

                  <div className="hueso ml-auto size-9 rounded-[10px]" />
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
