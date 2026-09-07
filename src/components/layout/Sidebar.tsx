"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { cerrarSesion } from "@/actions/auth";
import { iniciales } from "@/components/ui";
import {
  activoEntre,
  aplanar,
  type ModuloVista,
  type UsuarioNav,
} from "@/lib/navegacion";
import { ItemNavegacion, type MedidasItem } from "./ItemNavegacion";
import { Marca } from "./Marca";

/**
 * La barra lateral de escritorio.
 *
 * Es de cliente por una sola razon: necesita saber en que ruta esta para
 * encender el modulo activo, y eso solo lo sabe el navegador. Los modulos ya
 * llegan filtrados por el layout, que es quien tiene la sesion.
 *
 * CAMBIA CON EL TEMA, como el resto de la interfaz: blanca en claro y navy en
 * oscuro. Lo que se acentua sigue la regla del proyecto, que es lo que hace
 * que el dorado nunca acabe sobre un fondo claro:
 *
 *   tema claro   -> el activo y los hover van MORADO
 *   tema oscuro  -> el activo y los hover van VAINILLA
 *
 * Ninguno de los dos colores se escribe aqui: se usa --acento y el tema
 * decide cual es.
 *
 * El pie no despliega nada: la ficha lleva al perfil y cerrar sesion esta a la
 * vista. Esconder dos destinos detras de un menu solo anadia un clic. El tema
 * se cambia desde Mi perfil, que es donde vive el resto de preferencias.
 */

/*
 * Las medidas del escritorio. El movil usa otras: alli el objetivo tactil
 * manda y no se puede bajar de 48 px de alto.
 */
const MEDIDAS: MedidasItem = {
  base: "flex min-h-10 items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13px]",
  icono: "[&_svg]:size-[18px]",
  hueco: "gap-1.5",
  // El texto del hijo cae en 50 px (12 del bloque + 6 de su relleno + 32 de
  // aqui), por dentro del padre, que empieza en 42. Mas bajo y mas chico,
  // ademas: las tres cosas juntas son lo que dice "esto pertenece a lo de
  // arriba".
  hijo: "suave flex min-h-9 items-center rounded-[9px] py-2 pr-3 pl-8 text-[12.5px]",
};

export function Sidebar({
  modulos,
  usuario,
}: {
  modulos: ModuloVista[];
  usuario: UsuarioNav;
}) {
  const ruta = usePathname();

  // Una sola vez y sobre la lista aplanada: ver la nota de ItemNavegacion.
  const activo = activoEntre(aplanar(modulos), ruta);
  const nombreCompleto = `${usuario.nombre} ${usuario.apellido}`;

  return (
    /*
      SOLO SE DESPLAZA LA LISTA, NO EL SIDEBAR ENTERO.

      Antes el `overflow-y-auto` estaba aqui, en el <aside>, asi que al
      desplegar Hooks —seis submodulos— se iban de la vista la marca y, sobre
      todo, el pie con el perfil y el cerrar sesion. Se notaba al anadir
      Empresas, que fue el modulo que colmo el alto disponible.

      Ahora el aside no se desplaza: reparte en tres tramos y solo el del medio
      cede. La marca y el pie se quedan siempre donde estan.
    */
    <aside
      className={[
        "hidden w-[268px] shrink-0 flex-col border-r border-nav-borde bg-nav",
        "pt-[26px] pb-5 text-nav-texto",
        "lg:sticky lg:top-0 lg:flex lg:h-svh lg:overflow-hidden",
      ].join(" ")}
    >
      <div className="flex shrink-0 items-center gap-2.5 px-[30px] pb-6">
        <Marca tamano={30} className="text-acento" />
        <span className="flex min-w-0 flex-col leading-none">
          <span className="text-[15.5px] font-bold tracking-[-0.015em]">
            Conejo App
          </span>
          <span className="mt-[5px] text-[9.5px] tracking-[0.07em] whitespace-nowrap text-acento uppercase">
            El Conejo del Sombrero
          </span>
        </span>
      </div>

      {/*
        `min-h-0` es lo que hace que esto funcione: sin el, un hijo flexible se
        niega a encoger por debajo de su contenido y el desbordamiento se
        escaparia al padre, que es justo lo que se quiere evitar.
      */}
      <div className="barra-fina min-h-0 flex-1 overflow-y-auto px-[18px]">
        <p className="px-3 pt-2 pb-2.5 text-[9.5px] font-semibold tracking-[0.16em] text-nav-suave/70 uppercase">
          General
        </p>

        <nav aria-label="Modulos" className="flex flex-col gap-1.5 pb-2">
          {modulos.map((modulo) => (
            <ItemNavegacion
              key={modulo.href}
              modulo={modulo}
              ruta={ruta}
              activo={activo}
              medidas={MEDIDAS}
            />
          ))}
        </nav>
      </div>

      <div className="mx-[18px] flex shrink-0 flex-col gap-1 border-t border-nav-borde pt-4">
        <Link
          href="/dashboard/perfil"
          className={[
            "flex min-h-11 items-center gap-3 rounded-[11px] px-2 py-2",
            "suave hover:bg-acento-tenue",
          ].join(" ")}
        >
          <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-acento text-[13px] font-bold text-acento-contraste">
            {usuario.fotoUrl ? (
              <Image
                src={usuario.fotoUrl}
                alt=""
                width={36}
                height={36}
                className="size-full object-cover"
              />
            ) : (
              iniciales(usuario.nombre, usuario.apellido)
            )}
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[13px] font-semibold">
              {nombreCompleto}
            </span>
            <span className="text-[11px] text-acento capitalize">
              {usuario.rol}
            </span>
          </span>
        </Link>

        <form action={cerrarSesion}>
          <button
            type="submit"
            className={[
              "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[10px] px-3",
              "border-none bg-transparent text-left text-[13.5px] font-medium text-nav-suave",
                "suave hover:bg-acento-tenue hover:text-acento",
              "[&_svg]:size-[18px] [&_svg]:shrink-0",
            ].join(" ")}
          >
            <LogOut aria-hidden="true" />
            Cerrar sesion
          </button>
        </form>
      </div>
    </aside>
  );
}
