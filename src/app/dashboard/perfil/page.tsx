import type { Metadata } from "next";

import { PerfilWrapper } from "@/components/perfil";
import { requerirUsuario } from "@/lib/sesion";

export const metadata: Metadata = {
  title: "Mi perfil",
};

/**
 * La page es de servidor y hace solo lo que le toca: exigir la sesion, leer a
 * la persona ya resuelta con su tipo y su rol, e inyectarla. El marcado vive
 * entero en el wrapper.
 *
 * `requerirUsuario` lee de la base y no del token, que es lo correcto aqui:
 * si un administrador le cambio el cargo a alguien, el perfil tiene que
 * mostrar el valor de ahora, no la foto del momento en que inicio sesion.
 */
export default async function PaginaPerfil() {
  const usuario = await requerirUsuario();

  return <PerfilWrapper usuario={usuario} />;
}
