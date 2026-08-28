"use client";

import { Campo } from "@/components/ui";

/**
 * Los campos de un registro de metricas, y la lectura del hook rate.
 *
 * Viven aparte porque tienen DOS consumidores: el modulo de metricas, que
 * empieza eligiendo la ficha de un desplegable, y el panel del auditor, que
 * llega con la ficha ya decidida.
 *
 * Y estan aqui por una razon concreta, no por gusto de factorizar: el fallo
 * mas caro de este modulo fue un campo cuya etiqueta no correspondia a su
 * columna, y con la lista duplicada en dos formularios ese error puede volver
 * por un solo lado y pasar desapercibido. Una lista, un sitio.
 */

/** Las bandas del documento. La banda en la que cae la pieza se resalta. */
export const BANDAS = [
  { hasta: 15, nombre: "Matar", lectura: "La apertura no esta parando el scroll. Cambia fotograma y primer segundo." },
  { hasta: 20, nombre: "Arreglar apertura", lectura: "Prueba tres aperturas nuevas sobre el mismo cuerpo." },
  { hasta: 30, nombre: "Sano", lectura: "Mira el hold rate: si cae, el problema ya no es el hook." },
  { hasta: 35, nombre: "Bueno", lectura: "Anota territorio y mecanismo: puede ser un estandar del cliente." },
  { hasta: Infinity, nombre: "Elite", lectura: "Genera variantes del mismo territorio antes de que fatigue." },
] as const;

/** Volumen por debajo del cual la cifra es ruido, no veredicto. */
export const VOLUMEN_MINIMO = 2000;

/** Acepta los separadores de miles con los que la gente copia y pega. */
export function aNumero(texto: string): number {
  const limpio = texto.replace(/[.\s]/g, "").replace(",", ".");
  const numero = Number(limpio);
  return Number.isFinite(numero) && numero > 0 ? Math.trunc(numero) : 0;
}

export function bandaDe(tasa: number | null) {
  if (tasa === null) return null;
  return BANDAS.find((b) => tasa < b.hasta) ?? BANDAS[4];
}

export function CamposMetricas({
  prefijo,
  impresiones,
  alCambiarImpresiones,
  vistas,
  alCambiarVistas,
  cruzados,
  errorVistas,
}: {
  /** Distingue los ids cuando dos formularios comparten pantalla. */
  prefijo: string;
  impresiones: string;
  alCambiarImpresiones: (valor: string) => void;
  vistas: string;
  alCambiarVistas: (valor: string) => void;
  /** Hay mas vistas que impresiones: casi siempre, dos campos cruzados. */
  cruzados: boolean;
  errorVistas?: string;
}) {
  return (
    <>
      <div className="grid gap-3.5 sm:grid-cols-3">
        <Campo
          id={`${prefijo}-impresiones`}
          name="impresiones"
          etiqueta="Impresiones"
          inputMode="numeric"
          placeholder="0"
          value={impresiones}
          onChange={(e) => alCambiarImpresiones(e.target.value)}
        />

        <Campo
          id={`${prefijo}-vistas`}
          name="vistas3s"
          etiqueta="Vistas 3 s"
          inputMode="numeric"
          placeholder="0"
          value={vistas}
          onChange={(e) => alCambiarVistas(e.target.value)}
          error={
            cruzados
              ? "Hay mas vistas que impresiones. Revisa si se cruzaron los dos campos."
              : errorVistas
          }
        />

        {/*
          LOS ROTULOS SON FIJOS, Y ESO ES EL ARREGLO.
          El primero de estos campos tomaba su etiqueta de la metrica del
          objetivo de la ficha. Con objetivo "compartidos" ponia "Compartidos"
          —duplicando el siguiente— y escribia en la columna `guardados`; con
          "consideracion" ponia "Clics" y pasaba lo mismo. Habia datos en la
          columna equivocada.

          Cual es la metrica que manda se dice junto a la ficha, que es donde
          no puede confundirse con el nombre de un campo.
        */}
        <Campo
          id={`${prefijo}-me-gusta`}
          name="meGusta"
          etiqueta="Me gusta"
          inputMode="numeric"
          placeholder="0"
        />

        <Campo
          id={`${prefijo}-compartidos`}
          name="compartidos"
          etiqueta="Compartidos"
          inputMode="numeric"
          placeholder="0"
        />

        <Campo
          id={`${prefijo}-clics`}
          name="clics"
          etiqueta="Clics"
          inputMode="numeric"
          placeholder="0"
        />

        <Campo
          id={`${prefijo}-guardados`}
          name="guardados"
          etiqueta="Guardados"
          inputMode="numeric"
          placeholder="0"
        />
      </div>

      <div className="mt-[18px]">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
          <label htmlFor={`${prefijo}-aprendizaje`} className="text-xs font-semibold">
            Aprendizaje de la pieza
          </label>
          <span className="text-[11.5px] font-medium text-suave">
            Lo que importa mas que el numero.
          </span>
        </div>

        <textarea
          id={`${prefijo}-aprendizaje`}
          name="aprendizaje"
          rows={3}
          maxLength={600}
          placeholder="Que mecanismo repetir la proxima vez, y cual no."
          className={[
            "suave w-full rounded-xl border-[1.5px] border-borde bg-campo px-3.5 py-3",
            "text-[13.5px] leading-relaxed text-texto placeholder:text-suave",
            "focus:border-acento focus:bg-superficie focus:shadow-[var(--foco)] focus:outline-none",
          ].join(" ")}
        />
      </div>
    </>
  );
}

/**
 * El hook rate en vivo, con la banda en la que cae.
 *
 * Se calcula mientras se teclea y no al guardar: ver la tasa antes de enviar
 * es lo que hace que alguien note que cruzo dos campos, que es la
 * equivocacion mas comun al copiar cifras de un panel de analitica.
 */
export function DiagnosticoHookRate({
  impresiones,
  vistas,
  compacto = false,
}: {
  impresiones: number;
  vistas: number;
  /** Sin la tabla de bandas, para cuando va dentro de un panel estrecho. */
  compacto?: boolean;
}) {
  const tasa = impresiones > 0 ? (vistas * 100) / impresiones : null;
  const banda = bandaDe(tasa);

  return (
    <div className="rounded-[15px] border border-nav-borde bg-navy p-[22px] text-white">
      <p className="mb-4 text-[10.5px] font-bold tracking-[0.1em] text-white/50 uppercase">
        Diagnostico de hook rate · Meta / trafico frio
      </p>

      <div className="py-1.5 pb-[18px] text-center">
        <div className="text-5xl leading-none font-extrabold tracking-[-0.04em] text-gold">
          {tasa === null ? "—" : `${tasa.toFixed(1).replace(".", ",")}%`}
        </div>
        <p className="mt-3 text-[11.5px] text-white/60">
          {tasa === null
            ? "Introduce impresiones y vistas a 3 segundos."
            : `${vistas.toLocaleString("es-VE")} vistas de 3 s sobre ${impresiones.toLocaleString("es-VE")} impresiones`}
        </p>
      </div>

      {compacto ? (
        banda && (
          <p className="rounded-xl bg-white/[0.06] px-3.5 py-3 text-[11.5px] leading-relaxed text-white/60">
            <b className="text-gold">{banda.nombre}.</b> {banda.lectura}
          </p>
        )
      ) : (
        <div>
          {BANDAS.map((b, i) => {
            const activa = banda === b;
            const rango =
              i === 0 ? "< 15%" : b.hasta === Infinity ? "≥ 35%" : `${BANDAS[i - 1]!.hasta}–${b.hasta}%`;

            return (
              <div
                key={b.nombre}
                className={[
                  "grid grid-cols-[86px_minmax(0,1fr)] items-center gap-4 border-b border-white/10 py-[11px] last:border-b-0",
                  activa ? "-mx-3 rounded-[10px] bg-white/[0.06] px-3" : "",
                ].join(" ")}
              >
                <b className={["text-[12.5px] font-bold", activa ? "text-gold" : ""].join(" ")}>
                  {rango}
                </b>
                <span className="text-[11.5px] leading-relaxed text-white/60">
                  <b className={activa ? "text-white" : ""}>{b.nombre}.</b> {b.lectura}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/*
        Por debajo del volumen minimo la cifra no significa nada, y decirlo
        antes de guardar evita que una pieza con 300 impresiones acabe citada
        en una reunion como si fuera un resultado.
      */}
      {tasa !== null && impresiones < VOLUMEN_MINIMO && (
        <p className="mt-4 rounded-xl border border-gold/25 bg-gold/12 px-3.5 py-2.5 text-[11.5px] leading-relaxed">
          Con menos de {VOLUMEN_MINIMO.toLocaleString("es-VE")} impresiones la
          cifra puede ser ruido. Guardala igual, pero no la defiendas todavia.
        </p>
      )}

      <p className="mt-4 rounded-xl border border-[#d77474] bg-[rgb(215_116_116/0.12)] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-[#f0b8b8]">
        <b>Aviso sobre estas cifras.</b> Ninguna plataforma publica umbrales
        oficiales de hook rate. Las bandas vienen de proveedores de analitica
        con sesgo de cartera; despues del primer mes, la referencia util es el
        historico de tu cuenta.
      </p>
    </div>
  );
}
