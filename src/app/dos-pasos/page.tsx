import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { omitirDosPasos } from "@/actions/dosPasos";
import { ConfigurarDosPasos } from "@/components/dosPasos";
import { ProveedorAvisos } from "@/components/layout/ProveedorAvisos";
import { Boton } from "@/components/ui";
import { requerirUsuario } from "@/lib/sesion";
import * as dosPasos from "@/models/dosPasos";

export const metadata: Metadata = {
  title: "Verificacion en dos pasos",
};

/**
 * Donde cada persona decide sobre la verificacion en dos pasos.
 *
 * Se pide por defecto: las guardias mandan aqui, desde cualquier ruta del
 * panel, a quien no la tiene activada ni ha dicho que no la quiere. Aqui la
 * configura, o dice que prefiere entrar sin ella; en los dos casos no se le
 * vuelve a preguntar.
 *
 * Vive fuera del layout del panel, como la pantalla de la contrasena
 * provisional: dentro tendria el menu a la vista y todos sus enlaces
 * rebotarian de vuelta aqui.
 */
export default async function PaginaDosPasos() {
  const usuario = await requerirUsuario({ sinResolverDosPasos: true });

  const { activado } = await dosPasos.estado(usuario.id);

  // Quien ya la tiene la gestiona desde Mi perfil.
  if (activado) redirect("/dashboard/perfil");

  return (
    <ProveedorAvisos>
      <main className="mx-auto flex min-h-dvh w-full max-w-[620px] flex-1 flex-col justify-center px-4 py-10">
        <span
          aria-hidden="true"
          className="surge grid size-12 place-items-center rounded-full bg-acento text-acento-contraste [&>svg]:size-[22px]"
        >
          <ShieldCheck />
        </span>

        <p className="surge mt-5 text-[13px] font-bold text-acento">
          Hola, {usuario.nombre}
        </p>

        <h1 className="surge mt-1.5 text-[27px] leading-[1.08] font-extrabold tracking-[-0.03em] text-balance sm:text-4xl">
          Protege tu cuenta con un segundo paso
        </h1>

        <p className="surge mt-3 mb-6 max-w-[54ch] text-[13.5px] leading-[1.6] text-pretty text-suave">
          Ademas de la contrasena, al entrar se te pedira un codigo de seis
          digitos que genera una app en tu telefono (Google Authenticator o
          compatible). Aunque alguien conozca tu contrasena, sin tu telefono no
          entra. Se configura una vez y lleva un minuto.
        </p>

        <section className="surge rounded-[15px] border border-borde bg-superficie p-[22px] shadow-[var(--sombra)]">
          <ConfigurarDosPasos hrefAlTerminar="/dashboard" />
        </section>

        {/* La salida para quien no la quiere. Va aparte y con menos peso: es
            una opcion, no la accion recomendada. */}
        <form action={omitirDosPasos} className="mt-5 flex flex-wrap items-center justify-end gap-3">
          <p className="text-[12px] text-suave">
            Puedes activarla mas adelante desde Mi perfil.
          </p>
          <Boton type="submit" variante="fantasma">
            Ahora no, entrar sin ella
          </Boton>
        </form>
      </main>
    </ProveedorAvisos>
  );
}
