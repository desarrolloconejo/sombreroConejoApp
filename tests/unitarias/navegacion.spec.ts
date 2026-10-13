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
    { seccion: "Herramientas", modulos: ["Hooks"] },
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
    { seccion: "Herramientas", modulos: ["Hooks"] },
    { seccion: null, modulos: ["Mi perfil"] },
  ]);
});

test("una seccion sin modulos visibles no deja su rotulo", () => {
  const secciones = menuDe(DISENO).map((grupo) => grupo.seccion);

  expect(secciones).toEqual(["General", null]);
});

test("un cliente no ve nada de la agencia", () => {
  expect(menuDe(CLIENTE)).toEqual([
    { seccion: "General", modulos: ["Inicio"] },
    { seccion: null, modulos: ["Mi perfil"] },
  ]);
});

test("Mi perfil va siempre el ultimo, y sin rotulo", () => {
  for (const quien of [ADMIN, REDES, DISENO, CLIENTE]) {
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
