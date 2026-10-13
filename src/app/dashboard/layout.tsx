import { Bell } from "lucide-react";
import { BuscadorGlobal } from "@/components/layout/BuscadorGlobal";
import { GuardianSesion } from "@/components/layout/GuardianSesion";
import { HeaderMovil } from "@/components/layout/HeaderMovil";
import { ProveedorAvisos } from "@/components/layout/ProveedorAvisos";
import { Sidebar } from "@/components/layout/Sidebar";
import { BotonIcono } from "@/components/ui";
import { modulosDe, vistaDeModulos } from "@/lib/navegacion";
import {
  inactividadPermitida,
  relojDeSesion,
  requerirUsuario,
} from "@/lib/sesion";

/**
 * El armazon de todo el dashboard.
 *
 * Es de servidor y hace las dos cosas que le tocan al layout: exigir la sesion
 * y repartir. `requerirUsuario` lee el usuario FRESCO de la base, no el token,
 * porque de el sale que modulos se pintan: si un administrador le cambia el rol
 * a alguien, el menu tiene que reflejarlo sin esperar a que caduque la sesion.
 *
 * Los modulos se resuelven aqui, una sola vez, y bajan como props al sidebar,
 * al cajon movil y al buscador. Ninguno de los tres decide que puede ver quien.
 */
export default async function LayoutDashboard({
  children,
}: LayoutProps<"/dashboard">) {
  const usuario = await requerirUsuario();
  const modulos = vistaDeModulos(modulosDe(usuario));

  // Las dos horas con las que arranca el reloj del navegador. No cuesta otra
  // consulta: salen de la misma que ya trajo al usuario.
  const reloj = await relojDeSesion();

  const ficha = {
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    rol: usuario.rol,
    fotoUrl: usuario.fotoUrl,
  };

  return (
    /*
      Los avisos se montan aqui y no en el layout raiz a proposito: el login
      tiene su alerta en linea, centrada en una pantalla corta, donde se ve
      perfectamente. Un aviso flotante ahi seria peor, no mejor.
    */
    <ProveedorAvisos>
      {reloj && (
        <GuardianSesion
          accesoCaducaEn={reloj.accesoCaducaEn}
          sesionCaducaEn={reloj.sesionCaducaEn}
          inactividad={inactividadPermitida()}
        />
      )}

      <div className="flex flex-1 flex-col lg:flex-row">
        <Sidebar modulos={modulos} usuario={ficha} />
        <HeaderMovil modulos={modulos} usuario={ficha} />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 hidden h-[68px] shrink-0 items-center gap-4 border-b border-borde bg-superficie px-[34px] lg:flex">
            <BuscadorGlobal modulos={modulos} />

            {/* Sin modulo de notificaciones todavia no hay nada que abrir ni
                nada que contar: el aviso llegara con los datos que lo respalden */}
            <BotonIcono
              etiqueta="Notificaciones (proximamente)"
              disabled
              className="ml-auto disabled:opacity-50"
            >
              <Bell aria-hidden="true" />
            </BotonIcono>
          </header>

          <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 pt-5 pb-4 lg:px-[34px] lg:py-7">
            {children}
          </main>
        </div>
      </div>
    </ProveedorAvisos>
  );
}
