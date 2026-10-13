import { PanelMarca } from "./PanelMarca";
import { VerificarContent } from "./VerificarContent";

/**
 * La composicion de la pantalla del codigo.
 *
 * Es la del login, pieza por pieza: el mismo panel de marca y el mismo fondo.
 * Entre la contrasena y el codigo solo cambia la columna del formulario.
 */
export function VerificarWrapper() {
  return (
    <main className="relative flex min-h-dvh flex-1 flex-col bg-white lg:flex-row dark-tema:bg-fondo">
      <PanelMarca />
      <VerificarContent />
    </main>
  );
}
