import { createElement, type ReactNode } from "react";
import {
  BookOpen,
  Building2,
  ChartNoAxesColumn,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  History,
  House,
  Layers,
  ListChecks,
  LayoutDashboard,
  Library,
  ReceiptText,
  ScrollText,
  Send,
  ShieldCheck,
  User,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { NombreRol, Sesion, SlugCargo, UsuarioCompleto } from "@/types";

/**
 * Registro unico de los modulos de la aplicacion.
 *
 * De aqui comen el sidebar, el cajon movil y el buscador global. Anadir un
 * modulo en el futuro es UNA entrada en `MODULOS`, con su `seccion`: si el registro estuviera
 * repartido entre la navegacion y el buscador, tarde o temprano uno de los dos
 * se quedaria atras.
 *
 * El registro no se exporta a proposito. Todo el mundo pasa por `modulosDe`,
 * que ya aplica el filtro de rol y de cargo, para que nadie pueda pintar por
 * descuido un modulo al que quien mira no tiene acceso.
 */

/**
 * Las secciones del menu, en el orden en que se pintan.
 *
 * El menu va a crecer mucho con el portal: un administrador pasara de seis
 * entradas a mas de veinte. Agruparlas es lo que hace que se siga pudiendo
 * leer, y por eso cada modulo declara a cual pertenece.
 *
 * «Herramientas» es un rotulo, no un desplegable: como desplegable, Hooks
 * quedaria a tres niveles y la navegacion solo admite uno.
 */
export const SECCIONES = [
  { clave: "general", titulo: "General" },
  { clave: "trabajo", titulo: "Trabajo" },
  { clave: "herramientas", titulo: "Herramientas" },
  { clave: "finanzas", titulo: "Finanzas" },
  { clave: "sistema", titulo: "Sistema" },
  { clave: "mi_espacio", titulo: "Mi espacio" },
] as const;

export type SeccionMenu = (typeof SECCIONES)[number]["clave"];

export type Modulo = {
  /** El nombre que se ve en la navegacion. */
  titulo: string;

  /**
   * A que seccion del menu pertenece.
   *
   * Sin seccion, el modulo va al final y sin rotulo. Hoy solo es Mi perfil,
   * que no es un modulo de trabajo sino la cuenta de quien mira.
   */
  seccion?: SeccionMenu;

  /** Una linea de que hace el modulo. Se ve en el buscador y en el movil. */
  subtitulo: string;

  href: string;
  icono: LucideIcon;

  /**
   * Como lo llamaria alguien que no recuerda el nombre exacto del modulo.
   * Solo alimenta al buscador; no se muestra en ningun sitio.
   */
  alias?: string[];

  /** Roles que pueden verlo. Omitido = visible para todos. */
  roles?: NombreRol[];

  /** Cargos que pueden verlo. Omitido = sin restriccion de area. */
  cargos?: SlugCargo[];

  /**
   * Un permiso que ademas tiene que tener la persona. Hoy solo uno: el del
   * cliente que ve las finanzas de su empresa, que no sale del rol sino de
   * una casilla por persona.
   */
  permiso?: "finanzas";

  /**
   * Submodulos que cuelgan de este.
   *
   * El padre tiene href propio y no es un contenedor vacio: `activoEntre`
   * exige href en todo nodo, y un desplegable que no lleva a ningun sitio
   * obliga a un clic de mas para llegar a cualquier parte.
   *
   * El filtro de rol y cargo del padre se aplica ANTES que el del hijo: un
   * hijo no puede ser mas visible que su padre.
   */
  hijos?: Modulo[];
};

/**
 * Un modulo tal como cruza la frontera servidor -> cliente.
 *
 * El icono deja de ser el componente para pasar a ser el SVG ya construido:
 * React no sabe serializar una referencia a un componente dentro de las props
 * de un componente de cliente, pero un elemento ya renderizado si viaja. Asi
 * el layout puede seguir inyectando los modulos como props, que es el contrato
 * del proyecto, sin duplicar el registro dentro del cliente.
 *
 * El SVG viaja sin tamano: cada sitio donde se pinta lo fija por CSS.
 *
 * OJO con los hijos: un `Omit<Modulo, "icono">` a secas los arrastraria tal
 * cual, con su LucideIcon dentro, y reventaria al cruzar al cliente aunque el
 * icono del padre estuviera bien convertido. Por eso se omiten tambien y se
 * declaran ya convertidos.
 */
export type ModuloVista = Omit<Modulo, "icono" | "hijos"> & {
  icono: ReactNode;
  hijos?: ModuloVista[];
};

/** Lo minimo que la navegacion necesita saber de quien tiene la sesion. */
export type UsuarioNav = {
  nombre: string;
  apellido: string;
  rol: NombreRol;
  fotoUrl: string | null;
};

/**
 * Quien mira la navegacion.
 *
 * Acepta tanto la sesion del token como el usuario leido de la base, porque
 * cada capa tiene a mano uno u otro: el proxy y las actions manejan la sesion,
 * las pages manejan el usuario fresco. Lo unico que cambia es donde vive el
 * cargo, y de eso ya se encarga `cargoDe`.
 */
export type ActorNavegacion =
  | Pick<Sesion, "rol" | "cargo">
  | (Pick<UsuarioCompleto, "rol" | "cargoSlug"> & Partial<Pick<UsuarioCompleto, "puedeVerFinanzas">>);

const MODULOS: readonly Modulo[] = [
  {
    titulo: "Inicio",
    seccion: "general",
    subtitulo: "Tu espacio de trabajo",
    href: "/dashboard",
    icono: House,
    alias: ["panel", "home", "principal"],
  },
  /*
   * El tablero es lo primero que abre un ejecutivo al empezar el dia: va
   * delante de Proyectos.
   */
  {
    titulo: "Tablero",
    seccion: "trabajo",
    subtitulo: "Lo que esta en curso y sus alertas",
    href: "/dashboard/tablero",
    icono: LayoutDashboard,
    roles: ["admin", "trabajador"],
    cargos: ["cuentas"],
    alias: ["control", "alertas", "atrasados", "resumen", "panel de control"],
  },

  /*
   * Proyectos lo ven el admin y los ejecutivos de cuentas: son quienes los
   * gestionan. Quien solo hace tareas llega a sus piezas desde Mi trabajo, no
   * desde aqui.
   */
  {
    titulo: "Proyectos",
    seccion: "trabajo",
    subtitulo: "Piezas, fases y tareas de cada cliente",
    href: "/dashboard/proyectos",
    icono: FolderKanban,
    roles: ["admin", "trabajador"],
    cargos: ["cuentas"],
    alias: ["bateria", "piezas", "fases", "parrilla", "matriz", "entregables", "clientes"],
  },

  /*
   * Mi trabajo es de todo el equipo menos administracion, que solo ve
   * finanzas: cualquiera puede tener una tarea asignada.
   */
  {
    titulo: "Mi trabajo",
    seccion: "trabajo",
    subtitulo: "Las tareas que tengo asignadas",
    href: "/dashboard/mi-trabajo",
    icono: ListChecks,
    roles: ["admin", "trabajador"],
    cargos: ["direccion", "cuentas", "redes", "diseno", "produccion", "tecnologia"],
    alias: ["tareas", "pendientes", "asignado", "lo mio", "por hacer"],
  },

  /*
   * Hooks. Los submodulos son PASOS hacia un final, y el final es registrar
   * las metricas de la pieza, no auditarla: de ahi el orden.
   *
   * El cargo va declarado solo en el padre. Los hijos lo heredan porque
   * `puedeVer` filtra al padre primero y poda la rama entera, asi que
   * repetirlo en cada hijo seria ruido que ademas se puede desincronizar.
   */
  {
    titulo: "Hooks",
    seccion: "herramientas",
    subtitulo: "Crear y auditar hooks de video corto",
    href: "/dashboard/hooks",
    icono: Zap,
    cargos: ["redes"],
    alias: [
      "ganchos",
      "guiones",
      "video",
      "reels",
      "tiktok",
      "contenido",
      "creadoras",
    ],
    hijos: [
      {
        titulo: "Manual",
        subtitulo: "El criterio de la casa",
        href: "/dashboard/hooks/manual",
        icono: BookOpen,
        alias: ["fundamento", "criterio", "teoria", "principios", "fuentes"],
      },
      {
        titulo: "Documentacion",
        subtitulo: "Reglas, aperturas y referencias",
        href: "/dashboard/hooks/documentacion",
        icono: Library,
        alias: [
          "reglas",
          "aperturas",
          "referencias",
          "plantillas",
          "territorios",
          "banco",
        ],
      },
      {
        titulo: "Hooks",
        subtitulo: "Escribir la decision de una pieza",
        href: "/dashboard/hooks/nuevo",
        icono: FileText,
        alias: ["canvas", "escribir", "ficha", "crear", "redactar"],
      },
      {
        titulo: "Auditor",
        subtitulo: "Nueve controles antes de grabar",
        href: "/dashboard/hooks/auditor",
        icono: ShieldCheck,
        alias: ["auditoria", "nota", "control", "revisar", "cementerio"],
      },
      {
        titulo: "Metricas",
        subtitulo: "Registrar lo que paso al publicar",
        href: "/dashboard/hooks/metricas",
        icono: ChartNoAxesColumn,
        alias: ["resultados", "numeros", "hook rate", "retencion", "medir"],
      },
      {
        titulo: "Historial",
        subtitulo: "Todas las fichas y su estado",
        href: "/dashboard/hooks/historial",
        icono: History,
        alias: ["fichas", "piezas", "archivo", "borradores"],
      },
    ],
  },

  /*
   * Finanzas: lo opera el administrador y el cargo de administracion. Nadie
   * mas del equipo lo ve (seccion 7.2 del plan).
   */
  {
    titulo: "Presupuestos",
    seccion: "finanzas",
    subtitulo: "Lo que se ofrece a cada cliente",
    href: "/dashboard/presupuestos",
    icono: FileSpreadsheet,
    roles: ["admin", "trabajador"],
    cargos: ["administracion"],
    alias: ["cotizacion", "cotizaciones", "oferta", "precios", "aprobar", "finanzas"],
  },
  {
    titulo: "Proformas",
    seccion: "finanzas",
    subtitulo: "De lo aprobado, lo que se va a facturar",
    href: "/dashboard/proformas",
    icono: ReceiptText,
    roles: ["admin", "trabajador"],
    cargos: ["administracion"],
    alias: ["prefactura", "recurrente", "mensual", "contrato", "finanzas", "cobro"],
  },

  {
    titulo: "Usuarios",
    seccion: "sistema",
    subtitulo: "Alta de trabajadores y clientes",
    href: "/dashboard/usuarios",
    icono: Users,
    roles: ["admin"],
    alias: [
      "personal",
      "empleados",
      "trabajadores",
      "clientes",
      "cuentas",
      "permisos",
      "alta",
    ],
  },
  /*
   * Empresas va JUNTO a Usuarios, y en ese orden.
   *
   * Son los dos lados de lo mismo: aqui estan las cuentas que atiende la
   * agencia, y en Usuarios las personas que las representan. Y el orden no es
   * casual: una persona de contacto solo se puede dar de alta si su empresa ya
   * existe, asi que el modulo que va primero es el que se usa primero.
   */
  {
    titulo: "Empresas",
    seccion: "sistema",
    subtitulo: "Los clientes que atiende la agencia",
    href: "/dashboard/empresas",
    icono: Building2,
    roles: ["admin"],
    alias: [
      "clientes",
      "cuentas",
      "marcas",
      "cartera",
      "empresa",
      "companias",
      "rif",
    ],
  },

  {
    titulo: "Auditoria",
    seccion: "sistema",
    subtitulo: "Quien hizo que, y cuando",
    href: "/dashboard/auditoria",
    icono: ScrollText,
    roles: ["admin"],
    alias: [
      "registro",
      "bitacora",
      "historial",
      "actividad",
      "accesos",
      "cambios",
      "log",
    ],
  },

  {
    titulo: "Bandeja de salida",
    seccion: "sistema",
    subtitulo: "Los correos que envia la aplicacion",
    href: "/dashboard/salida",
    icono: Send,
    roles: ["admin"],
    alias: ["correos", "correo", "email", "mensajes", "enviados", "salida", "avisos"],
  },

  /*
   * Mi espacio: lo que ve el cliente de su empresa. Solo clientes; el equipo
   * ve lo mismo, y mas, desde Proyectos.
   */
  {
    titulo: "Mis proyectos",
    seccion: "mi_espacio",
    subtitulo: "Avance, y aprobar o pedir correcciones",
    href: "/dashboard/mis-proyectos",
    icono: Layers,
    roles: ["cliente"],
    alias: ["proyectos", "revision", "aprobar", "piezas", "avance", "correccion"],
  },

  {
    titulo: "Administracion",
    seccion: "mi_espacio",
    subtitulo: "Presupuestos para aprobar y proformas",
    href: "/dashboard/administracion",
    icono: Wallet,
    roles: ["cliente"],
    permiso: "finanzas",
    alias: ["finanzas", "presupuestos", "proformas", "aprobar", "pagos", "cuentas"],
  },

  // Va siempre el ultimo: no es un modulo de trabajo, es la cuenta de quien
  // mira, y colocarlo en medio partia la lista de modulos en dos.
  {
    titulo: "Mi perfil",
    subtitulo: "Datos, contrasena y tema",
    href: "/dashboard/perfil",
    icono: User,
    alias: ["cuenta", "datos", "contrasena", "clave", "tema"],
  },
];

/** Lo que se puede buscar de un modulo, venga como registro o como vista. */
type Buscable = {
  titulo: string;
  subtitulo: string;
  alias?: string[];
};

/**
 * Deja el texto comparable: sin mayusculas y sin tildes.
 *
 * NFD separa cada letra de su acento, y el rango U+0300 a U+036F son justo
 * acentos ya sueltos. Quitarlos hace que "gestion" con tilde y sin ella sean
 * la misma cadena, que es como la gente escribe de verdad en un buscador.
 */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** El cargo de quien mira, venga del token o de la base. */
function cargoDe(quien: ActorNavegacion): SlugCargo | null {
  return "cargoSlug" in quien ? quien.cargoSlug : quien.cargo;
}

/**
 * Si este modulo es visible para quien mira.
 *
 * El admin se salta el filtro de cargo, igual que en `requerirCargo`: su rol
 * le da acceso a todas las areas de la agencia.
 */
function puedeVer(modulo: Modulo, quien: ActorNavegacion): boolean {
  if (modulo.roles && !modulo.roles.includes(quien.rol)) return false;

  // Un permiso por persona solo se conoce con el usuario de la base: con el
  // token no se sabe, y el modulo no se muestra.
  if (modulo.permiso === "finanzas" && !("puedeVerFinanzas" in quien && quien.puedeVerFinanzas)) {
    return false;
  }

  if (modulo.cargos && quien.rol !== "admin") {
    const cargo = cargoDe(quien);
    if (!cargo || !modulo.cargos.includes(cargo)) return false;
  }

  return true;
}

/**
 * Los modulos a los que esta persona tiene acceso, en orden de menu.
 *
 * Filtra tambien los hijos, y PODA el padre que se queda sin ninguno: un
 * desplegable vacio es una promesa que no lleva a ningun sitio. Un padre sin
 * hijos declarados no se poda: no es un contenedor, es un modulo normal.
 */
export function modulosDe(quien: ActorNavegacion): Modulo[] {
  const visibles: Modulo[] = [];

  for (const modulo of MODULOS) {
    if (!puedeVer(modulo, quien)) continue;

    if (!modulo.hijos) {
      visibles.push(modulo);
      continue;
    }

    const hijos = modulo.hijos.filter((hijo) => puedeVer(hijo, quien));
    if (hijos.length > 0) visibles.push({ ...modulo, hijos });
  }

  return visibles;
}

/** Un tramo del menu: su rotulo y los modulos que caen en el. */
export type GrupoDeMenu<T> = {
  /** Estable, para usarlo como `key`. */
  clave: string;

  /** Nulo para los modulos sin seccion, que se pintan sin rotulo. */
  titulo: string | null;
  modulos: T[];
};

/**
 * Reparte los modulos en las secciones del menu, en su orden.
 *
 * Una seccion sin modulos visibles NO aparece: un rotulo sin nada debajo le
 * dice a quien mira que hay algo que no le dejan ver. Dentro de cada seccion
 * se respeta el orden del registro.
 *
 * Es generica por lo mismo que `filtrarPorTermino`: la usan el sidebar y el
 * menu movil sobre `ModuloVista`.
 */
export function porSecciones<T extends { seccion?: SeccionMenu }>(
  modulos: readonly T[],
): GrupoDeMenu<T>[] {
  const grupos: GrupoDeMenu<T>[] = [];

  for (const seccion of SECCIONES) {
    const suyos = modulos.filter((modulo) => modulo.seccion === seccion.clave);

    if (suyos.length > 0) {
      grupos.push({ clave: seccion.clave, titulo: seccion.titulo, modulos: suyos });
    }
  }

  const sueltos = modulos.filter((modulo) => modulo.seccion === undefined);

  if (sueltos.length > 0) {
    grupos.push({ clave: "sin_seccion", titulo: null, modulos: sueltos });
  }

  return grupos;
}

/**
 * Padres e hijos en una sola lista.
 *
 * La necesitan `activoEntre` y el buscador global. Sin ella el submodulo
 * activo no se enciende nunca (la lista jerarquica solo tiene padres en el
 * primer nivel) y los submodulos no aparecen con Ctrl+K, que es donde mucha
 * gente busca a donde ir.
 */
export function aplanar<T extends { hijos?: T[] }>(modulos: readonly T[]): T[] {
  const planos: T[] = [];

  for (const modulo of modulos) {
    planos.push(modulo);
    if (modulo.hijos) planos.push(...aplanar(modulo.hijos));
  }

  return planos;
}

/**
 * Prepara los modulos para viajar al cliente.
 * Lo llama el layout, justo antes de inyectarlos como props.
 */
export function vistaDeModulos(modulos: Modulo[]): ModuloVista[] {
  return modulos.map(({ icono: Icono, hijos, ...resto }) => ({
    ...resto,
    icono: createElement(Icono, { "aria-hidden": true }),
    // Recursiva a proposito: sin esto los iconos de los submodulos
    // cruzarian al cliente como referencia a componente y petarian.
    ...(hijos ? { hijos: vistaDeModulos(hijos) } : {}),
  }));
}

/** Donde coincidio el termino: cuanto mas bajo, mas arriba sale. */
function pesoDe(modulo: Buscable, buscado: string): number | null {
  if (normalizar(modulo.titulo).includes(buscado)) return 0;

  const enAlias = (modulo.alias ?? []).some((alias) =>
    normalizar(alias).includes(buscado),
  );
  if (enAlias) return 1;

  if (normalizar(modulo.subtitulo).includes(buscado)) return 2;

  return null;
}

/**
 * Filtra una lista ya accesible por el termino escrito.
 *
 * Es generica porque la usan los dos lados: el servidor sobre `Modulo` y el
 * buscador del cliente sobre `ModuloVista`, que es el mismo dato con el icono
 * ya renderizado.
 *
 * Las coincidencias en el titulo van primero: quien escribe "usu" busca el
 * modulo Usuarios, no el que lo menciona de pasada en su descripcion.
 */
export function filtrarPorTermino<T extends Buscable>(
  modulos: T[],
  termino: string,
): T[] {
  const buscado = normalizar(termino);

  if (!buscado) return modulos;

  const puntuados: { modulo: T; peso: number }[] = [];

  for (const modulo of modulos) {
    const peso = pesoDe(modulo, buscado);
    if (peso !== null) puntuados.push({ modulo, peso });
  }

  // sort es estable, asi que dentro del mismo peso se respeta el orden del menu
  return puntuados.sort((a, b) => a.peso - b.peso).map(({ modulo }) => modulo);
}

/** La ruta sin barra final, para que "/dashboard/" y "/dashboard" sean iguales. */
function limpiarRuta(ruta: string): string {
  return ruta.length > 1 ? ruta.replace(/\/+$/, "") : ruta;
}

/**
 * El modulo de una lista que corresponde a la ruta actual.
 *
 * Gana la coincidencia mas larga: /dashboard/usuarios cuelga de /dashboard,
 * asi que sin esa preferencia se encenderia Inicio en todas las paginas.
 */
export function activoEntre<T extends { href: string }>(
  modulos: readonly T[],
  ruta: string,
): T | null {
  const actual = limpiarRuta(ruta);
  let mejor: T | null = null;

  for (const modulo of modulos) {
    const href = limpiarRuta(modulo.href);
    const coincide = actual === href || actual.startsWith(`${href}/`);

    if (!coincide) continue;
    if (!mejor || href.length > limpiarRuta(mejor.href).length) mejor = modulo;
  }

  return mejor;
}

/** El modulo al que pertenece una ruta, mire quien mire. */
export function moduloActivo(ruta: string): Modulo | null {
  return activoEntre(aplanar(MODULOS), ruta);
}
