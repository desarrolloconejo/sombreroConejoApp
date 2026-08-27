import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * Boton de la marca.
 *
 * Reglas del contrato que estan cableadas aqui para no repetirlas:
 * en reposo va oscuro, al pasar por encima aclara, y el movimiento es SIEMPRE
 * en el eje Y, nunca escala. En tema oscuro el primario pasa a dorado sobre
 * navy, que es el unico sitio donde el dorado es legal.
 */

export type VarianteBoton = "primario" | "fantasma" | "peligro";
export type TamanoBoton = "normal" | "chico";

const BASE =
  "inline-flex items-center justify-center gap-2.5 rounded-xl font-semibold " +
  "cursor-pointer border " +
  /*
   * El boton no se desplaza ni escala al pasar el cursor: lo unico que cambia
   * es el color, y lo hace despacio. `suave` pone ese ritmo.
   */
  "suave " +
  "disabled:opacity-55 disabled:pointer-events-none " +
  "[&>svg]:size-[17px] [&>svg]:shrink-0";

const VARIANTES: Record<VarianteBoton, string> = {
  /*
   * El primario ES el acento, asi que su hover no puede volver a serlo: sube
   * al escalon siguiente. En claro eso es la progresion de la marca, de
   * blackberry a violet; en oscuro aclara hacia blanco.
   */
  primario:
    "border-transparent bg-acento text-acento-contraste " +
    "hover:bg-acento-hover " +
    "active:bg-acento-hover",

  fantasma:
    "border-borde bg-transparent text-texto " +
    "hover:border-acento hover:bg-acento hover:text-acento-contraste " +
    "active:border-acento-hover active:bg-acento-hover",

  /*
   * El peligro NO sigue el acento: en oscuro el acento es dorado, y un boton
   * dorado para cerrar sesion diria justo lo contrario de lo que hace. Se
   * queda en blackberry, aclarado en oscuro para que contraste sobre navy.
   */
  peligro:
    "border-blackberry/40 bg-transparent text-blackberry " +
    "hover:border-blackberry hover:bg-blackberry hover:text-white " +
    "active:border-violet active:bg-violet " +
    "dark-tema:border-[#e9a9cd]/35 dark-tema:text-[#e9a9cd] " +
    "dark-tema:hover:text-white",
};

const TAMANOS: Record<TamanoBoton, string> = {
  // 44 px de alto: el minimo para tocar con el pulgar sin fallar
  normal: "min-h-11 px-5 py-3 text-[13.5px]",
  chico: "min-h-10 px-4 py-2.5 text-[12.5px]",
};

function clases(
  variante: VarianteBoton,
  tamano: TamanoBoton,
  extra?: string,
): string {
  return [BASE, VARIANTES[variante], TAMANOS[tamano], extra]
    .filter(Boolean)
    .join(" ");
}

type PropiedadesComunes = {
  variante?: VarianteBoton;
  tamano?: TamanoBoton;
  children: ReactNode;
  className?: string;
};

export function Boton({
  variante = "primario",
  tamano = "normal",
  className,
  children,
  ...resto
}: PropiedadesComunes & Omit<ComponentProps<"button">, "className" | "children">) {
  return (
    <button className={clases(variante, tamano, className)} {...resto}>
      {children}
    </button>
  );
}

/** Mismo aspecto que Boton, pero navega. Para acciones que son un enlace. */
export function BotonEnlace({
  variante = "primario",
  tamano = "normal",
  className,
  children,
  ...resto
}: PropiedadesComunes & Omit<ComponentProps<typeof Link>, "className" | "children">) {
  return (
    <Link className={clases(variante, tamano, className)} {...resto}>
      {children}
    </Link>
  );
}

/** Boton cuadrado que solo contiene un icono. Exige nombre accesible. */
export function BotonIcono({
  etiqueta,
  className,
  children,
  ...resto
}: {
  etiqueta: string;
  className?: string;
  children: ReactNode;
} & Omit<ComponentProps<"button">, "className" | "children" | "aria-label">) {
  return (
    <button
      aria-label={etiqueta}
      title={etiqueta}
      className={[
        "suave relative grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl",
        "border border-borde bg-transparent text-suave",
        "hover:border-acento hover:bg-acento hover:text-acento-contraste",
        /*
         * Un boton deshabilitado NO debe reaccionar al cursor.
         *
         * Sin `pointer-events-none` el hover se aplicaba igual, y como encima
         * iba con opacidad reducida, el acento salia lavado: ese gris sucio
         * que se veia en los tres puntos del listado. Ademas prometia una
         * accion que el boton no hace.
         */
        "disabled:pointer-events-none disabled:cursor-not-allowed",
        "[&>svg]:size-[18px]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...resto}
    >
      {children}
    </button>
  );
}
