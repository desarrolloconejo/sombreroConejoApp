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

  // Lo ponen las guardias y el guardian de sesion cuando sacan a alguien. Solo
  // se reconocen valores fijos: el texto que se pinta nunca sale de la URL.
  const motivo =
    parametros.motivo === "sin-acceso" || parametros.motivo === "caducada"
      ? parametros.motivo
      : null;

  return <LoginWrapper volverA={volverA} motivo={motivo} />;
}
