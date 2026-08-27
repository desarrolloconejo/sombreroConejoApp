"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { aplanar, type ModuloVista } from "@/lib/navegacion";

/**
 * Un item de la navegacion, que puede ser una hoja o un desplegable.
 *
 * Lo comparten la barra lateral y el cajon movil, que hasta ahora repetian el
 * mismo <Link> con dos juegos de medidas. Se extrajo al anadir el
 * anidamiento: mantener el abrir y cerrar en dos sitios habria terminado con
 * uno de los dos comportandose distinto.
 *
 * Las medidas siguen siendo distintas en cada sitio (el movil necesita 48 px
 * de objetivo tactil, el escritorio se conforma con 40), asi que entran como
 * props en lugar de cablearse aqui.
 */

export type MedidasItem = {
  /** Clases del item en reposo: alto, radio, tamano de letra. */
  base: string;
  /** Tamano del icono. */
  icono: string;
  /** Separacion entre hermanos. */
  hueco: string;

  /**
   * Las del submodulo, que NO son las del padre.
   *
   * Un hijo con la misma medida y la misma sangria que su padre se lee como
   * un hermano mas de la lista, no como algo que cuelga de el. Va mas
   * adentro, mas bajo y con la letra mas chica: las tres cosas juntas son lo
   * que dice "esto pertenece a lo de arriba".
   */
  hijo: string;
};

const ACTIVO = "bg-acento font-semibold text-acento-contraste";
const REPOSO = "suave font-medium text-nav-suave hover:bg-acento-tenue hover:text-acento";

/**
 * Un padre con un hijo activo NO se pinta como activo.
 *
 * Si lo hiciera habria dos cosas encendidas a la vez y dejaria de saberse
 * cual es la pagina. Se marca solo el texto, que basta para orientarse.
 */
const PADRE_ABIERTO = "suave font-semibold text-acento hover:bg-acento-tenue";

export function ItemNavegacion({
  modulo,
  ruta,
  activo,
  medidas,
  alNavegar,
}: {
  modulo: ModuloVista;
  ruta: string;

  /**
   * El modulo activo, ya resuelto sobre la lista ENTERA.
   *
   * Llega de fuera y no se calcula aqui porque la regla es "gana el prefijo
   * mas largo", y eso solo se puede decidir comparando a todos los candidatos
   * juntos: /dashboard es prefijo de /dashboard/hooks/auditor, asi que un
   * item que se mirase a si mismo encenderia Inicio ademas del submodulo.
   */
  activo: ModuloVista | null;

  medidas: MedidasItem;
  /** El cajon movil lo usa para cerrarse al navegar. */
  alNavegar?: () => void;
}) {
  const esActivo = activo?.href === modulo.href;
  const tieneActivo =
    activo !== null && aplanar([modulo]).some((m) => m.href === activo.href);

  /*
   * Arranca abierto si la pagina actual cuelga de este modulo, y se ajusta
   * durante el render en lugar de con un efecto: con useEffect, entrar
   * directo a /dashboard/hooks/auditor pintaria el desplegable cerrado un
   * fotograma y lo abriria despues, con el salto a la vista.
   */
  const [abierto, setAbierto] = useState(tieneActivo);
  const [rutaPintada, setRutaPintada] = useState(ruta);

  if (ruta !== rutaPintada) {
    setRutaPintada(ruta);
    if (tieneActivo) setAbierto(true);
  }

  const clases = [medidas.base, "[&_svg]:shrink-0", medidas.icono].join(" ");

  // --- hoja ---------------------------------------------------------------
  if (!modulo.hijos || modulo.hijos.length === 0) {
    return (
      <Link
        href={modulo.href}
        aria-current={esActivo ? "page" : undefined}
        onClick={alNavegar}
        className={[clases, esActivo ? ACTIVO : REPOSO].join(" ")}
      >
        {modulo.icono}
        {modulo.titulo}
      </Link>
    );
  }

  // --- desplegable --------------------------------------------------------
  const idLista = `submodulos-${modulo.href.replace(/\W+/g, "-")}`;

  return (
    <div className="flex flex-col">
      {/*
        El padre es enlace Y interruptor, no una cosa o la otra.

        Tiene pagina propia —la portada del modulo, con la pieza en curso y el
        recorrido—, asi que un padre que solo despliega la esconderia detras de
        un clic en un hijo. Y al reves: un padre que solo navega obligaria a
        entrar a la portada para poder abrir la lista.

        El chevron es un boton aparte, colocado encima del hueco que le deja el
        enlace. Anidar un boton dentro de un enlace es HTML invalido y en la
        practica el navegador se queda con uno de los dos comportamientos.
      */}
      {/* `group` para que pasar por el chevron realce la fila entera: son dos
          elementos, pero se leen como uno. */}
      <div className="group relative">
        <Link
          href={modulo.href}
          aria-current={esActivo ? "page" : undefined}
          onClick={alNavegar}
          className={[
            clases,
            esActivo ? ACTIVO : tieneActivo ? PADRE_ABIERTO : REPOSO,
            esActivo ? "" : "group-hover:bg-acento-tenue group-hover:text-acento",
          ].join(" ")}
        >
          {modulo.icono}
          <span className="min-w-0 flex-1 truncate">{modulo.titulo}</span>
          {/* El sitio del chevron: lo dibuja el boton de al lado. */}
          <span aria-hidden="true" className="size-4 shrink-0" />
        </Link>

        <button
          type="button"
          aria-expanded={abierto}
          aria-controls={idLista}
          aria-label={`${abierto ? "Contraer" : "Desplegar"} ${modulo.titulo}`}
          onClick={() => setAbierto((x) => !x)}
          className="absolute inset-y-0 right-0 grid w-10 cursor-pointer place-items-center"
        >
          <ChevronDown
            aria-hidden="true"
            className={["suave size-4", abierto ? "rotate-180" : ""].join(" ")}
          />
        </button>
      </div>

      {/*
        El desplegable se anima mediante grid-template-rows (0fr -> 1fr).
        No aparece ni desaparece de golpe: su ritmo y curva coinciden con
        el giro del chevron y los demas cambios de estado de la interfaz.
        El atributo inert={!abierto} y visibility:hidden garantizan que
        cerrado quede fuera del arbol de accesibilidad y del tabulador.
      */}
      <div
        id={idLista}
        inert={!abierto}
        aria-hidden={!abierto}
        className={[
          "despliega",
          abierto
            ? "grid-rows-[1fr] opacity-100 visible"
            : "grid-rows-[0fr] opacity-0 invisible pointer-events-none",
        ].join(" ")}
      >
        <div className="min-h-0 overflow-hidden">
          {/*
            Los hijos van en un BLOQUE PROPIO, no colgando de una linea.

            El trabajo que hay que hacer es el mismo —decir de un vistazo que
            estos seis pertenecen a lo de arriba— y un rail lo hacia con un
            solo pixel, que a media lista ya no se sabe de donde salia. Una
            superficie encajada lo dice de otra manera: lo que esta DENTRO de
            la caja cuelga del item que la precede, y eso se lee sin seguir
            ninguna guia con la vista.

            Ademas se sangra por dentro, asi que el texto del hijo cae mas
            adentro que el del padre y las dos senales se suman.
          */}
          <ul
            className={[
              "mt-1.5 ml-3 flex flex-col rounded-xl border border-nav-borde bg-nav-realce p-1.5",
              "transition-transform duration-300 ease-[var(--ease-suave)]",
              medidas.hueco,
              abierto ? "translate-y-0" : "-translate-y-1.5",
            ].join(" ")}
          >
            {modulo.hijos.map((hijo) => {
              const hijoActivo = activo?.href === hijo.href;

              return (
                <li key={hijo.href}>
                  <Link
                    href={hijo.href}
                    aria-current={hijoActivo ? "page" : undefined}
                    onClick={alNavegar}
                    className={[
                      medidas.hijo,
                      hijoActivo ? ACTIVO : REPOSO,
                    ].join(" ")}
                  >
                    {hijo.titulo}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
