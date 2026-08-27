import { cookies } from "next/headers";
import { comoTema } from "./validaciones";
import type { Tema } from "@/types";

/**
 * El tema se guarda en dos sitios y por motivos distintos:
 *
 * - En la tabla usuarios, porque es una preferencia de la persona y debe
 *   seguirla a cualquier dispositivo donde entre.
 * - En una cookie, porque el servidor necesita saberlo ANTES de renderizar
 *   para pintar el atributo data-tema en el html.
 *
 * Esa cookie es la que evita el parpadeo blanco al cargar. Si el valor
 * viviera solo en el navegador haria falta un script inline que corriera
 * antes del primer pintado; leyendolo en el servidor no hace falta ninguno.
 */

export const COOKIE_TEMA = "conejo_tema";

const UN_ANO = 60 * 60 * 24 * 365;

/** Lee el tema elegido. Cae a "sistema" ante cualquier valor invalido. */
export async function temaActual(): Promise<Tema> {
  const almacen = await cookies();
  return comoTema(almacen.get(COOKIE_TEMA)?.value) ?? "sistema";
}

/**
 * Valor del atributo data-tema del html.
 *
 * Devuelve undefined cuando la eleccion es "sistema": sin atributo, manda la
 * consulta prefers-color-scheme del CSS.
 */
export function atributoTema(tema: Tema): "claro" | "oscuro" | undefined {
  return tema === "sistema" ? undefined : tema;
}

/** Guarda la eleccion en la cookie. No es httpOnly: no es un secreto. */
export async function guardarTemaEnCookie(tema: Tema): Promise<void> {
  const almacen = await cookies();

  almacen.set(COOKIE_TEMA, tema, {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: UN_ANO,
  });
}
