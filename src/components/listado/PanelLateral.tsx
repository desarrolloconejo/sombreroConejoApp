import Link from "next/link";
import { X } from "lucide-react";

import { BloquearScroll } from "./BloquearScroll";
import type { ReactNode } from "react";

/**
 * Panel deslizante para crear o editar, comun a todos los modulos.
 *
 * Se abre con la URL (?panel=nuevo, ?panel=editar&id=12), asi que es de
 * servidor: el velo y el aspa son enlaces que quitan ese parametro. El modulo
 * solo aporta el contenido del formulario y las acciones del pie.
 *
 * La page decide si montarlo. Este componente asume que, si se renderiza, esta
 * abierto.
 */

/**
 * La animacion de entrada no puede vivir en globals.css: el panel es la unica
 * pieza que la usa. React 19 sube este <style> al head y lo deduplica por
 * `href`, asi que da igual cuantos paneles se rendericen.
 */
const ANIMACION = `
@keyframes panel-deslizar { from { transform: translateX(100%); } to { transform: none; } }
@keyframes panel-aparecer { from { opacity: 0; } to { opacity: 1; } }
.panel-deslizar { animation: panel-deslizar .3s cubic-bezier(.22,.9,.28,1) both; }
.panel-velo { animation: panel-aparecer .3s ease both; }
@media (prefers-reduced-motion: reduce) {
  .panel-deslizar, .panel-velo { animation: none; }
}
`;

export function PanelLateral({
  hrefCerrar,
  kicker,
  titulo,
  descripcion,
  children,
  pie,
  id = "panel-lateral",
}: {
  hrefCerrar: string;
  kicker?: string;
  titulo: string;
  descripcion?: string;
  children: ReactNode;
  pie?: ReactNode;
  id?: string;
}) {
  const idTitulo = `${id}-titulo`;

  return (
    <>
      <style href="listado-panel-lateral" precedence="componentes">
        {ANIMACION}
      </style>

      {/*
        El velo repite lo que ya hace el aspa, y solo sirve al raton. Se oculta
        al lector de pantalla para no anunciar dos veces la misma salida.
      */}
      <BloquearScroll />

      <Link
        href={hrefCerrar}
        scroll={false}
        aria-hidden="true"
        tabIndex={-1}
        className="panel-velo fixed inset-0 z-40 bg-black/[0.42]"
      />

      <aside
        aria-labelledby={idTitulo}
        className={[
          "panel-deslizar fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col",
          "border-l border-borde bg-superficie",
          "shadow-[-18px_0_50px_rgb(5_26_42_/_0.16)]",
        ].join(" ")}
      >
        <div className="relative shrink-0 border-b border-borde px-6 pb-5 pt-6">
          {kicker && (
            <p className="mb-[5px] pr-12 text-[12.5px] font-bold text-acento">
              {kicker}
            </p>
          )}

          <h2
            id={idTitulo}
            className="pr-12 text-[25px] font-extrabold leading-tight tracking-[-0.025em]"
          >
            {titulo}
          </h2>

          {descripcion && (
            <p className="mt-[7px] text-[12.5px] leading-relaxed text-suave">
              {descripcion}
            </p>
          )}

          <Link
            href={hrefCerrar}
            scroll={false}
            aria-label="Cerrar el panel"
            title="Cerrar"
            className={[
              "absolute right-5 top-5 grid size-11 place-items-center rounded-xl",
              "border border-borde text-suave",
              "  ",
              "suave hover:border-acento hover:bg-acento hover:text-acento-contraste",
              "",
            ].join(" ")}
          >
            <X aria-hidden="true" className="size-4" />
          </Link>
        </div>

        {/*
          El hijo recibe el hueco entero y lo reparte con PanelCuerpo y PanelPie.
          No se le impone el scroll aqui porque el boton de enviar tiene que ser
          hijo del <form>, y con el scroll puesto en este nivel el pie acababa
          dentro del area desplazable, con contenido asomando por debajo.
        */}
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>

        {pie && <PanelPie>{pie}</PanelPie>}
      </aside>
    </>
  );
}

/**
 * Separador con rotulo dentro del panel. Agrupa el formulario en tramos
 * ("Datos de la persona", "Rol dentro de la agencia") sin anadir cajas.
 */
export function SeparadorPanel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 mt-[22px] flex items-center gap-3 text-[10.5px] font-bold uppercase tracking-[0.12em] text-suave first:mt-0">
      {children}
      <span aria-hidden="true" className="h-px flex-1 bg-borde" />
    </p>
  );
}

/**
 * El cuerpo desplazable del panel.
 *
 * `overscroll-contain` corta el encadenado: al llegar al final, la rueda deja
 * de mover la pagina de detras en lugar de seguir arrastrandola.
 */
export function PanelCuerpo({ children }: { children: ReactNode }) {
  return (
    <div className="barra-fina min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
      {children}
    </div>
  );
}

/** La banda de acciones, siempre pegada al fondo del panel. */
export function PanelPie({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-wrap justify-end gap-2.5 border-t border-borde bg-superficie px-6 py-[18px]">
      {children}
    </div>
  );
}
