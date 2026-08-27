import { Shield } from "lucide-react";
import { Marca } from "@/components/layout/Marca";
import type { CSSProperties } from "react";

/**
 * El panel de marca del login.
 *
 * Es el mismo bloque en las dos formas del diseno: a la izquierda ocupando el
 * 38% en escritorio, con topes para que ni se coma el formulario en una
 * pantalla ancha ni se estrangule en una estrecha, y arriba como cabecera recortada en curva en movil. Se
 * resuelve con un solo arbol y clases responsivas para que las dos versiones
 * no se separen con el tiempo.
 *
 * En escritorio la rejilla de tres filas (logo, lema, sello) hace que el lema
 * quede centrado en el hueco sobrante y no repartido a partes iguales.
 *
 * OJO con los max-width: van en cada hijo, nunca en el contenedor. La unidad
 * ch se resuelve contra el font-size del elemento que la declara, y el
 * contenedor hereda 16 px: puesto ahi, el titular de 46 px quedaba partido
 * dentro de unos 190 px, en lineas de dos palabras.
 */

/** Halo dorado de la esquina superior derecha, en su medida de movil. */
const HALO_MOVIL: CSSProperties = {
  background:
    "radial-gradient(circle, rgb(250 232 144 / 0.15) 0%, rgb(250 232 144 / 0) 70%)",
};

/** El mismo halo en escritorio: mas grande y algo mas tenue. */
const HALO_ESCRITORIO: CSSProperties = {
  background:
    "radial-gradient(circle, rgb(250 232 144 / 0.13) 0%, rgb(250 232 144 / 0) 68%)",
};

/** Contrapeso en blackberry abajo a la izquierda. Solo en escritorio. */
const HALO_BLACKBERRY: CSSProperties = {
  background:
    "radial-gradient(circle, rgb(96 34 73 / 0.42) 0%, rgb(96 34 73 / 0) 70%)",
};

/** Trama de fondo apenas perceptible que da textura al navy. */
const REJILLA: CSSProperties = {
  backgroundImage:
    "linear-gradient(rgb(255 255 255 / 0.032) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.032) 1px, transparent 1px)",
  backgroundSize: "56px 56px",
};

function retraso(segundos: string): CSSProperties {
  return { "--retraso": segundos } as CSSProperties;
}

export function PanelMarca() {
  return (
    <section
      /*
       * Este panel se queda navy en los DOS temas: es superficie de marca, no
       * cromo de la aplicacion, y en claro un panel blanco junto a un
       * formulario blanco borraria la division de la pantalla.
       *
       * Como el fondo no cambia, el acento tampoco puede cambiar: aqui se fija
       * a dorado, que es la pareja legal sobre azul. Sin esto el kicker salia
       * morado sobre navy, oscuro sobre oscuro.
       */
      style={
        {
          "--acento": "#fae890",
          "--acento-contraste": "#051a2a",
        } as CSSProperties
      }
      className={
        "relative shrink-0 overflow-hidden rounded-b-[30px] bg-navy px-[26px] pt-[30px] pb-[42px] text-white " +
        "lg:grid lg:w-[34%] lg:max-w-[540px] lg:min-w-[380px] lg:grid-rows-[auto_1fr_auto] " +
        "lg:rounded-none lg:px-12 lg:py-[52px] xl:px-14"
      }
    >
      <div
        aria-hidden="true"
        style={HALO_MOVIL}
        className="pointer-events-none absolute -top-[130px] -right-[120px] size-[320px] rounded-full lg:hidden"
      />
      <div
        aria-hidden="true"
        style={HALO_ESCRITORIO}
        className="pointer-events-none absolute -top-[140px] -right-[190px] hidden size-[560px] rounded-full lg:block"
      />
      <div
        aria-hidden="true"
        style={HALO_BLACKBERRY}
        className="pointer-events-none absolute -bottom-[170px] -left-[160px] hidden size-[460px] rounded-full lg:block"
      />
      <div
        aria-hidden="true"
        style={REJILLA}
        className="pointer-events-none absolute inset-0 hidden opacity-50 lg:block"
      />

      {/* El alto minimo de 44 px alinea el logo con el conmutador de tema,
          que flota a esta misma altura desde el otro panel. */}
      <div className="surge relative flex min-h-11 items-center gap-[11px] lg:min-h-0 lg:gap-[13px]">
        <Marca tamano={32} className="shrink-0 lg:size-10" />
        <b className="text-base font-bold tracking-[-0.015em] lg:text-[19px]">
          Conejo App
        </b>
      </div>

      <div
        style={retraso("0.1s")}
        className="surge relative mt-[30px] lg:mt-0 lg:self-center"
      >
        <p className="m-0 mb-2.5 text-[12.5px] font-bold text-acento lg:mb-4 lg:text-[15px] lg:tracking-[0.01em]">
          El Conejo del Sombrero
        </p>
        <h2 className="m-0 max-w-[11ch] text-[29px] leading-[1.1] font-extrabold text-balance tracking-[-0.03em] lg:max-w-[13ch] lg:text-[42px] lg:leading-[1.08] lg:tracking-[-0.035em]">
          Todo el dia a dia, en un solo sitio.
        </h2>
        <p className="mt-6 hidden max-w-[34ch] text-[14.5px] leading-[1.7] text-pretty text-white/[0.62] lg:block">
          La plataforma interna donde el equipo y los clientes de la agencia
          siguen cada proceso sin perder el hilo.
        </p>
      </div>

      <p
        style={retraso("0.18s")}
        className="surge relative m-0 hidden items-center gap-2.5 text-xs text-white/[0.45] lg:flex"
      >
        <Shield aria-hidden="true" className="size-[15px] shrink-0" />
        Acceso restringido al personal y clientes de la agencia
      </p>
    </section>
  );
}
