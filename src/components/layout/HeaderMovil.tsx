"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Bell, LogOut, Menu, X } from "lucide-react";
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

/** Lo referencian el boton hamburguesa y el propio cajon. */
const ID_CAJON = "cajon-navegacion";

/**
 * La cabecera y el cajon de navegacion por debajo de lg.
 *
 * El cajon no se desmonta al cerrarse: se queda fuera de pantalla con `inert`,
 * que lo saca del arbol de accesibilidad y del recorrido del tabulador. Asi la
 * animacion de entrada y salida es una transicion normal, sin el baile de
 * montar y desmontar, y aun asi nadie puede tabular hacia algo invisible.
 */
/* Las medidas del cajon: 48 px de alto, que es el minimo para el pulgar. */
const MEDIDAS: MedidasItem = {
  base: "suave flex min-h-12 items-center gap-3 rounded-xl px-3 py-[13px] text-sm",
  icono: "[&_svg]:size-[19px]",
  hueco: "gap-[3px]",
  // En el cajon el hijo baja de 48 a 44 px, que sigue siendo objetivo
  // tactil valido: por debajo de eso el pulgar empieza a fallar.
  hijo: "suave flex min-h-11 items-center rounded-[10px] py-2.5 pr-3 pl-8 text-[13px]",
};

export function HeaderMovil({
  modulos,
  usuario,
}: {
  modulos: ModuloVista[];
  usuario: UsuarioNav;
}) {
  const [abierto, setAbierto] = useState(false);
  const ruta = usePathname();

  // Una sola vez y sobre la lista aplanada: ver la nota de ItemNavegacion.
  const activo = activoEntre(aplanar(modulos), ruta);

  const cajon = useRef<HTMLElement>(null);
  const hamburguesa = useRef<HTMLButtonElement>(null);
  const cerrar = useRef<HTMLButtonElement>(null);

  const nombreCompleto = `${usuario.nombre} ${usuario.apellido}`;

  // Al navegar, el cajon ya cumplio su papel. Se ajusta durante el render y no
  // en un efecto, que obligaria a pintar dos veces cada cambio de pagina.
  const [rutaPintada, setRutaPintada] = useState(ruta);
  if (ruta !== rutaPintada) {
    setRutaPintada(ruta);
    setAbierto(false);
  }

  useEffect(() => {
    if (!abierto) return;

    // El fondo no debe desplazarse detras del cajon
    const desbordeAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    cerrar.current?.focus();

    function alPulsar(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        evento.preventDefault();
        cerrarCajon();
        return;
      }

      if (evento.key !== "Tab") return;

      // Trampa de foco: mientras el cajon esta abierto el tabulador no puede
      // salir de el, o se acabaria escribiendo a ciegas en la pagina de detras
      /*
       * Se descarta lo que este dentro de algo `inert`.
       *
       * Desde que los submenus se pliegan con un acordeon en vez de
       * desmontarse, sus enlaces siguen en el DOM y `querySelectorAll` los
       * devuelve: `inert` impide enfocarlos, pero no los borra de la
       * consulta. Si uno de ellos quedara el primero o el ultimo de la
       * lista, la trampa llamaria a `.focus()` sobre algo que no lo acepta y
       * el ciclo del tabulador se rompe sin aviso.
       */
      const focables = Array.from(
        cajon.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((elemento) => elemento.closest("[inert]") === null);

      if (focables.length === 0) return;

      const primero = focables[0];
      const ultimo = focables[focables.length - 1];
      const enFoco = document.activeElement;

      // Si el foco se habia escapado (la barra del navegador, por ejemplo),
      // el siguiente tabulador lo devuelve al cajon
      if (!cajon.current?.contains(enFoco)) {
        evento.preventDefault();
        (evento.shiftKey ? ultimo : primero).focus();
        return;
      }

      if (evento.shiftKey && enFoco === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && enFoco === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener("keydown", alPulsar);

    return () => {
      document.removeEventListener("keydown", alPulsar);
      document.body.style.overflow = desbordeAnterior;
    };
  }, [abierto]);

  function cerrarCajon() {
    setAbierto(false);
    // El foco vuelve al boton que lo abrio, que es donde estaba la atencion
    hamburguesa.current?.focus();
  }

  return (
    <>
      <header
        className={[
          "sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 lg:hidden",
          // El fondo va translucido con desenfoque: al desplazar, el contenido
          // pasa por detras en lugar de chocar contra una banda opaca.
          "border-b border-nav-borde bg-nav/85 px-3 text-nav-texto backdrop-blur-xl",
        ].join(" ")}
      >
        <button
          ref={hamburguesa}
          type="button"
          onClick={() => setAbierto(true)}
          aria-label="Abrir menu"
          aria-expanded={abierto}
          aria-controls={ID_CAJON}
          className={[
            "suave grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl",
            "bg-nav-realce text-nav-texto",
            "hover:bg-acento hover:text-acento-contraste",
          ].join(" ")}
        >
          <Menu aria-hidden="true" className="size-[21px]" />
        </button>

        {/*
          El nombre de la aplicacion sale del header movil: ya esta dentro del
          cajon, y en 360 px el sitio rinde mas dejandolo libre.
        */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {/*
            Notificaciones. Va deshabilitado a proposito hasta que exista el
            modulo: se muestra apagado y no responde al cursor, en lugar de
            ofrecer algo que no lleva a ningun sitio.
          */}
          <button
            type="button"
            disabled
            aria-label="Notificaciones (proximamente)"
            title="Notificaciones (proximamente)"
            className={[
              "grid size-11 shrink-0 place-items-center rounded-xl",
              "bg-nav-realce text-nav-suave opacity-45",
              "disabled:pointer-events-none disabled:cursor-not-allowed",
            ].join(" ")}
          >
            <Bell aria-hidden="true" className="size-[19px]" />
          </button>

          <span
            role="img"
            aria-label={`Sesion de ${nombreCompleto}`}
            className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-acento text-[13px] font-bold text-acento-contraste"
          >
            {usuario.fotoUrl ? (
              <Image
                src={usuario.fotoUrl}
                alt=""
                width={36}
                height={36}
                className="size-full object-cover"
              />
            ) : (
              <span aria-hidden="true">
                {iniciales(usuario.nombre, usuario.apellido)}
              </span>
            )}
          </span>
        </div>
      </header>

      <div
        inert={!abierto}
        className={[
          "fixed inset-0 z-50 overflow-hidden lg:hidden",
          abierto ? "" : "pointer-events-none",
        ].join(" ")}
      >
        <div
          aria-hidden="true"
          onClick={cerrarCajon}
          className={[
            "desliza absolute inset-0 bg-black/55",
            /*
             * Entrar y salir NO duran lo mismo, y esa es toda la diferencia.
             *
             * El velo aparece despacio, porque su trabajo es que la pagina se
             * hunda poco a poco y no que la tape de un golpe. Al cerrar se
             * retira antes: quien cierra ya decidio irse, y hacerle esperar la
             * misma cuenta se siente lento.
             *
             * Va un pelo por detras del panel al entrar, asi que el ojo sigue
             * al panel, que es lo que importa, y el velo solo acompana.
             */
            abierto
              ? "opacity-100 [--dur-desliza:620ms]"
              : "opacity-0 [--dur-desliza:380ms]",
          ].join(" ")}
        />

        <aside
          ref={cajon}
          id={ID_CAJON}
          aria-label="Menu principal"
          className={[
            // Igual que el sidebar: el cajon NO se desplaza, solo la lista de
            // modulos. Desplegando Hooks se iban de la vista la marca, el aspa
            // de cerrar y el pie con el perfil.
            "desliza absolute inset-y-0 left-0 flex w-[286px] flex-col overflow-hidden",
            "border-r border-nav-borde bg-nav pt-[22px] pb-[18px] text-nav-texto",
            "shadow-[12px_0_40px_rgb(4_4_4/0.35)]",
            // Anclado a la izquierda: entra desplazandose hacia la derecha y se
            // retira por donde vino. La visibilidad se apaga al final del
            // recorrido, no al principio, o el panel desapareceria de golpe
            // antes de terminar de salir.
            abierto
              ? "visible translate-x-0 [--dur-desliza:520ms]"
              : "invisible -translate-x-full [--dur-desliza:430ms]",
          ].join(" ")}
        >
          <div className="mx-4 flex shrink-0 items-center gap-[11px] px-1.5 pb-[22px]">
            <Marca tamano={30} className="shrink-0" />
            <span className="flex min-w-0 flex-col leading-none">
              <span className="text-[15px] font-bold tracking-[-0.015em]">
                Conejo App
              </span>
              <span className="mt-[5px] text-[9.5px] tracking-[0.1em] text-acento uppercase">
                El Conejo del Sombrero
              </span>
            </span>

            <button
              ref={cerrar}
              type="button"
              onClick={cerrarCajon}
              aria-label="Cerrar menu"
              className={[
                "suave ml-auto grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl",
                "bg-nav-realce text-nav-suave",
                "hover:bg-acento hover:text-acento-contraste",
              ].join(" ")}
            >
              <X aria-hidden="true" className="size-[17px]" />
            </button>
          </div>

          {/*
            Solo se desplaza la lista, igual que en el sidebar. `min-h-0` es lo
            que deja encoger a un hijo flexible por debajo de su contenido; sin
            el, el desbordamiento se escaparia al cajon entero.
          */}
          <div className="barra-fina min-h-0 flex-1 overflow-y-auto px-4">
            <p className="px-2.5 pt-3 pb-[7px] text-[9.5px] font-semibold tracking-[0.14em] text-nav-suave uppercase">
              General
            </p>

            <nav aria-label="Modulos" className="flex flex-col gap-[3px] pb-2">
              {modulos.map((modulo) => (
                <ItemNavegacion
                  key={modulo.href}
                  modulo={modulo}
                  ruta={ruta}
                  activo={activo}
                  medidas={MEDIDAS}
                  alNavegar={() => setAbierto(false)}
                />
              ))}
            </nav>
          </div>

          <div className="mx-4 shrink-0 border-t border-nav-borde pt-3.5">

            <form action={cerrarSesion}>
              <button
                type="submit"
                className={[
                  "suave flex min-h-12 w-full cursor-pointer items-center gap-[11px] rounded-xl px-3",
                  "text-[13.5px] font-medium text-nav-suave",
                  "hover:bg-acento-tenue hover:text-acento",
                ].join(" ")}
              >
                <LogOut aria-hidden="true" className="size-[18px] shrink-0" />
                Cerrar sesion
              </button>
            </form>
          </div>
        </aside>
      </div>
    </>
  );
}
