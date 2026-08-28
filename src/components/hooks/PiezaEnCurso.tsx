import Link from "next/link";
import { ArrowRight, Check, FilePlus2, Plus } from "lucide-react";

import { HITOS, metricaDe, objetivoDe, porcentajeDe } from "@/lib/hooks/catalogo";
import type { FichaConResultado } from "@/types";

/**
 * Las piezas en curso: lo primero que se ve al entrar al modulo.
 *
 * Los hitos son los mismos que marca el historial —escrita, auditada, medida—
 * asi que el porcentaje no es un adorno: es la posicion real de la ficha en el
 * recorrido.
 *
 * POR QUE SON VARIAS Y NO UNA
 * ---------------------------
 * Antes se mostraba una sola, elegida por lo avanzada que estuviera: primero
 * la que solo esperaba numeros y, si no habia, el borrador tocado mas
 * recientemente. La intencion era buena —una pieza publicada sin metricas es
 * la que mas urge cerrar— pero el efecto era que la portada ensenaba una pieza
 * que podia no tener nada que ver con lo que se estaba escribiendo, y las
 * demas no aparecian por ningun lado.
 *
 * Ahora llegan en orden, la ultima escrita primero, y se ven todas con su
 * avance. Cual retomar es una decision de quien mira, no del ORDER BY.
 *
 * Al registrar las metricas la pieza se termina y sale de aqui. Eso es lo que
 * hace que el modulo tenga un CICLO y no una lista que solo crece.
 */

const PANEL =
  "surge rounded-[15px] border border-nav-borde bg-navy px-[26px] py-6 pb-[22px] text-white";

const BOTON_ORO =
  "suave inline-flex min-h-11 items-center justify-center gap-2.5 rounded-xl bg-gold px-5 text-[13.5px] font-semibold text-navy hover:bg-white";

const BOTON_LINEA =
  "suave inline-flex min-h-11 items-center justify-center gap-2.5 rounded-xl border border-white/22 px-5 text-[13.5px] font-semibold text-white hover:border-gold hover:text-gold";

/**
 * A donde lleva cada pieza segun donde se quedo.
 *
 * Un borrador vuelve al canvas, que es donde se sigue escribiendo. Una
 * auditada va a metricas con su ficha ya elegida: es lo unico que le falta.
 */
function destinoDe(pieza: FichaConResultado): string {
  return pieza.estado === "auditada"
    ? `/dashboard/hooks/metricas?ficha=${pieza.id}`
    : `/dashboard/hooks/nuevo?panel=editar&id=${pieza.id}`;
}

function Avance({ porcentaje }: { porcentaje: number }) {
  return (
    <div className="mt-[22px]">
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gold"
          style={{ width: `${porcentaje}%` }}
        />
      </div>

      <div className="mt-[11px] grid grid-cols-3 gap-2">
        {HITOS.map((hito, i) => {
          const hecho = porcentaje >= hito.porcentaje;

          return (
            <span
              key={hito.nombre}
              className={[
                "flex items-center gap-1.5 text-[11.5px] font-semibold",
                i === 1 ? "justify-center" : i === 2 ? "justify-end" : "",
                hecho ? "text-gold" : "text-white/62",
              ].join(" ")}
            >
              <span
                aria-hidden="true"
                className={[
                  "grid size-[15px] shrink-0 place-items-center rounded-full border-[1.5px]",
                  hecho ? "border-gold bg-gold" : "border-white/12",
                ].join(" ")}
              >
                {hecho && <Check className="size-[9px] text-navy" strokeWidth={3.5} />}
              </span>
              {hito.nombre}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Las demas piezas abiertas, una por fila.
 *
 * Cada una lleva su avance y, si ya paso el auditor, su nota. Son dos numeros
 * que miden cosas distintas —cuanto le falta y como de buena es— y por eso van
 * rotulados y separados: juntos y sin nombre se leerian como uno solo.
 */
function Resto({ piezas }: { piezas: FichaConResultado[] }) {
  if (piezas.length === 0) return null;

  return (
    <div className="mt-5 border-t border-white/12 pt-[18px]">
      <p className="mb-2.5 text-[10.5px] font-bold tracking-[0.1em] text-white/50 uppercase">
        Tambien abiertas · {piezas.length}
      </p>

      <ul>
        {piezas.map((pieza) => {
          const porcentaje = porcentajeDe(pieza.estado);

          return (
            <li key={pieza.id}>
              <Link
                href={destinoDe(pieza)}
                className="suave -mx-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl px-3 py-2.5 hover:bg-white/[0.06]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold">
                    {pieza.hablado}
                  </span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-white/62">
                    {pieza.empresaNombre} · {objetivoDe(pieza.objetivo).nombre}
                  </span>
                </span>

                <span className="flex shrink-0 items-center gap-3.5">
                  {/* La nota solo existe si ya paso el auditor. Sin ella la
                      fila no finge un hueco: simplemente no se pinta. */}
                  {pieza.notaAuditor !== null && (
                    <span className="hidden rounded-md border border-gold/30 px-2 py-0.5 text-[11px] font-bold text-gold sm:inline">
                      nota {pieza.notaAuditor}
                    </span>
                  )}

                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.09] sm:block"
                    >
                      <span
                        className="block h-full rounded-full bg-gold"
                        style={{ width: `${porcentaje}%` }}
                      />
                    </span>

                    <span className="w-[38px] text-right text-[12.5px] font-bold text-gold">
                      {porcentaje}%
                    </span>
                  </span>

                  <ArrowRight aria-hidden="true" className="size-4 text-white/50" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function PiezaEnCurso({
  piezas,
  ultima,
}: {
  /** Las que aun no estan medidas, la ultima escrita primero. */
  piezas: FichaConResultado[];
  /** La ultima terminada, para cuando no queda ninguna abierta. */
  ultima: FichaConResultado | null;
}) {
  const [pieza, ...resto] = piezas;

  /* --- 1 · sin nada, o justo despues de cerrar la ultima ----------------- */
  if (!pieza) {
    const tasa = ultima?.hookRate;

    return (
      <div className={PANEL}>
        {ultima ? (
          <>
            <p className="mb-2 text-[10.5px] font-bold tracking-[0.1em] text-white/50 uppercase">
              Ultima pieza terminada
            </p>
            <p className="mb-1 text-[21px] leading-snug font-bold tracking-[-0.022em]">
              &laquo;{ultima.hablado}&raquo;
            </p>
            <p className="text-[12.5px] text-white/62">
              {ultima.empresaNombre}
              {tasa !== null && tasa !== undefined
                ? ` · ${tasa.toFixed(1).replace(".", ",")}% de hook rate`
                : ""}
            </p>

            <Avance porcentaje={100} />

            {/* Lo que aprendio se lleva a la pieza siguiente, asi que se
                muestra justo antes del boton de empezar otra. */}
            {ultima.resultado?.aprendizaje && (
              <div className="mt-5 rounded-xl bg-white/[0.06] px-[15px] py-3.5">
                <p className="mb-1.5 text-[10.5px] font-bold tracking-[0.1em] text-white/45 uppercase">
                  Lo que dejo escrito
                </p>
                <p className="text-[12.5px] leading-relaxed">
                  {ultima.resultado.aprendizaje}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-[22px]">
            <span className="grid size-[52px] shrink-0 place-items-center rounded-[15px] bg-white/[0.06] text-white/62">
              <FilePlus2 aria-hidden="true" className="size-6" strokeWidth={1.8} />
            </span>
            <div className="min-w-[280px] flex-1">
              <p className="mb-1.5 text-[19px] font-extrabold tracking-[-0.022em]">
                No tienes ninguna pieza en curso.
              </p>
              <p className="text-[12.5px] text-white/62">
                Empieza por el cliente y el objetivo; el resto sale de ahi.
              </p>
            </div>
          </div>
        )}

        <div
          className={[
            "flex flex-wrap items-center gap-3",
            ultima ? "mt-5 border-t border-white/12 pt-5" : "mt-5",
          ].join(" ")}
        >
          <Link href="/dashboard/hooks/nuevo" className={BOTON_ORO}>
            <Plus aria-hidden="true" className="size-4" />
            Crear un hook
          </Link>

          {ultima && (
            <Link href="/dashboard/hooks/historial" className={BOTON_LINEA}>
              Ver el resultado
            </Link>
          )}
        </div>
      </div>
    );
  }

  /* --- 2 · la ultima escrita, con las demas debajo ----------------------- */
  const porcentaje = porcentajeDe(pieza.estado);
  const auditada = pieza.estado === "auditada";

  return (
    <div className={PANEL}>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-[320px] flex-1">
          <p className="mb-2.5 text-[10.5px] font-bold tracking-[0.1em] text-white/50 uppercase">
            Lo ultimo que escribiste ·{" "}
            {auditada ? `auditada con ${pieza.notaAuditor}` : "borrador"}
          </p>
          <p className="mb-1 text-[21px] leading-snug font-bold tracking-[-0.022em]">
            &laquo;{pieza.hablado}&raquo;
          </p>
          <p className="text-[12.5px] text-white/62">
            {pieza.empresaNombre} · {objetivoDe(pieza.objetivo).nombre} · se leera
            con {metricaDe(pieza.objetivo).toLowerCase()}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-[34px] leading-none font-extrabold tracking-[-0.035em] text-gold">
            {porcentaje}%
          </div>
          <p className="mt-1.5 text-[11px] text-white/62">del recorrido</p>
        </div>
      </div>

      <Avance porcentaje={porcentaje} />

      {auditada && (
        <div className="mt-5 rounded-xl border border-gold/25 bg-gold/12 px-[15px] py-3.5">
          <p className="text-[12.5px] leading-relaxed">
            Le falta lo unico que la termina:{" "}
            <b className="text-gold">los numeros</b>. Hasta que los tenga, esta
            pieza no le ensena nada a la cuenta.
          </p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/12 pt-5">
        {auditada ? (
          <>
            <Link href={destinoDe(pieza)} className={BOTON_ORO}>
              Registrar metricas
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <Link
              href={`/dashboard/hooks/nuevo?panel=editar&id=${pieza.id}`}
              className={BOTON_LINEA}
            >
              Ver la ficha
            </Link>
          </>
        ) : (
          <>
            <Link href={destinoDe(pieza)} className={BOTON_ORO}>
              Seguir donde lo dejaste
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <Link href="/dashboard/hooks/nuevo" className={BOTON_LINEA}>
              <Plus aria-hidden="true" className="size-4" />
              Empezar otra
            </Link>
          </>
        )}
      </div>

      <Resto piezas={resto} />
    </div>
  );
}
