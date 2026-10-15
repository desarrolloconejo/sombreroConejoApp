import { expect, test } from "@playwright/test";
import { modulosDe, porSecciones } from "@/lib/navegacion";

/**
 * El menu por secciones: que ve cada quien, y como se agrupa.
 *
 * Se prueba sobre el registro real y no sobre uno de mentira: lo que hay que
 * proteger es que un modulo nuevo caiga en su seccion y que nadie vea el
 * rotulo de una seccion vacia.
 */

const ADMIN = { rol: "admin", cargo: "direccion" } as const;
const REDES = { rol: "trabajador", cargo: "redes" } as const;
const DISENO = { rol: "trabajador", cargo: "diseno" } as const;
const ADMINISTRACION = { rol: "trabajador", cargo: "administracion" } as const;
const CUENTAS = { rol: "trabajador", cargo: "cuentas" } as const;
const CLIENTE = { rol: "cliente", cargo: null } as const;

/** Las secciones tal como se leerian en el menu: rotulo y titulos. */
function menuDe(quien: Parameters<typeof modulosDe>[0]) {
  return porSecciones(modulosDe(quien)).map((grupo) => ({
    seccion: grupo.titulo,
    modulos: grupo.modulos.map((modulo) => modulo.titulo),
  }));
}

test("el administrador ve todas las secciones que tienen algo, en su orden", () => {
  expect(menuDe(ADMIN)).toEqual([
    { seccion: "General", modulos: ["Inicio"] },
    { seccion: "Trabajo", modulos: ["Tablero", "Proyectos", "Briefs", "Mi trabajo"] },
    { seccion: "Herramientas", modulos: ["Hooks"] },
    {
      seccion: "Finanzas",
      modulos: ["Presupuestos", "Proformas", "Facturas", "Cobranza", "Ajustes de finanzas"],
    },
    {
      seccion: "Sistema",
      modulos: ["Usuarios", "Empresas", "Auditoria", "Bandeja de salida"],
    },
    { seccion: null, modulos: ["Mi perfil"] },
  ]);
});

test("redes ve Herramientas y no ve Sistema", () => {
  expect(menuDe(REDES)).toEqual([
    { seccion: "General", modulos: ["Inicio"] },
    { seccion: "Trabajo", modulos: ["Mi trabajo"] },
    { seccion: "Herramientas", modulos: ["Hooks"] },
    { seccion: null, modulos: ["Mi perfil"] },
  ]);
});

test("un ejecutivo de cuentas ve Tablero, Proyectos y Briefs en Trabajo, y no ve Hooks", () => {
  expect(menuDe(CUENTAS)).toEqual([
    { seccion: "General", modulos: ["Inicio"] },
    { seccion: "Trabajo", modulos: ["Tablero", "Proyectos", "Briefs", "Mi trabajo"] },
    { seccion: null, modulos: ["Mi perfil"] },
  ]);
});

test("diseno ve Mi trabajo y nada mas de Trabajo", () => {
  expect(menuDe(DISENO)).toEqual([
    { seccion: "General", modulos: ["Inicio"] },
    { seccion: "Trabajo", modulos: ["Mi trabajo"] },
    { seccion: null, modulos: ["Mi perfil"] },
  ]);
});

test("administracion ve Finanzas, y una seccion sin modulos no deja su rotulo", () => {
  // No ve nada de Trabajo: su seccion no aparece, ni vacia.
  expect(menuDe(ADMINISTRACION)).toEqual([
    { seccion: "General", modulos: ["Inicio"] },
    {
      seccion: "Finanzas",
      modulos: ["Presupuestos", "Proformas", "Facturas", "Cobranza", "Ajustes de finanzas"],
    },
    { seccion: null, modulos: ["Mi perfil"] },
  ]);
});

test("nadie mas del equipo ve Finanzas", () => {
  for (const quien of [REDES, DISENO, CUENTAS, CLIENTE]) {
    expect(menuDe(quien).map((grupo) => grupo.seccion)).not.toContain("Finanzas");
  }
});

test("el cliente con permiso de finanzas ve Facturacion; sin el, no", () => {
  expect(menuDe({ ...CLIENTE, cargoSlug: null, puedeVerFinanzas: true })).toEqual([
    { seccion: "General", modulos: ["Inicio"] },
    { seccion: "Mi espacio", modulos: ["Mis proyectos", "Mis briefs", "Facturacion"] },
    { seccion: null, modulos: ["Mi perfil"] },
  ]);
  expect(menuDe({ ...CLIENTE, cargoSlug: null, puedeVerFinanzas: false })[1].modulos).toEqual([
    "Mis proyectos",
    "Mis briefs",
  ]);
});

test("un cliente ve su espacio y nada de la agencia", () => {
  expect(menuDe(CLIENTE)).toEqual([
    { seccion: "General", modulos: ["Inicio"] },
    { seccion: "Mi espacio", modulos: ["Mis proyectos", "Mis briefs"] },
    { seccion: null, modulos: ["Mi perfil"] },
  ]);
});

test("Mi perfil va siempre el ultimo, y sin rotulo", () => {
  for (const quien of [ADMIN, REDES, DISENO, CUENTAS, CLIENTE]) {
    const ultimo = menuDe(quien).at(-1);

    expect(ultimo).toEqual({ seccion: null, modulos: ["Mi perfil"] });
  }
});

test("los submodulos viajan con su padre, dentro de su seccion", () => {
  const herramientas = porSecciones(modulosDe(REDES)).find(
    (grupo) => grupo.titulo === "Herramientas",
  );

  expect(herramientas?.modulos[0]?.hijos?.map((hijo) => hijo.titulo)).toEqual([
    "Manual",
    "Documentacion",
    "Hooks",
    "Auditor",
    "Metricas",
    "Historial",
  ]);
});
