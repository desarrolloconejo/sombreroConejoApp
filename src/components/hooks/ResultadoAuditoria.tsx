import { UMBRAL } from "@/lib/hooks/listas";
import type { EstadoControl, ResultadoAuditoria as Resultado } from "@/types";

/**
 * El resultado de una auditoria: la nota, el veredicto y los nueve controles.
 *
 * Es de servidor y puro: recibe el resultado ya calculado. El auditor corre
 * en la action, no aqui.
 */

const VEREDICTOS = {
  listo: {
    titulo: "Listo para grabar",
    pie: "Pasa el umbral con margen. Ninguno de los fallos duros ha saltado.",
  },
  aprobado_con_avisos: {
    titulo: "Aprobado · pule avisos",
    pie: "Pasa, pero hay controles en aviso que conviene mirar antes de rodar.",
  },
  reescribir: {
    titulo: "Reescribir antes de grabar",
    pie: "Por debajo del umbral de paso.",
  },
  descartar: {
    titulo: "Descartar y empezar de cero",
    pie: "Muy por debajo del umbral. Sale mas a cuenta empezar otra vez.",
  },
} as const;

const MARCAS: Record<EstadoControl, { simbolo: string; clase: string }> = {
  pasa: { simbolo: "✓", clase: "bg-acento-tenue text-acento" },
  aviso: { simbolo: "!", clase: "bg-blackberry/12 text-blackberry dark-tema:text-[#e9a9cd]" },
  falla: { simbolo: "×", clase: "bg-blackberry/16 text-blackberry dark-tema:text-[#e9a9cd]" },
};

/** Circunferencia del anillo con r = 50. */
const VUELTA = 314.16;

export function ResultadoAuditoria({ resultado }: { resultado: Resultado }) {
  const veredicto = VEREDICTOS[resultado.veredicto];

  /*
   * Cuando un fallo duro ha tapado la nota hay que DECIRLO. Si no, quien mira
   * ve una suma que no cuadra con los puntos de la lista y piensa que el
   * auditor se equivoca, en lugar de entender que ese es el mecanismo.
   */
  const tapada = resultado.nota < resultado.suma;

  return (
    <div className="tarjeta overflow-hidden rounded-[15px] border border-borde bg-superficie shadow-[var(--sombra)]">
      <div className="border-b border-borde px-[22px] py-[18px]">
        <p className="text-[10.5px] font-bold tracking-[0.1em] text-suave uppercase">
          Resultado · umbral {UMBRAL}
        </p>
      </div>

      <div className="px-[22px] py-6">
        <div className="flex flex-wrap items-center gap-5">
          <div className="relative size-28 shrink-0">
            <svg viewBox="0 0 112 112" className="size-28">
              <circle
                cx="56"
                cy="56"
                r="50"
                fill="none"
                stroke="var(--borde)"
                strokeWidth="8"
              />
              <circle
                cx="56"
                cy="56"
                r="50"
                fill="none"
                stroke={resultado.aprobado ? "var(--acento)" : "var(--color-blackberry)"}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(resultado.nota / 100) * VUELTA} ${VUELTA}`}
                transform="rotate(-90 56 56)"
              />
            </svg>

            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="text-[32px] leading-none font-extrabold tracking-[-0.03em]">
                  {resultado.nota}
                </div>
                <div className="text-[10px] font-bold tracking-[0.1em] text-suave">
                  / 100
                </div>
              </div>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="mb-1.5 text-xl leading-tight font-extrabold tracking-[-0.02em]">
              {veredicto.titulo}
            </p>
            <p className="text-[11.5px] leading-relaxed text-suave">
              {tapada ? (
                <>
                  Sumaba {resultado.suma}, pero un{" "}
                  <b className="text-blackberry dark-tema:text-[#e9a9cd]">fallo duro</b>{" "}
                  tapa la nota en {resultado.nota}: con el no puede aprobar, por
                  muy alta que sea la suma.
                </>
              ) : (
                veredicto.pie
              )}
            </p>
          </div>
        </div>

        <div className="mt-[18px] h-[7px] overflow-hidden rounded-full bg-borde">
          <div
            className={[
              "h-full rounded-full",
              resultado.aprobado ? "bg-acento" : "bg-blackberry",
            ].join(" ")}
            style={{ width: `${resultado.nota}%` }}
          />
        </div>

        {resultado.limiteAmpliado && (
          <p className="mt-3 rounded-xl border border-acento bg-acento-tenue px-3.5 py-2.5 text-[11.5px] leading-relaxed">
            <b>Esta cuenta usa un limite ampliado.</b> El auditor respeta la
            regla, pero la desviacion sobre el estandar 12/6 queda visible.
          </p>
        )}
      </div>

      <ul className="px-[22px] pb-5">
        {resultado.controles.map((control) => {
          const marca = MARCAS[control.estado];

          return (
            <li
              key={control.clave}
              className="flex gap-3 border-b border-borde py-[13px] last:border-b-0"
            >
              <span
                aria-hidden="true"
                className={[
                  "mt-px grid size-5 shrink-0 place-items-center rounded-md",
                  "text-[11px] font-extrabold",
                  marca.clase,
                ].join(" ")}
              >
                {marca.simbolo}
              </span>

              <div className="min-w-0">
                <h4 className="mb-[3px] text-[12.5px] font-bold">
                  {control.titulo}
                  {control.duro && (
                    <span className="ml-[7px] rounded-[5px] bg-blackberry/14 px-1.5 py-0.5 text-[10px] font-extrabold tracking-[0.08em] text-blackberry uppercase dark-tema:text-[#e9a9cd]">
                      fallo duro
                    </span>
                  )}
                </h4>
                <p className="text-xs leading-relaxed text-suave">{control.mensaje}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** El panel antes de auditar. Dice que se va a medir, no finge un resultado. */
export function ResultadoNeutro() {
  return (
    <div className="overflow-hidden rounded-[15px] border border-nav-borde bg-navy text-white">
      <div className="border-b border-white/10 px-[22px] py-[18px]">
        <p className="text-[10.5px] font-bold tracking-[0.1em] text-white/50 uppercase">
          Resultado neutral
        </p>
      </div>

      <div className="px-6 py-10 text-center">
        <div className="relative mx-auto mb-[22px] size-28">
          <svg viewBox="0 0 112 112" className="size-28">
            <circle
              cx="56"
              cy="56"
              r="50"
              fill="none"
              stroke="rgb(255 255 255 / 0.12)"
              strokeWidth="8"
              strokeDasharray="3 9"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <p className="mb-2.5 text-[21px] leading-tight font-extrabold tracking-[-0.02em]">
          Audita cuando tengas una promesa.
        </p>
        <p className="mx-auto max-w-[40ch] text-[12.5px] leading-relaxed text-white/60">
          El score y el veredicto aparecen solo despues de pulsar «Auditar».
          Umbral de paso: {UMBRAL}.
        </p>
      </div>
    </div>
  );
}
