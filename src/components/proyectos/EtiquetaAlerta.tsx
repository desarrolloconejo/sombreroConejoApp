import { NOMBRES_DE_ALERTA, type AlertaPieza } from "@/types";

/**
 * Una de las cuatro alertas del tablero, como pastilla.
 *
 * Cada una lleva su texto: el color ayuda a encontrarla de un vistazo, pero
 * nunca es la unica senal. Todos los tonos salen de la paleta de marca, y el
 * dorado solo aparece sobre navy.
 */

const TONOS: Record<AlertaPieza, string> = {
  atrasada: "bg-blackberry text-white border-transparent",
  por_vencer:
    "bg-blackberry/[0.07] text-blackberry border-blackberry/25 " +
    "dark-tema:bg-gold/10 dark-tema:text-gold dark-tema:border-gold/30",
  esperando_cliente: "bg-navy text-gold border-gold/40",
  en_correccion:
    "bg-violet/[0.08] text-violet border-violet/25 " +
    "dark-tema:bg-white/10 dark-tema:text-white dark-tema:border-white/20",
};

export function EtiquetaAlerta({
  alerta,
  cantidad,
}: {
  alerta: AlertaPieza;
  /** Cuantas piezas la tienen. Sin numero, se pinta solo el nombre. */
  cantidad?: number;
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
        "text-[11px] font-semibold whitespace-nowrap",
        TONOS[alerta],
      ].join(" ")}
    >
      {NOMBRES_DE_ALERTA[alerta]}
      {cantidad !== undefined && <span className="tabular-nums">· {cantidad}</span>}
    </span>
  );
}

/** El orden en que se muestran: de lo mas urgente a lo menos. */
export const ORDEN_DE_ALERTAS: readonly AlertaPieza[] = [
  "atrasada",
  "por_vencer",
  "esperando_cliente",
  "en_correccion",
];
