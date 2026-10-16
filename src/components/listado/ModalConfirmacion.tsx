import Link from "next/link";
import type { ReactNode } from "react";

import { BloquearScroll } from "./BloquearScroll";

/**
 * Dialogo centrado para confirmar una accion que cambia algo de golpe.
 *
 * Va aparte del panel lateral a proposito, y no por gusto visual. El panel es
 * para una TAREA: entras, rellenas, guardas. Esto es una PREGUNTA de si o no,
 * y las dos cosas piden formas distintas. Un panel para confirmar invita a
 * leerlo por encima y darle a guardar, que es justo lo que no debe pasar
 * cuando algo se desactiva.
 *
 * Se abre por la URL igual que el panel (?panel=estado&id=12), asi que es de
 * servidor entero: cerrar es un enlace que quita el parametro.
 */

const ANIMACION = `
@keyframes modal-entrar { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }
@keyframes modal-velo { from { opacity: 0 } to { opacity: 1 } }
.modal-caja { animation: modal-entrar .34s cubic-bezier(.32,.72,.24,1) both; }
.modal-velo { animation: modal-velo .34s ease both; }
@media (prefers-reduced-motion: reduce) {
  .modal-caja, .modal-velo { animation: none; }
}
`;

export function ModalConfirmacion({
  hrefCerrar,
  kicker,
  titulo,
  children,
  pie,
  tono = "normal",
  ancho = "normal",
  id = "modal-confirmacion",
}: {
  hrefCerrar: string;
  kicker?: string;
  titulo: string;
  children: ReactNode;
  /**
   * La banda de acciones. Es opcional porque cuando los botones tienen que
   * ser hijos de un <form> viven dentro del contenido, no aqui: es el mismo
   * motivo por el que el pie del panel lateral tampoco se impone.
   */
  pie?: ReactNode;

  /** "aviso" tine el kicker, para lo que apaga o retira algo. */
  tono?: "normal" | "aviso";
  /** «amplio» para elegir entre varias opciones explicadas, que necesitan aire. */
  ancho?: "normal" | "amplio";
  id?: string;
}) {
  const idTitulo = `${id}-titulo`;

  return (
    <>
      <style href="listado-modal" precedence="componentes">
        {ANIMACION}
      </style>

      <BloquearScroll />

      {/*
        El velo repite lo que ya hace el boton de cancelar y solo sirve al
        raton: se oculta al lector de pantalla para no anunciar dos salidas.
      */}
      <Link
        href={hrefCerrar}
        scroll={false}
        aria-hidden="true"
        tabIndex={-1}
        className="modal-velo fixed inset-0 z-40 bg-black/[0.45]"
      />

      {/*
        El contenedor ocupa la pantalla y centra la caja. Lleva el scroll por
        si el texto crece o la pantalla es muy baja: sin el, en horizontal en
        un movil los botones quedarian fuera y no habria forma de confirmar.
      */}
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={idTitulo}
          className={[
            "modal-caja w-full rounded-[17px] border border-borde",
            ancho === "amplio" ? "max-w-[520px]" : "max-w-[430px]",
            "bg-superficie shadow-[var(--sombra-alta)]",
          ].join(" ")}
        >
          <div className="px-6 pt-[26px] pb-1">
            {kicker && (
              <p
                className={[
                  "mb-[5px] text-[12.5px] font-bold",
                  tono === "aviso" ? "text-blackberry dark-tema:text-[#e9a9cd]" : "text-acento",
                ].join(" ")}
              >
                {kicker}
              </p>
            )}

            <h2
              id={idTitulo}
              className="text-[22px] leading-tight font-extrabold tracking-[-0.025em]"
            >
              {titulo}
            </h2>
          </div>

          <div className="px-6 pt-3 pb-6 text-[13px] leading-relaxed text-suave">
            {children}
          </div>

          {pie && (
            <div className="flex flex-wrap justify-end gap-2.5 border-t border-borde px-6 py-[18px]">
              {pie}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
