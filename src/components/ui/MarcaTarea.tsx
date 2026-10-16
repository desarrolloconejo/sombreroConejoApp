import { Check, Circle } from "lucide-react";

/**
 * El circulo para marcar una tarea como lista (o reabrirla). Lo comparten la
 * ficha de la pieza y Mi trabajo.
 *
 * Con `celebrar`, al quedar lista se celebra: el circulo rebota, suelta un
 * anillo y el check se dibuja (clases `logro-*` de globals.css). Quien lo usa
 * decide cuando: la tarea que se acaba de marcar, no todas las ya listas.
 */
export function MarcaTarea({
  lista,
  celebrar = false,
  etiqueta,
  deshabilitado,
}: {
  lista: boolean;
  celebrar?: boolean;
  /** Lo que dice para el lector: «Marcar como lista la tarea X». */
  etiqueta: string;
  deshabilitado?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={deshabilitado}
      aria-label={etiqueta}
      title={lista ? "Reabrir" : "Marcar como lista"}
      className={[
        "suave grid size-8 shrink-0 cursor-pointer place-items-center rounded-full border-2 [&>svg]:size-4",
        lista
          ? "border-blackberry bg-blackberry text-white dark-tema:border-gold dark-tema:bg-gold dark-tema:text-navy"
          : "border-borde text-transparent hover:border-acento hover:text-acento",
        "disabled:cursor-default",
        lista && celebrar ? "logro-marca" : "",
      ].join(" ")}
    >
      {lista ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}
    </button>
  );
}
