import type { Metadata } from "next";

import { ClaveNuevaContent, PanelMarca } from "@/components/auth";
import { hashDeToken, pareceToken } from "@/lib/recuperarClave";
import * as restablecimientos from "@/models/restablecimientos";

export const metadata: Metadata = {
  title: "Contrasena nueva",
  // El enlace lleva el token en la URL: que no viaje a otro sitio.
  referrer: "no-referrer",
};

/**
 * La contrasena nueva, desde el enlace del correo. Su guardia es el token:
 * solo se pinta el formulario si el enlace aun sirve, y la action lo vuelve a
 * comprobar al guardar. No muestra ningun dato de la cuenta.
 */
export default async function PaginaClaveNueva(props: PageProps<"/recuperar/nueva">) {
  const { token } = await props.searchParams;
  const valido = pareceToken(token) && (await restablecimientos.vigente(hashDeToken(token))) !== null;

  return (
    <main className="relative flex min-h-dvh flex-1 flex-col bg-white lg:flex-row dark-tema:bg-fondo">
      <PanelMarca />
      <ClaveNuevaContent token={valido ? (token as string) : ""} valido={valido} />
    </main>
  );
}
