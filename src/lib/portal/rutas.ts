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
