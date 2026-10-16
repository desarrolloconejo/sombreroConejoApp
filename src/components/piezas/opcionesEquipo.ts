import type { OpcionSelector } from "@/components/ui";
import type { PersonaDeEquipo } from "@/types";

/** Las opciones para elegir quien hace algo: primero nadie, luego el equipo. */
export function opcionesDeEquipo(equipo: PersonaDeEquipo[]): OpcionSelector[] {
  return [
    { valor: "", texto: "Sin asignar" },
    ...equipo.map((persona) => ({
      valor: String(persona.id),
      texto: persona.nombre,
      detalle: persona.cargo ?? undefined,
    })),
  ];
}
