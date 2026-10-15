/**
 * Las rutas del modulo de proyectos, en un solo sitio. Las usan los enlaces,
 * las notificaciones y las revalidaciones de las actions: si una cambia, cambia
 * aqui.
 */

export const RUTA_PROYECTOS = "/dashboard/proyectos";

export function rutaProyecto(proyectoId: number): string {
  return `${RUTA_PROYECTOS}/${proyectoId}`;
}

export function rutaPieza(proyectoId: number, piezaId: number): string {
  return `${rutaProyecto(proyectoId)}/piezas/${piezaId}`;
}

/** Lo que ve el cliente: sus proyectos y la revision de cada pieza. */
export const RUTA_MIS_PROYECTOS = "/dashboard/mis-proyectos";

export function rutaMiProyecto(proyectoId: number): string {
  return `${RUTA_MIS_PROYECTOS}/${proyectoId}`;
}

export function rutaMiPieza(proyectoId: number, piezaId: number): string {
  return `${rutaMiProyecto(proyectoId)}/piezas/${piezaId}`;
}

/** La bandeja de briefs del equipo, y lo que pide el cliente. */
export const RUTA_BRIEFS = "/dashboard/briefs";
export const RUTA_MIS_BRIEFS = "/dashboard/mis-briefs";

export function rutaBrief(id: number): string {
  return `${RUTA_BRIEFS}/${id}`;
}

export function rutaMiBrief(id: number): string {
  return `${RUTA_MIS_BRIEFS}/${id}`;
}

/** La unica ruta publica del portal: el brief de un prospecto. */
export function rutaBriefPorEnlace(token: string): string {
  return `/brief/${token}`;
}
