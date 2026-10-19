import { BuscadorGlobal } from "@/components/layout/BuscadorGlobal";
import { Campana } from "@/components/layout/Campana";
import { GuardianSesion } from "@/components/layout/GuardianSesion";
import { HeaderMovil } from "@/components/layout/HeaderMovil";
import { IndicePagina } from "@/components/layout/IndicePagina";
import { ProveedorAvisos } from "@/components/layout/ProveedorAvisos";
import { Sidebar } from "@/components/layout/Sidebar";
import { RastroNavegacion } from "@/components/layout/Volver";
import { modulosDe, vistaDeModulos } from "@/lib/navegacion";
import { resumenDeNotificaciones } from "@/lib/notificaciones";
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
 * Lo mismo las notificaciones de la campana.
 */
export default async function LayoutDashboard({
  children,
}: LayoutProps<"/dashboard">) {
  const usuario = await requerirUsuario();
  const modulos = vistaDeModulos(modulosDe(usuario));

  // Las dos horas con las que arranca el reloj del navegador. No cuesta otra
  // consulta: salen de la misma que ya trajo al usuario.
  const reloj = await relojDeSesion();

  // Lo que pinta la campana. Se pide aqui y baja como props: ni la campana
  // del escritorio ni la del movil consultan nada por su cuenta.
  const notificaciones = await resumenDeNotificaciones(usuario);

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
      <RastroNavegacion />
      {reloj && (
        <GuardianSesion
          accesoCaducaEn={reloj.accesoCaducaEn}
          sesionCaducaEn={reloj.sesionCaducaEn}
          inactividad={inactividadPermitida()}
        />
      )}

      <div className="flex flex-1 flex-col lg:flex-row">
        <Sidebar modulos={modulos} usuario={ficha} />
        <HeaderMovil
          modulos={modulos}
          usuario={ficha}
          notificaciones={notificaciones}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 hidden h-[68px] shrink-0 items-center gap-4 border-b border-borde bg-superficie px-[34px] lg:flex">
            <BuscadorGlobal modulos={modulos} />

            <div className="ml-auto">
              <Campana resumen={notificaciones} variante="escritorio" />
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 pt-5 pb-4 lg:px-[34px] lg:py-7">
            {children}
          </main>
          <IndicePagina />
        </div>
      </div>
    </ProveedorAvisos>
  );
}
