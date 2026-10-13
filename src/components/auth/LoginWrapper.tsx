import { LoginContent } from "./LoginContent";
import { PanelMarca } from "./PanelMarca";

/**
 * La composicion del login: marca y formulario.
 *
 * En escritorio son dos columnas, en movil una cabecera sobre el formulario.
 * El `relative` no es decorativo: es el ancla del conmutador de tema, que
 * flota desde LoginContent y necesita medirse contra la pantalla entera para
 * caer sobre la cabecera navy en movil y sobre el panel derecho en escritorio.
 *
 * El fondo se aparta del --fondo general a proposito: el login va blanco en
 * claro, como el diseno aprobado, y no gris.
 */
export function LoginWrapper({
  volverA,
  sinAcceso,
}: {
  volverA: string;
  sinAcceso: boolean;
}) {
  return (
    <main className="relative flex min-h-dvh flex-1 flex-col bg-white lg:flex-row dark-tema:bg-fondo">
      <PanelMarca />
      <LoginContent volverA={volverA} sinAcceso={sinAcceso} />
    </main>
  );
}
