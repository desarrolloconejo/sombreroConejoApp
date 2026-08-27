import type {
  Mecanismo,
  Objetivo,
  SlugMecanismo,
  SlugObjetivo,
  SlugPlataforma,
  SlugTerritorio,
  Territorio,
} from "@/types";

/**
 * El catalogo del modulo: territorios, mecanismos, objetivos y plataformas.
 *
 * NO son tablas, y la razon no es la comodidad. La tabla de abajo —que
 * territorio pide cada objetivo, con que evidencia y contra que metrica se
 * lee— es LOGICA de la agencia, no datos de una cuenta: cambia cuando cambia
 * el criterio, no cuando alguien registra algo. Ponerla en la base obligaria
 * a un JOIN para pintar un desplegable y no dejaria escribir el tipo.
 *
 * Las 42 aperturas si viven en la base, y es la excepcion que confirma la
 * regla: esas SI se gestionan desde la aplicacion.
 */

/* ===========================================================================
   TERRITORIOS — la intencion del hook
   =========================================================================== */

export const TERRITORIOS: readonly Territorio[] = [
  { slug: "a", letra: "A", nombre: "Curiosidad util" },
  { slug: "b", letra: "B", nombre: "Demostracion" },
  { slug: "c", letra: "C", nombre: "Historia y oficio" },
  { slug: "d", letra: "D", nombre: "Identidad" },
  { slug: "e", letra: "E", nombre: "Guia guardable" },
  { slug: "f", letra: "F", nombre: "Objeciones" },
  { slug: "g", letra: "G", nombre: "Contradiccion" },
];

/** "A · Curiosidad util", para pintarlo de un tiron. */
export function nombreTerritorio(slug: SlugTerritorio): string {
  const territorio = TERRITORIOS.find((t) => t.slug === slug);
  return territorio ? `${territorio.letra} · ${territorio.nombre}` : slug;
}

/* ===========================================================================
   MECANISMOS — como se demuestra
   =========================================================================== */

export const MECANISMOS: readonly Mecanismo[] = [
  { slug: "comparacion", nombre: "Comparacion" },
  { slug: "numero", nombre: "Numero" },
  { slug: "pregunta", nombre: "Pregunta" },
  { slug: "dato", nombre: "Dato" },
  { slug: "prueba_visual", nombre: "Prueba visual" },
  { slug: "antes_despues", nombre: "Antes / despues" },
  { slug: "coste", nombre: "Coste" },
  { slug: "persona", nombre: "Persona" },
];

export function nombreMecanismo(slug: SlugMecanismo): string {
  return MECANISMOS.find((m) => m.slug === slug)?.nombre ?? slug;
}

/* ===========================================================================
   OBJETIVOS

   Un objetivo no es una etiqueta: arrastra el territorio con el que se
   escribe, la evidencia que hace falta y la metrica contra la que se juzga la
   pieza. Elegir mal el objetivo hace que se lea con el numero equivocado.
   =========================================================================== */

export const OBJETIVOS: readonly Objetivo[] = [
  {
    slug: "alcance",
    nombre: "Alcance",
    territorios: ["a", "g"],
    metrica: "Retencion a 3 s",
    evidencia: "Comparacion, detalle inesperado, dato propio.",
    nota: "Sin conflicto ni hueco de informacion no hay motivo para parar.",
  },
  {
    slug: "guardados",
    nombre: "Guardados",
    territorios: ["e", "b"],
    metrica: "Guardados por alcance",
    evidencia: "Checklist, proceso claro, demostracion por etapas.",
    nota: "El Insert-Titulo debe funcionar si alguien pausa.",
  },
  {
    slug: "compartidos",
    nombre: "Compartidos",
    territorios: ["d", "g"],
    metrica: "Compartidos por alcance",
    evidencia: "Situacion reconocible, tesis defendible o contraste compartible.",
    nota: "La audiencia comparte lo que le ayuda a nombrar algo o a abrir conversacion.",
  },
  {
    slug: "comunidad",
    nombre: "Comunidad",
    territorios: ["d", "c"],
    metrica: "Comentarios por alcance",
    evidencia: "Voz humana, situacion reconocible, comentario real.",
    nota: "Cuanto mas estrecha la identidad, mas fuerte el efecto.",
  },
  {
    slug: "consideracion",
    nombre: "Consideracion",
    territorios: ["f", "b"],
    metrica: "Clics por alcance",
    evidencia: "Producto en contexto, antes y despues, explicacion honesta.",
    nota: "Decir para quien no es tambien convierte.",
  },
  {
    slug: "accion",
    nombre: "Accion",
    territorios: ["f", "b"],
    metrica: "Coste por resultado",
    evidencia: "Uso real, beneficio explicado y CTA.",
    nota: "Todo claim pasa por validacion antes de publicar.",
  },
];

/**
 * El objetivo, o Guardados si no se reconoce.
 *
 * La caida por defecto es la del documento y no es arbitraria: Guardados es
 * el objetivo mas neutro de los seis, el unico que no empuja a exagerar ni a
 * pedir un clic.
 */
export function objetivoDe(slug: string | null | undefined): Objetivo {
  return (
    OBJETIVOS.find((o) => o.slug === slug) ??
    OBJETIVOS.find((o) => o.slug === "guardados")!
  );
}

/** La metrica contra la que se lee una pieza con ese objetivo. */
export function metricaDe(slug: string | null | undefined): string {
  return objetivoDe(slug).metrica;
}

export const SLUGS_OBJETIVO: readonly SlugObjetivo[] = OBJETIVOS.map(
  (o) => o.slug,
);

/* ===========================================================================
   PLATAFORMAS

   El ajuste de cada una no es cosmetico: cambia donde cae el peso de la
   apertura, y eso decide como se escribe el Insert-Titulo.
   =========================================================================== */

export const PLATAFORMAS: readonly {
  slug: SlugPlataforma;
  nombre: string;
  ajuste: string;
}[] = [
  {
    slug: "reels",
    nombre: "Instagram Reels",
    ajuste:
      "El Insert-Titulo y el primer fotograma cargan con el peso: buena parte del consumo es en silencio. Para descubrimiento, 3 minutos es el techo real.",
  },
  {
    slug: "tiktok",
    nombre: "TikTok",
    ajuste:
      "El sonido suele estar activado: un efecto o una entonacion rota sirven de interruptor de patron. Respeta los margenes de seguridad.",
  },
  {
    slug: "shorts",
    nombre: "YouTube Shorts",
    ajuste:
      "La decision es aun mas rapida y refleja. Optimiza el fotograma uno, no los tres segundos.",
  },
  {
    slug: "anuncio",
    nombre: "Anuncio vertical",
    ajuste:
      "Se juzga con hook rate a los 2 o 3 segundos segun plataforma. El ciclo de refresco es de una a dos semanas.",
  },
];

export function nombrePlataforma(slug: string | null | undefined): string {
  return PLATAFORMAS.find((p) => p.slug === slug)?.nombre ?? "Sin plataforma";
}

export const SLUGS_PLATAFORMA: readonly SlugPlataforma[] = PLATAFORMAS.map(
  (p) => p.slug,
);

/* ===========================================================================
   LOS TRES HITOS DEL RECORRIDO

   De aqui sale el porcentaje que muestra la raiz. Son tres y no seis porque
   solo tres pasos dejan rastro en una ficha: escribirla, auditarla y medirla.
   =========================================================================== */

export const HITOS = [
  { estado: "borrador", nombre: "Escrita", porcentaje: 33 },
  { estado: "auditada", nombre: "Auditada", porcentaje: 66 },
  { estado: "medida", nombre: "Medida", porcentaje: 100 },
] as const;

export function porcentajeDe(estado: string): number {
  return HITOS.find((h) => h.estado === estado)?.porcentaje ?? 0;
}
