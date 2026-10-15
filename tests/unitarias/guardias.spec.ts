import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

/**
 * Lo que hasta ahora se revisaba a ojo, fijado por una prueba que lee el
 * codigo (AGENTS.md, «Seguridad»):
 *
 * - toda action exportada empieza por su guardia;
 * - toda page que muestra datos empieza por su guardia;
 * - toda ruta de la API comprueba la sesion o el secreto de las tareas;
 * - las rutas publicas del proxy son las que son.
 *
 * Una excepcion nueva hay que anadirla aqui, con su motivo. Si esta prueba
 * falla por una action o una page nueva, lo normal es que le falte la guardia.
 */

const GUARDIAS = [
  "requerirUsuario",
  "requerirRol",
  "requerirAdmin",
  "requerirCargo",
  "requerirEmpresa",
  "requerirFinanzas",
  "requerirFinanzasDeEmpresa",
  "requerirHooks",
  "enlaceValido",
];

/** Las actions que no empiezan por una guardia, y por que. */
const ACTIONS_SIN_GUARDIA: Record<string, string> = {
  iniciarSesion: "atiende a quien aun no tiene sesion",
  cerrarSesion: "cierra la sesion que haya, sea cual sea",
  renovarSesion: "renueva el acceso con el token de renovacion",
  verificarSegundoPaso: "el segundo paso del login: aun no hay sesion",
  cambiarTema: "solo guarda la preferencia de tema de quien la pide",
  enviarCanvas: "despacha a auditarHook o guardarBorrador, que tienen su guardia",
  enviarAuditor: "despacha a auditarFicha o auditarTexto, que tienen su guardia",
};

/** Las pages que no llevan guardia: las puertas de entrada. */
const PAGES_PUBLICAS = new Set([
  "src/app/page.tsx",
  "src/app/login/page.tsx",
  "src/app/verificar/page.tsx",
  "src/app/renovar/page.tsx",
]);

function archivos(directorio: string, nombre: RegExp): string[] {
  return readdirSync(directorio).flatMap((entrada) => {
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) return archivos(ruta, nombre);
    return nombre.test(entrada) ? [ruta.replaceAll("\\", "/")] : [];
  });
}

/** Cada action exportada con la primera funcion a la que espera. */
function actionsDe(ruta: string): { nombre: string; primera: string | null }[] {
  const texto = readFileSync(ruta, "utf8");
  return texto
    .split(/\nexport async function /)
    .slice(1)
    .map((parte) => {
      const nombre = parte.match(/^(\w+)/)?.[1] ?? "?";
      const cuerpo = parte.slice(parte.indexOf("{", parte.indexOf(")")));
      return { nombre, primera: cuerpo.match(/await\s+([\w.]+)\(/)?.[1] ?? null };
    });
}

test("toda action empieza por su guardia, salvo las excepciones con motivo", () => {
  const sinGuardia: string[] = [];
  const nombres = new Set<string>();

  for (const ruta of archivos("src/actions", /\.ts$/)) {
    expect(readFileSync(ruta, "utf8").startsWith('"use server"'), `${ruta} no es 'use server'`).toBe(true);

    for (const { nombre, primera } of actionsDe(ruta)) {
      nombres.add(nombre);
      if (nombre in ACTIONS_SIN_GUARDIA) continue;
      if (!primera || !GUARDIAS.includes(primera)) sinGuardia.push(`${ruta}: ${nombre} empieza por ${primera ?? "nada"}`);
    }
  }

  expect(sinGuardia).toEqual([]);
  // Una excepcion que ya no existe sobra: se quita de la lista.
  expect(Object.keys(ACTIONS_SIN_GUARDIA).filter((nombre) => !nombres.has(nombre))).toEqual([]);
});

test("toda page con datos empieza por su guardia", () => {
  const sinGuardia = archivos("src/app", /^page\.tsx$/).filter((ruta) => {
    if (PAGES_PUBLICAS.has(ruta)) return false;
    return !new RegExp(`await (${GUARDIAS.join("|")})\\(`).test(readFileSync(ruta, "utf8"));
  });

  expect(sinGuardia).toEqual([]);
});

test("toda ruta de la API comprueba la sesion o el secreto", () => {
  const sinComprobar = archivos("src/app/api", /^route\.ts$/).filter((ruta) => {
    const texto = readFileSync(ruta, "utf8");
    const conSesion = /await usuarioActual\(\)/.test(texto) && /conservaElAcceso\(/.test(texto);
    const conSecreto = ruta.includes("/api/cron/") && /CRON_SECRET/.test(texto);
    return !conSesion && !conSecreto;
  });

  expect(sinComprobar).toEqual([]);
});

test("las rutas publicas del proxy son las que son", () => {
  const proxy = readFileSync("src/proxy.ts", "utf8");
  const publicas = proxy.match(/const RUTAS_PUBLICAS = \[([^\]]*)\]/)?.[1];
  const abiertas = proxy.match(/const RUTAS_ABIERTAS = \[([^\]]*)\]/)?.[1];

  expect(publicas?.replace(/\s/g, "")).toBe('"/login","/verificar","/api/cron","/brief"');
  expect(abiertas?.replace(/\s/g, "")).toBe('"/brief"');
});
