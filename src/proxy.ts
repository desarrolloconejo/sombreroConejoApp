import { NextResponse, type NextRequest } from "next/server";
import { verificarSesion } from "@/lib/jwt";
import type { SlugCargo } from "@/types";

/**
 * Barrera de rutas. En Next 16 este archivo sustituye a middleware.ts y se
 * ejecuta siempre en el runtime de Node, que no es configurable.
 *
 * Lo que hace: mirar las cookies, verificar la firma del acceso, decidir a
 * donde va la peticion y ponerle la politica de contenido. Nada mas. No consulta la base
 * de datos, porque se ejecuta en cada peticion que pase el matcher y porque la
 * documentacion desaconseja expresamente apoyarse aqui en estado compartido.
 *
 * IMPORTANTE: esto NO es la unica proteccion. Las Server Actions viajan como
 * POST a la ruta donde se usan, asi que un cambio en el matcher puede dejarlas
 * descubiertas. La comprobacion que de verdad protege los datos vive en cada
 * page y cada action, con las guardias de `src/lib/sesion.ts`.
 */

/**
 * Rutas accesibles sin haber iniciado sesion.
 *
 * `/verificar` es la pantalla del codigo de la verificacion en dos pasos.
 * Quien llega a ella acerto su contrasena pero todavia no tiene sesion; la
 * propia pantalla comprueba que venga de ahi y, si no, manda al login.
 *
 * `/api/cron` son las tareas programadas: las llama la plataforma, no una
 * persona, asi que no traen cookie. No quedan abiertas: cada una exige su
 * secreto en la cabecera, y sin el responde 401.
 */
const RUTAS_PUBLICAS = ["/login", "/verificar", "/api/cron"];

/** Prefijos de ruta reservados al rol admin. */
const RUTAS_SOLO_ADMIN = [
  "/dashboard/usuarios",
  "/dashboard/empresas",
  "/dashboard/auditoria",
  "/dashboard/salida",
];

/**
 * Prefijos reservados a un area de la agencia.
 *
 * El token ya lleva el cargo, asi que esto se resuelve sin tocar la base. Es
 * la PRIMERA barrera, no la unica: cada page y cada action del modulo empieza
 * igualmente con requerirCargo, porque una Server Action es un POST a la ruta
 * donde se usa y un cambio en el matcher podria dejarlas descubiertas.
 */
const RUTAS_POR_CARGO: { prefijo: string; cargos: SlugCargo[] }[] = [
  { prefijo: "/dashboard/hooks", cargos: ["redes"] },
];

/**
 * Con este parametro el login se muestra aunque el token verifique.
 *
 * Lo ponen las guardias cuando el token es valido pero la sesion ya no (la
 * cuenta se desactivo, la sesion se revoco o caduco). Sin el, el proxy
 * devolveria a esa persona al panel y el panel la volveria a echar, sin fin.
 */
const PARAMETRO_SALIDA = "motivo";

/**
 * La parada de renovacion. Va aparte de las publicas porque no lo es: solo
 * pasa quien trae token de renovacion.
 */
const RUTA_RENOVAR = "/renovar";

function nombreCookie(): string {
  return process.env.COOKIE_SESION ?? "conejo_sesion";
}

/** El mismo nombre que arma `nombreCookieRenovacion` en src/lib/sesion.ts. */
function nombreCookieRenovacion(): string {
  return `${nombreCookie()}_renovacion`;
}

function esRutaPublica(ruta: string): boolean {
  return RUTAS_PUBLICAS.some(
    (publica) => ruta === publica || ruta.startsWith(`${publica}/`),
  );
}

function esRutaDeAdmin(ruta: string): boolean {
  return RUTAS_SOLO_ADMIN.some(
    (privada) => ruta === privada || ruta.startsWith(`${privada}/`),
  );
}

/** Los cargos que admite una ruta, o null si no esta restringida por area. */
function cargosDeRuta(ruta: string): SlugCargo[] | null {
  const regla = RUTAS_POR_CARGO.find(
    ({ prefijo }) => ruta === prefijo || ruta.startsWith(`${prefijo}/`),
  );

  return regla?.cargos ?? null;
}

/**
 * La politica de contenido de una respuesta.
 *
 * Los scripts solo corren si llevan el `nonce` de esta peticion, que Next
 * pone por su cuenta en los suyos al leerlo de la cabecera. Un script
 * inyectado no lo conoce, y por eso no se ejecuta.
 *
 * Tres concesiones, cada una con su motivo:
 *
 * - `style-src 'unsafe-inline'`: los componentes pasan variables CSS por el
 *   atributo `style` (el retraso de las animaciones de entrada), y un atributo
 *   no puede llevar nonce.
 * - `'unsafe-eval'` y `ws:` solo en desarrollo: React reconstruye con `eval`
 *   las trazas del servidor, y la recarga en caliente va por websocket.
 * - `upgrade-insecure-requests` solo en produccion: en desarrollo la app se
 *   abre por http, tambien desde un telefono de la red.
 */
function politicaDeContenido(nonce: string): string {
  const enDesarrollo = process.env.NODE_ENV !== "production";

  const directivas = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${enDesarrollo ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${enDesarrollo ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  if (!enDesarrollo) directivas.push("upgrade-insecure-requests");

  return directivas.join("; ");
}

/**
 * Deja pasar la peticion, con su politica de contenido.
 *
 * La politica va en la respuesta, que es lo que obedece el navegador, y
 * tambien en la peticion: de ahi lee Next el nonce para ponerselo a sus
 * scripts al renderizar.
 */
function continuar(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const politica = politicaDeContenido(nonce);

  const cabeceras = new Headers(request.headers);
  cabeceras.set("x-nonce", nonce);

  // La ruta completa, para que una guardia pueda devolver aqui a quien tuvo
  // que pasar por la renovacion. Se pisa siempre: lo que mandara el navegador
  // en esta cabecera no cuenta.
  cabeceras.set("x-ruta", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  cabeceras.set("Content-Security-Policy", politica);

  const respuesta = NextResponse.next({ request: { headers: cabeceras } });
  respuesta.headers.set("Content-Security-Policy", politica);

  return respuesta;
}

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  const token = request.cookies.get(nombreCookie())?.value;
  const sesion = token ? await verificarSesion(token) : null;

  /*
   * El acceso dura media hora y la sesion hasta doce. Entre una cosa y otra
   * llegan peticiones con el acceso vencido y el token de renovacion puesto:
   * no se pueden mandar al login, porque una de ellas es justo la que renueva.
   *
   * El proxy no puede comprobar ese token (no consulta la base), asi que lo
   * unico que hace es dejar pasar. Quien decide es la guardia de la page o de
   * la action, que si lo comprueba.
   */
  const puedeRenovar = request.cookies.has(nombreCookieRenovacion());

  // La raiz nunca muestra contenido: reparte segun haya sesion o no.
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(sesion || puedeRenovar ? "/dashboard" : "/login", request.url),
    );
  }

  // Salida forzada: la guardia ya decidio que esta cuenta no entra. Se borra
  // la cookie y se muestra el login, que explica el motivo.
  if (pathname === "/login" && searchParams.has(PARAMETRO_SALIDA)) {
    const respuesta = continuar(request);
    if (token) respuesta.cookies.delete(nombreCookie());
    if (puedeRenovar) respuesta.cookies.delete(nombreCookieRenovacion());
    return respuesta;
  }

  // Con el acceso vencido y renovacion puesta, pasa: decide la guardia.
  if (!sesion && puedeRenovar && !esRutaPublica(pathname)) {
    return continuar(request);
  }

  // A renovar solo llega quien acaba de pasar por la linea de arriba. Con el
  // acceso en regla no hay nada que renovar.
  if (pathname === RUTA_RENOVAR) {
    return NextResponse.redirect(
      new URL(sesion ? "/dashboard" : "/login", request.url),
    );
  }

  // Con sesion iniciada, el login no tiene sentido. Las tareas programadas
  // no entran aqui: no son pantallas, y quien tenga sesion no las convierte
  // en una redireccion.
  if (sesion && esRutaPublica(pathname) && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Sin sesion, todo lo que no sea publico manda al login. Se recuerda a donde
  // queria ir para devolverle ahi despues de entrar.
  if (!sesion && !esRutaPublica(pathname)) {
    const destino = new URL("/login", request.url);
    destino.searchParams.set("volverA", pathname);
    return NextResponse.redirect(destino);
  }

  // Con sesion pero sin el rol necesario: de vuelta al panel, no al login.
  // Su sesion es valida; lo que falta es permiso.
  if (sesion && esRutaDeAdmin(pathname) && sesion.rol !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Y lo mismo por area. El admin se lo salta, igual que en requerirCargo:
  // su rol le da acceso a todas las areas de la agencia.
  if (sesion && sesion.rol !== "admin") {
    const cargos = cargosDeRuta(pathname);

    if (cargos && (!sesion.cargo || !cargos.includes(sesion.cargo))) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  const respuesta = continuar(request);

  // Si una cookie no verifica, se limpia para que el navegador deje de
  // enviarla en cada peticion.
  if (token && !sesion) {
    respuesta.cookies.delete(nombreCookie());
  }

  return respuesta;
}

export const config = {
  matcher: [
    /*
     * Se excluyen los archivos estaticos y las rutas internas de Next. Sin
     * esta exclusion el proxy correria tambien para el CSS, el JavaScript y
     * las imagenes, y la redireccion al login los bloquearia.
     *
     * Tambien se excluye /uploads, que servia las fotos de perfil. Hoy esa
     * carpeta esta vacia porque la subida esta apagada (ver el bloque final de
     * src/actions/perfil.ts), pero la exclusion se queda: cuando la
     * funcionalidad vuelva hara falta otra vez, y quitarla ahora solo crearia
     * trabajo para entonces.
     *
     * La exclusion por extension vale SOLO para lo que cuelga de la raiz
     * (icon.png, apple-icon.png) y para /images, que es donde vive lo de
     * public/. Excluir cualquier ruta que termine en .png o .js dejaria fuera
     * del proxy una ruta del panel que algun dia acabe asi.
     */
    "/((?!_next/static|_next/image|favicon.ico|uploads/|images/|[^/]+\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
