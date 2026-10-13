import type { Metadata } from "next";
import { LoginWrapper } from "@/components/auth";

export const metadata: Metadata = {
  title: "Iniciar sesion",
};

/**
 * La page es de servidor: lee lo que necesita e inyecta las props. No pinta
 * marcado propio, de eso se encarga el wrapper.
 */
export default async function PaginaLogin(props: PageProps<"/login">) {
  const parametros = await props.searchParams;

  // Llega en la URL cuando el proxy corta el paso a una ruta protegida, para
  // devolver a la persona donde queria ir. La action vuelve a comprobar que
  // sea una ruta interna antes de redirigir.
  const volverA =
    typeof parametros.volverA === "string" ? parametros.volverA : "/dashboard";

  // Lo ponen las guardias cuando echan a alguien con el token aun valido. Solo
  // se reconoce un valor fijo: el texto que se pinta nunca sale de la URL.
  const sinAcceso = parametros.motivo === "sin-acceso";

  return <LoginWrapper volverA={volverA} sinAcceso={sinAcceso} />;
}
