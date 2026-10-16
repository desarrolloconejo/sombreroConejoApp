import { ZONA_HORARIA } from "@/lib/fechas";
import { NOMBRES_DE_ESTADO_BRIEF, type EstadoBrief, type RespuestaCongelada } from "@/types";

/**
 * Las piezas de lectura de un brief, comunes al cliente y al equipo: su
 * estado, sus fechas y el contenido tal como se congelo al enviarlo.
 */

export const SECCION_BRIEF =
  "rounded-[15px] border border-borde bg-superficie p-4 shadow-[var(--sombra)] sm:p-5";


const FECHA_HORA = new Intl.DateTimeFormat("es-VE", {
  timeZone: ZONA_HORARIA,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Un dia del calendario: en UTC para no correrlo al anterior. */
const FECHA_DIA = new Intl.DateTimeFormat("es-VE", {
  timeZone: "UTC",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function cuandoBrief(fecha: Date | null): string {
  return fecha ? FECHA_HORA.format(fecha) : "—";
}

export function diaBrief(fecha: string | null): string {
  return fecha ? FECHA_DIA.format(new Date(`${fecha}T00:00:00Z`)) : "—";
}

const SOLIDOS = new Set<EstadoBrief>(["enviado", "en_validacion"]);

export function EtiquetaBrief({ estado }: { estado: EstadoBrief }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1",
        "text-[10.5px] font-semibold uppercase tracking-[0.06em]",
        SOLIDOS.has(estado)
          ? "border-transparent bg-acento text-acento-contraste"
          : estado === "descartado"
            ? "border-blackberry/40 text-blackberry dark-tema:border-gold/40 dark-tema:text-acento"
            : "border-borde text-suave",
      ].join(" ")}
    >
      {NOMBRES_DE_ESTADO_BRIEF[estado]}
    </span>
  );
}

/** El contenido congelado, paso a paso, con el texto exacto de cada pregunta. */
export function ContenidoBrief({ contenido }: { contenido: RespuestaCongelada[] }) {
  const pasos: { titulo: string; respuestas: RespuestaCongelada[] }[] = [];

  for (const respuesta of contenido) {
    const ultimo = pasos.at(-1);
    if (ultimo && ultimo.titulo === respuesta.paso) ultimo.respuestas.push(respuesta);
    else pasos.push({ titulo: respuesta.paso, respuestas: [respuesta] });
  }

  return (
    <div className="flex flex-col gap-6">
      {pasos.map((paso) => (
        <section key={paso.titulo} aria-label={paso.titulo}>
          <h3 className="mb-2 text-[12px] font-bold uppercase tracking-[0.08em] text-suave">{paso.titulo}</h3>
          <dl className="flex flex-col">
            {paso.respuestas.map((respuesta) => {
              const sinRespuesta = respuesta.valor === null;
              return (
                <div key={respuesta.clave} className="border-b border-borde/70 py-2.5 last:border-0">
                  <dt className="text-[12.5px] font-semibold">
                    {respuesta.numero !== null && <span className="text-suave">{respuesta.numero}. </span>}
                    {respuesta.pregunta}
                  </dt>
                  <dd
                    className={`mt-1 whitespace-pre-line text-[13.5px] leading-relaxed ${sinRespuesta ? "text-suave" : ""}`}
                  >
                    {respuesta.textoMostrado}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}
