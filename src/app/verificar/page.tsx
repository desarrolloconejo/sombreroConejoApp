import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VerificarWrapper } from "@/components/auth";
import { pasoPendiente } from "@/lib/dosPasos";

export const metadata: Metadata = {
  title: "Verificacion en dos pasos",
};

/**
 * La pantalla del codigo, entre la contrasena y el panel.
 *
 * Quien llega aqui todavia no tiene sesion: por eso no lleva guardia. Lo que
 * comprueba es que venga de acertar su contrasena, y si no, vuelve al login.
 * No muestra ningun dato de la cuenta.
 */
export default async function PaginaVerificar() {
  if (!(await pasoPendiente())) {
    redirect("/login");
  }

  return <VerificarWrapper />;
}
