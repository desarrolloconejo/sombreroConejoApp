import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { FormularioSegundoPaso } from "@/components/dosPasos";
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

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-1 flex-col justify-center px-5 py-10">
      <span
        aria-hidden="true"
        className="surge grid size-12 place-items-center rounded-full bg-acento text-acento-contraste [&>svg]:size-[22px]"
      >
        <ShieldCheck />
      </span>

      <p className="surge mt-5 text-[13px] font-bold text-acento">Un paso mas</p>

      <h1 className="surge mt-1.5 text-[27px] leading-[1.08] font-extrabold tracking-[-0.03em] text-balance sm:text-4xl">
        Escribe tu codigo
      </h1>

      <p className="surge mt-3 mb-7 text-[13.5px] leading-[1.6] text-pretty text-suave">
        Tu contrasena es correcta. Abre tu app de codigos y escribe los seis
        digitos de Conejo App.
      </p>

      <FormularioSegundoPaso />

      <p className="mt-8 text-[12px] leading-relaxed text-suave">
        Si perdiste el telefono y no tienes codigos de respaldo, pide a un
        administrador que te retire la verificacion en dos pasos.
      </p>
    </main>
  );
}
