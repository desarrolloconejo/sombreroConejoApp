import Link from "next/link";
import { ArrowRight, Check, FilePlus2, FileText, Plus } from "lucide-react";

import { HITOS, metricaDe, objetivoDe, porcentajeDe } from "@/lib/hooks/catalogo";
import type { FichaConResultado } from "@/types";

/**
 * La pieza en curso: lo primero que se ve al entrar al modulo.
 *
 * Cuatro estados de la misma tarjeta. Los tres hitos son los mismos que marca
 * el historial —escrita, auditada, medida— asi que el porcentaje no es un
 * adorno: es la posicion real de la ficha en el recorrido.
 *
 * Al registrar las metricas la pieza se termina y la tarjeta vuelve al primer
 * estado. Eso es lo que hace que el modulo tenga un CICLO y no una lista que
 * solo crece.
 */

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

/** El contador de borradores. Empezar otra no pierde la anterior. */
function Otros({ cuantos }: { cuantos: number }) {
  if (cuantos <= 0) return null;

  return (
    <Link
      href="/dashboard/hooks/historial?estado=borrador"
      className="suave ml-auto inline-flex items-center gap-[7px] text-xs font-semibold text-gold hover:text-white"
    >
      <FileText aria-hidden="true" className="size-[15px]" />y {cuantos} mas en
      borrador
    </Link>
  );
}

const PANEL =
  "surge rounded-[15px] border border-nav-borde bg-navy px-[26px] py-6 pb-[22px] text-white";

const BOTON_ORO =
  "suave inline-flex min-h-11 items-center justify-center gap-2.5 rounded-xl bg-gold px-5 text-[13.5px] font-semibold text-navy hover:bg-white";

const BOTON_LINEA =
  "suave inline-flex min-h-11 items-center justify-center gap-2.5 rounded-xl border border-white/22 px-5 text-[13.5px] font-semibold text-white hover:border-gold hover:text-gold";

export function PiezaEnCurso({
  pieza,
  ultima,
  borradores,
}: {
  /** La mas avanzada que aun no esta medida, o null si no hay ninguna. */
  pieza: FichaConResultado | null;
  /** La ultima terminada, para el cuarto estado. */
  ultima: FichaConResultado | null;
  borradores: number;
}) {
  /* --- 1 · sin nada, o justo despues de cerrar una ----------------------- */
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

          <Otros cuantos={borradores} />
        </div>
      </div>
    );
  }

  /* --- 2 y 3 · borrador (33 %) o auditada (66 %) ------------------------- */
  const porcentaje = porcentajeDe(pieza.estado);
  const auditada = pieza.estado === "auditada";

  return (
    <div className={PANEL}>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-[320px] flex-1">
          <p className="mb-2.5 text-[10.5px] font-bold tracking-[0.1em] text-white/50 uppercase">
            Tu pieza en curso ·{" "}
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
            <Link href="/dashboard/hooks/metricas" className={BOTON_ORO}>
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
            <Link
              href={`/dashboard/hooks/nuevo?panel=editar&id=${pieza.id}`}
              className={BOTON_ORO}
            >
              Seguir donde lo dejaste
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <Link href="/dashboard/hooks/nuevo" className={BOTON_LINEA}>
              <Plus aria-hidden="true" className="size-4" />
              Empezar otra
            </Link>
          </>
        )}

        {/* Se descuenta la propia pieza si es un borrador: decir "y 2 mas"
            cuando una de las dos es la que se esta mirando confunde. */}
        <Otros cuantos={auditada ? borradores : borradores - 1} />
      </div>
    </div>
  );
}
