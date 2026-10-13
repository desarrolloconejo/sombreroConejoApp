import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound, LogOut } from "lucide-react";

import { cerrarSesion } from "@/actions/auth";
import { ProveedorAvisos } from "@/components/layout/ProveedorAvisos";
import { FormularioPassword } from "@/components/perfil";
import { Boton } from "@/components/ui";
import { requerirUsuario } from "@/lib/sesion";

export const metadata: Metadata = {
  title: "Elige tu contrasena",
};

/**
 * La unica pantalla que ve quien entra con una contrasena provisional.
 *
 * La provisional la conoce quien dio el alta o la restablecio, asi que no
 * puede seguir en uso: las guardias mandan aqui desde cualquier ruta del panel
 * hasta que la persona elija una propia.
 *
 * Vive fuera del layout del panel a proposito. Dentro tendria el menu a la
 * vista, y todos sus enlaces rebotarian de vuelta aqui.
 */
export default async function PaginaCambiarClave() {
  const usuario = await requerirUsuario({ conClaveProvisional: true });

  // Quien ya tiene contrasena propia la cambia desde Mi perfil.
  if (!usuario.debeCambiarClave) {
    redirect("/dashboard/perfil");
  }

  return (
    <ProveedorAvisos>
      <main className="mx-auto flex min-h-dvh w-full max-w-[620px] flex-1 flex-col justify-center px-4 py-10">
        <span
          aria-hidden="true"
          className="surge grid size-12 place-items-center rounded-full bg-acento text-acento-contraste [&>svg]:size-[22px]"
        >
          <KeyRound />
        </span>

        <p className="surge mt-5 text-[13px] font-bold text-acento">
          Hola, {usuario.nombre}
        </p>

        <h1 className="surge mt-1.5 text-[27px] leading-[1.08] font-extrabold tracking-[-0.03em] text-balance sm:text-4xl">
          Elige tu contrasena
        </h1>

        <p className="surge mt-3 mb-6 max-w-[52ch] text-[13.5px] leading-[1.6] text-pretty text-suave">
          La que usaste para entrar es provisional y la conoce quien te dio el
          acceso. Antes de continuar, cambiala por una que solo sepas tu. En
          «Contrasena actual» va la provisional.
        </p>

        <FormularioPassword />

        <form action={cerrarSesion} className="mt-5 flex justify-end">
          <Boton type="submit" variante="fantasma">
            <LogOut aria-hidden="true" />
            Salir sin cambiarla
          </Boton>
        </form>
      </main>
    </ProveedorAvisos>
  );
}
