import { REJILLA_USUARIOS } from "@/components/usuarios";

/**
 * Esqueleto del listado de usuarios.
 *
 * Copia la geometria real en lugar de aproximarla: mismos altos, mismos
 * rellenos y, sobre todo, la MISMA rejilla que la tabla, importada de las
 * columnas del modulo. Asi las celdas caen donde van a caer y la pagina no da
 * un salto cuando llegan los datos.
 */

/** Ancho de cada chip, del largo de la etiqueta que acabara ocupando su sitio. */
/**
 * Ancho de cada filtro desplegable. No son iguales porque el boton muestra
 * el nombre del grupo y lo elegido: "Tipo de usuario Todos" ocupa menos que
 * "Estado de la cuenta Activos y desactivados".
 */
const FILTROS = ["168px", "148px", "224px", "150px", "268px"];

/** Anchos de las celdas de cada fila, para que no salgan todas iguales. */
const FILAS = [
  { nombre: 132, correo: 188, rol: 62, ambito: 92 },
  { nombre: 108, correo: 204, rol: 88, ambito: 92 },
  { nombre: 122, correo: 176, rol: 68, ambito: 158 },
  { nombre: 146, correo: 196, rol: 88, ambito: 104 },
  { nombre: 116, correo: 182, rol: 62, ambito: 138 },
  { nombre: 134, correo: 210, rol: 88, ambito: 96 },
];

const REJILLA = "grid items-center gap-3.5 px-5";

export default function CargandoUsuarios() {
  return (
    <div role="status" aria-label="Cargando los usuarios">
      <div aria-hidden="true">
        {/* Migas */}
        <div className="mb-3 flex items-center gap-[7px] lg:mb-[13px]">
          <div className="hueso h-3 w-[78px]" />
          <div className="hueso size-[9px]" />
          <div className="hueso h-3 w-[62px]" />
        </div>

        {/* Cabecera del Wrapper */}
        <div className="mb-5 border-b border-borde pb-[18px] lg:mb-6 lg:pb-5">
          <div className="hueso h-3.5 w-[150px]" />
          <div className="hueso mt-2.5 h-[28px] w-[168px] lg:mt-[9px] lg:h-[42px] lg:w-[224px]" />
          <div className="hueso mt-2.5 h-3.5 w-full max-w-[430px] lg:mt-[11px]" />
        </div>

        <div className="rounded-[15px] border border-borde bg-superficie shadow-[var(--sombra)]">
          {/* Buscador y accion principal */}
          <div className="flex flex-wrap items-center gap-3 border-b border-borde px-5 py-4">
            <div className="hueso h-11 w-full min-w-0 flex-1 rounded-[10px] sm:max-w-[340px]" />
            <div className="hueso ml-auto h-10 w-[148px] rounded-xl" />
          </div>

          {/* Chips de filtro, agrupados igual que los de verdad */}
          {/* Cinco desplegables en una fila, no pastillas sueltas: es la
              forma que tienen los filtros desde que se agruparon. */}
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
            <div className="min-w-[680px]">
              <div
                style={{ gridTemplateColumns: REJILLA_USUARIOS }}
                className={`${REJILLA} h-11 border-b border-borde bg-campo`}
              >
                <div className="hueso h-[11px] w-[72px]" />
                <div className="hueso h-[11px] w-[38px]" />
                <div className="hueso h-[11px] w-[88px]" />
                <div className="hueso h-[11px] w-[58px]" />
                <div />
              </div>

              {FILAS.map((fila, indice) => (
                <div
                  key={`fila-${indice}`}
                  style={{ gridTemplateColumns: REJILLA_USUARIOS }}
                  className={`${REJILLA} min-h-[62px] border-b border-borde py-3 last:border-b-0`}
                >
                  <div className="flex min-w-0 items-center gap-[11px]">
                    <div className="hueso size-9 shrink-0 rounded-full" />
                    <div className="min-w-0">
                      <div className="hueso h-3 max-w-full" style={{ width: fila.nombre }} />
                      <div
                        className="hueso mt-[7px] h-[11px] max-w-full"
                        style={{ width: fila.correo }}
                      />
                    </div>
                  </div>

                  <div
                    className="hueso h-[22px] max-w-full rounded-full"
                    style={{ width: fila.rol }}
                  />
                  <div className="hueso h-3 max-w-full" style={{ width: fila.ambito }} />
                  <div className="hueso h-3 w-[66px] max-w-full" />
                  <div className="hueso size-[18px]" />
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
