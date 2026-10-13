import { NextResponse, type NextRequest } from "next/server";
import { verificarSesion } from "@/lib/jwt";
import type { SlugCargo } from "@/types";

/**
 * Barrera de rutas. En Next 16 este archivo sustituye a middleware.ts y se
 * ejecuta siempre en el runtime de Node, que no es configurable.
 *
 * Lo que hace: mirar la cookie, verificar la firma y decidir a donde va la
 * peticion. Nada mas. No consulta la base de datos, porque se ejecuta en cada
 * peticion que pase el matcher y porque la documentacion desaconseja
 * expresamente apoyarse aqui en estado compartido.
 *
 * IMPORTANTE: esto NO es la unica proteccion. Las Server Actions viajan como
 * POST a la ruta donde se usan, asi que un cambio en el matcher puede dejarlas
 * descubiertas. La comprobacion que de verdad protege los datos vive en cada
 * page y cada action, con `requerirSesion` y `requerirRol`.
 */

/** Rutas accesibles sin haber iniciado sesion. */
const RUTAS_PUBLICAS = ["/login"];

/** Prefijos de ruta reservados al rol admin. */
const RUTAS_SOLO_ADMIN = ["/dashboard/usuarios", "/dashboard/empresas"];

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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(
    process.env.COOKIE_SESION ?? "conejo_sesion",
  )?.value;

  const sesion = token ? await verificarSesion(token) : null;

  // La raiz nunca muestra contenido: reparte segun haya sesion o no.
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(sesion ? "/dashboard" : "/login", request.url),
    );
  }

  // Con sesion iniciada, el login no tiene sentido.
  if (sesion && esRutaPublica(pathname)) {
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

  // Si una cookie no verifica, se limpia para que el navegador deje de
  // enviarla en cada peticion.
  if (token && !sesion) {
    const respuesta = NextResponse.next();
    respuesta.cookies.delete(process.env.COOKIE_SESION ?? "conejo_sesion");
    return respuesta;
  }

  return NextResponse.next();
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
