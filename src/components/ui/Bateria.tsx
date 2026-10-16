import type { EstadoFase } from "@/types";

/**
 * La bateria: cinco segmentos dentro de un contorno con punta, como una pila.
 *
 * Es lo que el estudio le promete al cliente y lo que se mira en el tablero.
 * El color nunca va solo: lleva `role="img"` con el porcentaje dicho, y quien
 * la usa pone al lado el texto de la fase.
 *
 * Colores, siempre de la paleta de marca:
 *   completa      el acento (blackberry en claro, dorado en oscuro)
 *   en curso      el acento a media opacidad
 *   pendiente     el acento muy diluido
 *   turno del cliente  navy con borde dorado: el dorado solo va sobre azul
 */

export type SegmentoBateria = "completa" | "en_curso" | "pendiente" | "cliente";

const COLORES: Record<SegmentoBateria, string> = {
  completa: "bg-blackberry dark-tema:bg-gold",
  en_curso: "bg-blackberry/45 dark-tema:bg-gold/45",
  pendiente: "bg-blackberry/10 dark-tema:bg-white/10",
  cliente: "bg-navy ring-2 ring-inset ring-gold",
};

/** Los segmentos de una pieza, a partir del estado de sus cinco fases. */
export function segmentosDePieza(
  fases: readonly { fase: number; estado: EstadoFase }[],
): SegmentoBateria[] {
  return [1, 2, 3, 4, 5].map((numero) => {
    const estado = fases.find((fase) => fase.fase === numero)?.estado ?? "pendiente";

    if (estado === "completada") return "completa";
    if (estado === "en_curso") return numero === 5 ? "cliente" : "en_curso";
    return "pendiente";
  });
}

/**
 * Los segmentos de un proyecto, a partir de su porcentaje: tantos llenos como
 * quintos completos, y el siguiente en curso si queda algo a medias.
 */
export function segmentosDeProyecto(porcentaje: number): SegmentoBateria[] {
  const llenos = Math.floor(porcentaje / 20);
  const resto = porcentaje - llenos * 20 > 0;

  return [0, 1, 2, 3, 4].map((indice) => {
    if (indice < llenos) return "completa";
    if (indice === llenos && resto) return "en_curso";
    return "pendiente";
  });
}

const TAMANOS = {
  chico: { caja: "h-3.5 w-[92px] p-[2px] gap-[2px]", punta: "h-1.5 w-[3px]" },
  normal: { caja: "h-5 w-[132px] p-[3px] gap-[3px]", punta: "h-2.5 w-1" },
  grande: { caja: "h-7 w-[184px] p-1 gap-1", punta: "h-3.5 w-[5px]" },
  // Ocupa el ancho de quien la contiene: la tarjeta de un proyecto.
  ancho: { caja: "h-8 min-w-0 flex-1 p-1 gap-1", punta: "h-4 w-[5px]" },
} as const;

export function Bateria({
  segmentos,
  porcentaje,
  etiqueta = "Avance",
  tamano = "normal",
  className,
}: {
  segmentos: readonly SegmentoBateria[];
  porcentaje: number;
  /** De que es el avance, para el lector de pantalla. */
  etiqueta?: string;
  tamano?: keyof typeof TAMANOS;
  className?: string;
}) {
  const medida = TAMANOS[tamano];
  const redondeado = Math.round(porcentaje);

  return (
    <span
      role="img"
      aria-label={`${etiqueta}: ${redondeado} por ciento`}
      className={[
        tamano === "ancho" ? "flex w-full items-center" : "inline-flex shrink-0 items-center",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        className={[
          "grid grid-cols-5 rounded-[5px] border-2 border-blackberry dark-tema:border-gold",
          medida.caja,
        ].join(" ")}
      >
        {segmentos.map((segmento, indice) => (
          <span
            key={indice}
            className={["rounded-[2px] transition-colors duration-500", COLORES[segmento]].join(" ")}
          />
        ))}
      </span>
      <span
        aria-hidden="true"
        className={[
          "rounded-r-[2px] bg-blackberry dark-tema:bg-gold",
          medida.punta,
        ].join(" ")}
      />
    </span>
  );
}
