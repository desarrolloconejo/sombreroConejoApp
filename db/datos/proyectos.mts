/**
 * Los proyectos de ejemplo de la semilla de desarrollo.
 *
 * El de redes reproduce el ejemplo A de docs/reglasBateria.md: diez piezas
 * que suman exactamente 60 %. Ademas deja una pieza de cada alerta, para que
 * el tablero arranque ensenando las cuatro.
 *
 * Solo para desarrollo: `sql:produccion` no lo incluye.
 */
import type { Client } from "pg";
import { SERVICIOS } from "../../src/lib/portal/catalogo.ts";

type PiezaEjemplo = {
  tipo: string;
  titulo: string;
  /** Cuantas fases lleva completadas. */
  completas: number;
  ronda?: number;
  /** Dias desde hoy hasta la fecha estimada de su fase en curso. */
  vence?: number;
};

const PARRILLA: PiezaEjemplo[] = [
  { tipo: "post", titulo: "Lanzamiento de la temporada", completas: 5 },
  { tipo: "historia", titulo: "Detras de camaras", completas: 5 },
  { tipo: "reel", titulo: "Receta en 30 segundos", completas: 4, vence: 3 },
  { tipo: "carrusel", titulo: "Cinco usos del producto", completas: 4, vence: 4 },
  { tipo: "post", titulo: "Testimonio de cliente", completas: 4, vence: 5 },
  { tipo: "reel", titulo: "Antes y despues", completas: 2, vence: 1 },
  { tipo: "historia", titulo: "Encuesta de sabores", completas: 2, ronda: 2, vence: 6 },
  { tipo: "carrusel", titulo: "Guia de conservacion", completas: 2, vence: 7 },
  { tipo: "post", titulo: "Promocion de fin de mes", completas: 1, vence: -2 },
  { tipo: "reel", titulo: "Tendencia de la semana", completas: 1, vence: 8 },
];

export const PROYECTO_REDES = "Parrilla de octubre";
export const PROYECTO_ESPECIAL = "Empaque de la linea premium";

/** Quien hace cada tarea en la semilla, por correo. */
export type Equipo = {
  ejecutivo: number;
  redes: number;
  diseno: number;
  produccion: number;
  admin: number;
};

/** El responsable de una tarea, segun de que trata. */
function responsableDe(titulo: string, fase: number, equipo: Equipo): number {
  if (fase === 1) return equipo.redes;
  if (/video/i.test(titulo)) return equipo.produccion;
  return equipo.diseno;
}

/** Crea una pieza con sus fases y sus tareas, como lo haria la aplicacion. */
async function crearPieza(
  cliente: Client,
  proyectoId: number,
  orden: number,
  pieza: PiezaEjemplo,
  servicio: (typeof SERVICIOS)[number],
  equipo: Equipo,
): Promise<void> {
  const { rows } = await cliente.query<{ id: number }>(
    `INSERT INTO portal.piezas (proyecto_id, orden, tipo, titulo, ronda, creado_por)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [proyectoId, orden, pieza.tipo, pieza.titulo, pieza.ronda ?? 1, equipo.ejecutivo],
  );
  const piezaId = rows[0].id;

  // Una fase completada cada tres dias hacia atras; la en curso vence cuando
  // diga la pieza; las pendientes, cuatro dias despues de la anterior.
  for (let fase = 1; fase <= 5; fase++) {
    const completada = fase <= pieza.completas;
    const enCurso = fase === pieza.completas + 1;
    const dias = completada
      ? -3 * (pieza.completas - fase + 1)
      : (pieza.vence ?? 3) + 4 * (fase - pieza.completas - 1);

    await cliente.query(
      `INSERT INTO portal.pieza_fases
         (pieza_id, fase, estado, fecha_estimada, completada_en, completada_por, ronda_completada)
       VALUES ($1, $2, $3, CURRENT_DATE + $4::int,
               CASE WHEN $5 THEN now() + make_interval(days => $4::int) END,
               CASE WHEN $5 THEN $6::int END,
               CASE WHEN $5 THEN $7::int END)`,
      [
        piezaId,
        fase,
        completada ? "completada" : enCurso ? "en_curso" : "pendiente",
        dias,
        completada,
        equipo.ejecutivo,
        pieza.ronda ?? 1,
      ],
    );
  }

  await cliente.query(
    `INSERT INTO portal.pieza_contenido (pieza_id, copy, actualizado_por)
     VALUES ($1, $2, $3)`,
    [
      piezaId,
      pieza.completas >= 1 ? `Copy de ejemplo para «${pieza.titulo}».` : "",
      equipo.redes,
    ],
  );

  const tareas = servicio.tareasSugeridas(pieza.tipo as never);

  for (const [indice, tarea] of tareas.entries()) {
    // Lista si su fase ya se completo. En la fase en curso, la primera tarea
    // ya esta hecha y las demas no: asi se ve una fase a medias.
    const lista =
      tarea.fase <= pieza.completas ||
      (tarea.fase === pieza.completas + 1 && indice === tareas.findIndex((t) => t.fase === tarea.fase));
    const responsable = responsableDe(tarea.titulo, tarea.fase, equipo);

    await cliente.query(
      `INSERT INTO portal.tareas
         (pieza_id, fase, orden, titulo, responsable_id, herramienta,
          fecha_estimada, estado, lista_en, lista_por, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE + $7::int, $8,
               CASE WHEN $9 THEN now() END,
               CASE WHEN $9 THEN $5::int END,
               $10)`,
      [
        piezaId,
        tarea.fase,
        indice + 1,
        tarea.titulo,
        responsable,
        tarea.herramienta ?? null,
        pieza.vence ?? 3,
        lista ? "lista" : "pendiente",
        lista,
        equipo.ejecutivo,
      ],
    );
  }
}

/**
 * Siembra los proyectos de ejemplo si no existen. Idempotente: si el proyecto
 * ya esta, no lo toca.
 */
export async function sembrarProyectos(
  cliente: Client,
  empresaId: number,
  equipo: Equipo,
): Promise<number> {
  const redes = SERVICIOS.find((servicio) => servicio.slug === "redes_sociales");
  const producto = SERVICIOS.find((servicio) => servicio.slug === "desarrollo_producto");

  if (!redes || !producto) throw new Error("Falta un servicio en el catalogo");

  let creados = 0;

  const proyectos = [
    { nombre: PROYECTO_REDES, servicio: redes, piezas: PARRILLA, cierre: 20 },
    {
      nombre: PROYECTO_ESPECIAL,
      servicio: producto,
      piezas: [{ tipo: "entregable", titulo: "Entregable", completas: 0, vence: 2 }],
      cierre: 45,
    },
  ];

  for (const proyecto of proyectos) {
    const existe = await cliente.query(
      "SELECT 1 FROM portal.proyectos WHERE empresa_id = $1 AND nombre = $2",
      [empresaId, proyecto.nombre],
    );

    if (existe.rowCount) continue;

    const { rows } = await cliente.query<{ id: number }>(
      `INSERT INTO portal.proyectos
         (empresa_id, ejecutivo_id, servicio, tipo, nombre, fecha_inicio,
          fecha_estimada_cierre, creado_por)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE - 20, CURRENT_DATE + $6::int, $2)
       RETURNING id`,
      [
        empresaId,
        equipo.ejecutivo,
        proyecto.servicio.slug,
        proyecto.servicio.tipo,
        proyecto.nombre,
        proyecto.cierre,
      ],
    );

    for (const [indice, pieza] of proyecto.piezas.entries()) {
      await crearPieza(cliente, rows[0].id, indice + 1, pieza, proyecto.servicio, equipo);
    }

    creados++;
  }

  return creados;
}
