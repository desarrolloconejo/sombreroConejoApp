import type { FaseDeTrabajo } from "@/types";

/**
 * Registro de las herramientas: lo que la aplicacion ofrece para cumplir una
 * tarea. Va en codigo, igual que el registro de modulos.
 *
 * Una tarea puede llevar una herramienta. Quien la tiene asignada la abre
 * desde la propia tarea, aunque el modulo no le aparezca en el menu.
 */

export type Herramienta = {
  slug: string;
  titulo: string;
  /** Para que sirve, en una linea. */
  descripcion: string;
  /** En que fases tiene sentido usarla. */
  fases: readonly FaseDeTrabajo[];
  /** A donde lleva la tarea que la usa. */
  href: (tareaId: number) => string;
};

export const HERRAMIENTAS: readonly Herramienta[] = [
  {
    slug: "hooks",
    titulo: "Hooks",
    descripcion: "Escribir y auditar el hook de un video corto",
    fases: [1],
    href: (tareaId) => `/dashboard/hooks/nuevo?tarea=${tareaId}`,
  },
];

export function herramientaPorSlug(slug: string | null): Herramienta | null {
  if (!slug) return null;
  return HERRAMIENTAS.find((herramienta) => herramienta.slug === slug) ?? null;
}
