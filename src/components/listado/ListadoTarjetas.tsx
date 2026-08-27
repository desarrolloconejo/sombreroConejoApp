import type { Columna } from "@/types";

/**
 * El listado en formato tarjeta, para pantallas estrechas.
 *
 * No es una tabla escondida: es otra manera de leer los mismos datos. Una
 * tabla de cinco columnas en 360 px solo puede desbordar o encoger el texto
 * hasta lo ilegible, y hacer arrastrar de lado para leer un registro es peor
 * que no tener tabla.
 *
 * El modulo no escribe esto. Cada columna ya declara su papel con `tarjeta`, y
 * de ahi sale la tarjeta entera: titulo arriba, datos con su rotulo en medio,
 * acciones al pie.
 *
 * El rotulo lo pone el titulo de la columna, que en la tabla vive en la
 * cabecera. Sin el, un valor suelto como "Redes" o "Activo" no dice de que
 * habla: la cabecera es la que lo explicaba.
 */

/** Reparte las columnas segun el papel que cada una declara. */
function repartir<T>(columnas: Columna<T>[]) {
  const datos: Columna<T>[] = [];
  const acciones: Columna<T>[] = [];
  let titulo: Columna<T> | null = null;

  for (const columna of columnas) {
    const papel = columna.tarjeta ?? "dato";

    if (papel === "oculta") continue;
    if (papel === "acciones") acciones.push(columna);
    else if (papel === "titulo" && !titulo) titulo = columna;
    else datos.push(columna);
  }

  // Ningun modulo deberia quedarse sin encabezado por no declararlo: si nadie
  // se marco como titulo, encabeza el primer dato.
  if (!titulo && datos.length > 0) titulo = datos.shift() ?? null;

  return { titulo, datos, acciones };
}

export function ListadoTarjetas<T>({
  columnas,
  filas,
  claveFila,
  titulo,
}: {
  columnas: Columna<T>[];
  filas: T[];
  claveFila?: (fila: T) => string | number;
  titulo?: string;
}) {
  const { titulo: columnaTitulo, datos, acciones } = repartir(columnas);

  return (
    <ul aria-label={titulo} className="flex flex-col gap-3 p-3 lg:hidden">
      {filas.map((fila, indice) => (
        <li
          key={claveFila ? claveFila(fila) : indice}
          className="rounded-[13px] border border-borde bg-campo px-4 py-[15px]"
        >
          {columnaTitulo && (
            <div className="min-w-0 text-[13.5px]">
              {columnaTitulo.render(fila)}
            </div>
          )}

          {datos.length > 0 && (
            /*
              Dos columnas de rotulo y valor. `dl` y no una tabla: es una lista
              de pares nombre-valor de UN registro, que es justo lo que un
              lector de pantalla anuncia bien con este elemento.
            */
            <dl className="mt-3.5 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-2 border-t border-borde pt-3.5">
              {datos.map((columna) => (
                <div key={columna.clave} className="contents">
                  <dt className="min-w-0 self-center text-[10.5px] font-bold tracking-[0.08em] text-suave uppercase">
                    {columna.titulo}
                  </dt>
                  <dd className="min-w-0 self-center text-[12.5px]">
                    {columna.render(fila)}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {acciones.length > 0 && (
            <div className="mt-3.5 flex flex-wrap justify-end gap-2 border-t border-borde pt-3.5">
              {acciones.map((columna) => (
                <div key={columna.clave}>{columna.render(fila)}</div>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
