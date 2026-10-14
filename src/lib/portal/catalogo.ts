import type {
  DatosNuevaTarea,
  FaseDeTrabajo,
  NumeroFase,
  TipoCorreccion,
  TipoPieza,
  TipoProyecto,
} from "@/types";

/**
 * Criterio de la agencia sobre como se trabaja un proyecto.
 *
 * Va en codigo y no en la base, igual que el catalogo de hooks: la aplicacion
 * depende de que sean exactamente estos valores, y cambiarlos es una decision
 * que se revisa, no un dato que se edita. Las reglas estan explicadas en
 * docs/reglasBateria.md.
 */

export const FASES: readonly NumeroFase[] = [1, 2, 3, 4, 5];

/** Las fases que llevan tareas. Las demas son controles. */
export const FASES_DE_TRABAJO: readonly FaseDeTrabajo[] = [1, 3];

/** Como se llama cada fase, completa y abreviada para la matriz. */
type NombreDeFase = { nombre: string; corto: string };

export const PLANTILLAS: Record<TipoProyecto, Record<NumeroFase, NombreDeFase>> = {
  redes_sociales: {
    1: { nombre: "Redaccion de contenido", corto: "Redaccion" },
    2: { nombre: "Revision interna", corto: "Rev. interna" },
    3: { nombre: "Diseno, edicion y produccion", corto: "Diseno y edicion" },
    4: { nombre: "Aprobacion interna y envio al cliente", corto: "Aprob. interna" },
    5: { nombre: "Revision del cliente y aprobacion para publicar", corto: "Cliente" },
  },
  especial: {
    1: { nombre: "Validacion del brief", corto: "Validacion" },
    2: { nombre: "Revision interna y asignacion", corto: "Rev. interna" },
    3: { nombre: "Produccion", corto: "Produccion" },
    4: { nombre: "Aprobacion interna y envio al cliente", corto: "Aprob. interna" },
    5: { nombre: "Revision del cliente y aprobacion", corto: "Cliente" },
  },
};

/** Que reabre cada correccion, y a que fase vuelve la pieza. */
export type RutaDeCorreccion = {
  regresaA: NumeroFase;
  reabre: readonly NumeroFase[];
};

/**
 * Las rutas de la fase 5.
 *
 * La de solo diseno (supuesto S-02) y la de los proyectos especiales (S-01)
 * no estan confirmadas por el negocio: si cambian, cambia esto y nada mas.
 */
export const RUTAS_DE_CORRECCION: Record<
  TipoProyecto,
  Record<TipoCorreccion, RutaDeCorreccion>
> = {
  redes_sociales: {
    redaccion: { regresaA: 1, reabre: [1, 2, 4, 5] },
    diseno: { regresaA: 3, reabre: [3, 4, 5] },
    ambas: { regresaA: 1, reabre: [1, 2, 3, 4, 5] },
  },
  especial: {
    redaccion: { regresaA: 3, reabre: [3, 4, 5] },
    diseno: { regresaA: 3, reabre: [3, 4, 5] },
    ambas: { regresaA: 3, reabre: [3, 4, 5] },
  },
};

/** Lo que vende la agencia, y como nace cada proyecto. */
export type Servicio = {
  slug: string;
  titulo: string;
  descripcion: string;
  tipo: TipoProyecto;

  /** Los tipos de pieza que se ofrecen al armar el proyecto. */
  tiposDePieza: readonly TipoPieza[];

  /**
   * Si el proyecto es de una sola pieza, cual. Los especiales son una grilla
   * de una pieza: se crea sola y no se anaden mas.
   */
  piezaUnica: { tipo: TipoPieza; titulo: string } | null;

  /** Las tareas que se proponen para una pieza de este tipo. */
  tareasSugeridas: (tipo: TipoPieza) => DatosNuevaTarea[];
};

/** Atajo para no repetir la forma de una tarea sugerida. */
function tarea(
  fase: FaseDeTrabajo,
  titulo: string,
  herramienta: string | null = null,
): DatosNuevaTarea {
  return { fase, titulo, herramienta };
}

/**
 * Las tareas de una pieza de redes, segun su tipo.
 *
 * Es la propuesta P3 del plan: las corrige el negocio. Las piezas de video
 * corto llevan ademas el hook, que se escribe con su herramienta.
 */
function tareasDeRedes(tipo: TipoPieza): DatosNuevaTarea[] {
  const redaccion = [tarea(1, "Redactar el copy")];

  if (tipo === "reel" || tipo === "video" || tipo === "historia") {
    redaccion.push(tarea(1, "Escribir el hook", "hooks"));
  }

  const produccion: Record<TipoPieza, DatosNuevaTarea[]> = {
    post: [tarea(3, "Disenar la pieza")],
    carrusel: [tarea(3, "Disenar las laminas")],
    historia: [tarea(3, "Disenar la historia")],
    reel: [tarea(3, "Grabar el video"), tarea(3, "Editar el video")],
    video: [tarea(3, "Grabar el video"), tarea(3, "Editar el video")],
    logo: [tarea(3, "Disenar el logo")],
    entregable: [tarea(3, "Producir el entregable")],
    otro: [tarea(3, "Producir la pieza")],
  };

  return [...redaccion, ...produccion[tipo]];
}

/**
 * El catalogo. Arranca con los dos servicios definidos; la lista completa de
 * lo que vende la agencia esta pendiente del negocio.
 */
export const SERVICIOS: readonly Servicio[] = [
  {
    slug: "redes_sociales",
    titulo: "Redes sociales",
    descripcion: "Parrilla de contenido: varias piezas que se publican en el mes",
    tipo: "redes_sociales",
    tiposDePieza: ["post", "carrusel", "reel", "historia", "video", "otro"],
    piezaUnica: null,
    tareasSugeridas: tareasDeRedes,
  },
  {
    slug: "desarrollo_producto",
    titulo: "Desarrollo de producto",
    descripcion: "Un entregable a medida, que nace de un brief",
    tipo: "especial",
    tiposDePieza: ["entregable"],
    piezaUnica: { tipo: "entregable", titulo: "Entregable" },
    tareasSugeridas: () => [
      tarea(1, "Revisar el brief con el cliente"),
      tarea(1, "Definir alcance y fechas"),
      tarea(3, "Producir el entregable"),
    ],
  },
];

/** El servicio por su slug, o null si no esta en el catalogo. */
export function servicioPorSlug(slug: string): Servicio | null {
  return SERVICIOS.find((servicio) => servicio.slug === slug) ?? null;
}

/** El nombre de una fase en la plantilla de un tipo de proyecto. */
export function nombreDeFase(tipo: TipoProyecto, fase: NumeroFase): string {
  return PLANTILLAS[tipo][fase].nombre;
}
