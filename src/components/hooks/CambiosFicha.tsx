import { FilePlus2, Pencil, ShieldCheck, ChartNoAxesColumn } from "lucide-react";

import { PanelCuerpo, PanelPie } from "@/components/listado";
import { BotonEnlace } from "@/components/ui";
import type { AccionEdicion, EdicionFicha } from "@/types";
import { ZONA_HORARIA } from "@/lib/fechas";

/**
 * Quien ha tocado esta ficha, y cuando.
 *
 * En el historial cualquiera edita la ficha de cualquiera, y hasta ahora la
 * ficha solo sabia quien la habia creado y la fecha del ultimo cambio: si
 * alguien reescribia el hook de otro, no quedaba rastro de quien.
 *
 * Es de servidor y no guarda nada: recibe las lineas ya resueltas.
 */

const ACCIONES: Record<
  AccionEdicion,
  { verbo: string; icono: typeof Pencil; pie: string }
> = {
  creada: {
    verbo: "la creo",
    icono: FilePlus2,
    pie: "Nacio como borrador.",
  },
  editada: {
    verbo: "la edito",
    icono: Pencil,
    pie: "Cambio algo de la decision o del texto.",
  },
  auditada: {
    verbo: "la audito",
    icono: ShieldCheck,
    pie: "Le guardo su nota y la paso el control.",
  },
  medida: {
    verbo: "registro sus numeros",
    icono: ChartNoAxesColumn,
    pie: "Con esto la pieza queda terminada.",
  },
};

/**
 * Dia y hora en el formato de aqui. Sin segundos: no aportan nada.
 *
 * La zona horaria va ESCRITA y no se hereda del servidor. Esto se pinta en el
 * servidor, que corre en UTC en Docker y en Ohio en produccion: sin fijarla, un
 * cambio hecho a las dos de la tarde se leeria a las seis, y una hora
 * equivocada en un registro de cambios es peor que no tenerlo.
 */
function cuando(fecha: Date): string {
  return new Intl.DateTimeFormat("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ZONA_HORARIA,
  }).format(fecha);
}

export function CambiosFicha({
  cambios,
  hrefCerrar,
}: {
  cambios: EdicionFicha[];
  hrefCerrar: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PanelCuerpo>
        {cambios.length === 0 ? (
          /*
            Una ficha anterior a este registro no tiene lineas, y no es lo
            mismo que una que nadie ha tocado. Se dice cual de las dos cosas
            es, en lugar de dejar un vacio que se lee como «no paso nada».
          */
          <p className="rounded-xl border border-borde bg-campo px-4 py-5 text-center text-[12.5px] leading-relaxed text-suave">
            No hay cambios registrados. Las fichas anteriores a esta pantalla no
            los tienen guardados: de ellas solo se sabe quien las creo.
          </p>
        ) : (
          <ol>
            {cambios.map((cambio, i) => {
              const { verbo, icono: Icono, pie } = ACCIONES[cambio.accion];
              const ultimo = i === cambios.length - 1;

              return (
                <li key={cambio.id} className="grid grid-cols-[36px_minmax(0,1fr)] gap-3.5">
                  {/* La columna de la izquierda es la linea de tiempo: el icono
                      y, salvo en el ultimo, el hilo que baja al siguiente. */}
                  <div className="flex flex-col items-center">
                    <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-acento-tenue text-acento">
                      <Icono aria-hidden="true" className="size-4" />
                    </span>

                    {!ultimo && <span aria-hidden="true" className="w-px flex-1 bg-borde" />}
                  </div>

                  <div className={ultimo ? "pb-1" : "pb-5"}>
                    <p className="text-[13.5px] leading-snug font-semibold">
                      {cambio.usuarioNombre ?? "Una cuenta que ya no existe"}{" "}
                      <span className="font-medium text-suave">{verbo}</span>
                    </p>

                    <p className="mt-1 text-[11.5px] text-suave">
                      {cuando(cambio.creadoEn)}
                    </p>

                    <p className="mt-1.5 text-[11.5px] leading-relaxed text-suave">
                      {pie}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </PanelCuerpo>

      <PanelPie>
        <BotonEnlace href={hrefCerrar} variante="fantasma">
          Cerrar
        </BotonEnlace>
      </PanelPie>
    </div>
  );
}
