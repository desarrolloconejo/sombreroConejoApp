import type { Metadata } from "next";

import { PanelMarca, RecuperarContent } from "@/components/auth";

export const metadata: Metadata = {
  title: "Olvide mi contrasena",
};

/**
 * «Olvide mi contrasena»: la puerta para quien no puede entrar. No lleva
 * guardia: no hay sesion que comprobar, y no muestra ningun dato. Lo que pide
 * solo manda un correo a la direccion de la cuenta.
 */
export default function PaginaRecuperar() {
  return (
    <main className="relative flex min-h-dvh flex-1 flex-col bg-white lg:flex-row dark-tema:bg-fondo">
      <PanelMarca />
      <RecuperarContent />
    </main>
  );
}
