import Link from "next/link";
import { ArrowRight, Filter, X } from "lucide-react";

import { EtiquetaAlerta, ORDEN_DE_ALERTAS } from "@/components/proyectos/EtiquetaAlerta";
import { fechaCorta } from "@/components/proyectos/ColumnasProyectos";
import { Bateria, Boton, BotonEnlace, CLASE_CONTROL, segmentosDeProyecto } from "@/components/ui";
import { nombreDeFase } from "@/lib/portal/catalogo";
import { rutaProyecto } from "@/lib/portal/rutas";
import {
  NOMBRES_DE_ALERTA,
  NOMBRES_DE_ESTADO_PROYECTO,
  type AlertaPieza,
  type NumeroFase,
  type Proyecto,
} from "@/types";

/**
 * Las piezas del tablero. Todas de servidor: los filtros son un formulario
 * GET que cambia la URL, y el tablero se vuelve a pintar con ella.
 */

/** Los filtros que entiende el tablero, ya validados por la page. */
export type FiltrosTablero = {
  ejecutivo: number | null;
  empresa: number | null;
  tipo: "redes_sociales" | "especial" | null;
  alerta: AlertaPieza | null;
};

/** Lo que de cada proyecto pinta la fila, ademas del proyecto. */
export type FilaTablero = Proyecto & {
  fase: { fase: NumeroFase; piezas: number } | null;
};

const PUNTO: Record<AlertaPieza, string> = {
  atrasada: "bg-blackberry dark-tema:bg-white",
  por_vencer: "bg-blackberry/45 dark-tema:bg-gold/60",
  esperando_cliente: "bg-gold ring-2 ring-navy dark-tema:ring-gold/40",
  en_correccion: "bg-violet dark-tema:bg-white/50",
};

/** La URL del tablero con unos filtros. */
export function urlTablero(ruta: string, filtros: FiltrosTablero): string {
  const parametros = new URLSearchParams();
  if (filtros.ejecutivo) parametros.set("ejecutivo", String(filtros.ejecutivo));
  if (filtros.empresa) parametros.set("empresa", String(filtros.empresa));
  if (filtros.tipo) parametros.set("tipo", filtros.tipo);
  if (filtros.alerta) parametros.set("alerta", filtros.alerta);
  const consulta = parametros.toString();
  return consulta ? `${ruta}?${consulta}` : ruta;
}

export function TarjetasAlerta({
  ruta,
  filtros,
  totales,
}: {
  ruta: string;
  filtros: FiltrosTablero;
  totales: Record<AlertaPieza, number>;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {ORDEN_DE_ALERTAS.map((alerta, indice) => {
        const activa = filtros.alerta === alerta;

        return (
          <li key={alerta} className="surge" style={{ ["--retraso" as string]: `${0.08 + indice * 0.04}s` }}>
            <Link
              href={urlTablero(ruta, { ...filtros, alerta: activa ? null : alerta })}
              aria-pressed={activa}
              aria-label={`${NOMBRES_DE_ALERTA[alerta]}: ${totales[alerta]} piezas. ${activa ? "Quitar el filtro" : "Ver solo esos proyectos"}`}
              className={[
                "suave flex h-full flex-col rounded-[15px] border bg-superficie px-4 py-3.5 shadow-[var(--sombra)]",
                "hover:-translate-y-0.5 hover:border-acento",
                activa ? "border-acento" : "border-borde",
              ].join(" ")}
            >
              <span className="flex items-center gap-2 text-[12.5px] font-semibold">
                <i aria-hidden="true" className={`size-2 shrink-0 rounded-full ${PUNTO[alerta]}`} />
                {NOMBRES_DE_ALERTA[alerta]}
              </span>
              <span className="mt-1.5 text-[30px] leading-none font-extrabold tracking-[-0.03em] tabular-nums">
                {totales[alerta]}
              </span>
              <span className="mt-1 text-[11px] text-suave">
                {totales[alerta] === 1 ? "pieza" : "piezas"}
                {activa && " · filtrando"}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function FiltrosDelTablero({
  ruta,
  filtros,
  ejecutivos,
  empresas,
}: {
  ruta: string;
  filtros: FiltrosTablero;
  ejecutivos: { id: number; nombre: string }[];
  empresas: { id: number; nombre: string }[];
}) {
  const hayFiltros = Boolean(filtros.ejecutivo || filtros.empresa || filtros.tipo || filtros.alerta);

  return (
    <form method="get" action={ruta} className="flex flex-wrap items-end gap-2.5">
      {filtros.alerta && <input type="hidden" name="alerta" value={filtros.alerta} />}

      <div className="min-w-[180px] flex-1 sm:flex-none">
        <label htmlFor="tablero-ejecutivo" className="mb-1 block text-[11px] font-semibold text-suave">
          Ejecutivo
        </label>
        <select
          id="tablero-ejecutivo"
          name="ejecutivo"
          defaultValue={filtros.ejecutivo ?? ""}
          className={`${CLASE_CONTROL} min-h-10 cursor-pointer py-2`}
        >
          <option value="">Todos</option>
          {ejecutivos.map((persona) => (
            <option key={persona.id} value={persona.id}>
              {persona.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-[180px] flex-1 sm:flex-none">
        <label htmlFor="tablero-empresa" className="mb-1 block text-[11px] font-semibold text-suave">
          Cliente
        </label>
        <select
          id="tablero-empresa"
          name="empresa"
          defaultValue={filtros.empresa ?? ""}
          className={`${CLASE_CONTROL} min-h-10 cursor-pointer py-2`}
        >
          <option value="">Todos</option>
          {empresas.map((empresa) => (
            <option key={empresa.id} value={empresa.id}>
              {empresa.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-[180px] flex-1 sm:flex-none">
        <label htmlFor="tablero-tipo" className="mb-1 block text-[11px] font-semibold text-suave">
          Tipo
        </label>
        <select
          id="tablero-tipo"
          name="tipo"
          defaultValue={filtros.tipo ?? ""}
          className={`${CLASE_CONTROL} min-h-10 cursor-pointer py-2`}
        >
          <option value="">Redes y otros proyectos</option>
          <option value="redes_sociales">Redes sociales</option>
          <option value="especial">Otros proyectos</option>
        </select>
      </div>

      <Boton type="submit" variante="fantasma" tamano="chico">
        <Filter aria-hidden="true" />
        Filtrar
      </Boton>

      {hayFiltros && (
        <BotonEnlace href={ruta} variante="fantasma" tamano="chico">
          <X aria-hidden="true" />
          Quitar filtros
        </BotonEnlace>
      )}
    </form>
  );
}

/** Lo que dice la columna «Fase actual» de un proyecto. */
function faseActual(fila: FilaTablero): { linea: string; detalle: string } {
  if (!fila.fase) {
    return fila.avance.totalPiezas === 0
      ? { linea: "Sin piezas", detalle: "Hay que anadirlas" }
      : { linea: "Todo aprobado", detalle: "Listo para cerrar" };
  }

  const { fase, piezas } = fila.fase;

  return {
    linea: `Fase ${fase} · ${nombreDeFase(fila.tipo, fase)}`,
    detalle:
      fase === 5
        ? `${piezas} ${piezas === 1 ? "pieza" : "piezas"} con el cliente`
        : `${piezas} ${piezas === 1 ? "pieza" : "piezas"} en esta fase`,
  };
}

const REJILLA =
  "lg:grid lg:grid-cols-[minmax(0,1.7fr)_minmax(0,0.9fr)_176px_minmax(0,1.6fr)_80px_minmax(0,1fr)_40px] lg:items-center lg:gap-4";

export function TablaTablero({ filas }: { filas: FilaTablero[] }) {
  if (filas.length === 0) {
    return (
      <p className="rounded-[15px] border border-borde bg-superficie px-5 py-10 text-center text-[13px] text-suave shadow-[var(--sombra)]">
        No hay proyectos en curso con esos filtros.
      </p>
    );
  }

  return (
    <div className="rounded-[15px] border border-borde bg-superficie shadow-[var(--sombra)]">
      <div
        aria-hidden="true"
        className={`${REJILLA} hidden border-b border-borde bg-campo px-5 py-3 text-[10.5px] font-bold tracking-[0.08em] text-suave uppercase lg:grid`}
      >
        <span>Cliente · Proyecto</span>
        <span>Ejecutivo</span>
        <span>Bateria</span>
        <span>Fase actual</span>
        <span>Cierre</span>
        <span>Alerta</span>
        <span />
      </div>

      <ul>
        {filas.map((fila) => {
          const fase = faseActual(fila);
          const principal = ORDEN_DE_ALERTAS.find((alerta) => fila.alertas[alerta] > 0);

          return (
            <li key={fila.id} className="border-b border-borde last:border-b-0">
              <Link
                href={rutaProyecto(fila.id)}
                className={`${REJILLA} suave flex flex-col gap-3 px-5 py-4 hover:bg-acento-tenue`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold">{fila.empresaNombre}</span>
                  <span className="block truncate text-[12px] text-suave">{fila.nombre}</span>
                </span>

                <span className="truncate text-[12.5px]">
                  <span className="text-suave lg:hidden">Lo lleva </span>
                  {fila.ejecutivoNombre}
                </span>

                <span className="flex items-center gap-2.5">
                  <Bateria
                    segmentos={segmentosDeProyecto(fila.avance.porcentaje)}
                    porcentaje={fila.avance.porcentaje}
                    etiqueta={`Avance de ${fila.nombre}`}
                    tamano="chico"
                  />
                  <span className="text-[12.5px] font-bold tabular-nums">
                    {Math.round(fila.avance.porcentaje)}%
                  </span>
                </span>

                <span className="min-w-0">
                  <span className="block text-[12.5px] leading-snug font-semibold">{fase.linea}</span>
                  <span className="block truncate text-[11.5px] text-suave">
                    {fase.detalle}
                    {fila.estado !== "activo" && ` · ${NOMBRES_DE_ESTADO_PROYECTO[fila.estado]}`}
                  </span>
                </span>

                <span className="text-[12.5px] tabular-nums">
                  <span className="text-suave lg:hidden">Cierre </span>
                  {fechaCorta(fila.fechaEstimadaCierre)}
                </span>

                <span>
                  {principal ? (
                    <EtiquetaAlerta alerta={principal} />
                  ) : (
                    <span className="text-[12px] text-suave">Al dia</span>
                  )}
                </span>

                <ArrowRight aria-hidden="true" className="hidden size-4 text-suave lg:block" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
