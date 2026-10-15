import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import {
  cuandoBrief,
  diaBrief,
  EnlacesProspectos,
  EtiquetaBrief,
  SECCION_BRIEF,
  type FilaEnlace,
} from "@/components/briefs";
import { Wrapper } from "@/components/layout/Wrapper";
import { conSesion } from "@/lib/db";
import { ZONA_HORARIA } from "@/lib/fechas";
import { formatoPor, formatosVigentes } from "@/lib/portal/briefs";
import { rutaBrief } from "@/lib/portal/rutas";
import { requerirCargo } from "@/lib/sesion";
import * as briefsModelo from "@/models/briefs";
import * as enlacesModelo from "@/models/enlacesBrief";
import { NOMBRES_DE_ESTADO_BRIEF, type Brief, type EnlaceBrief } from "@/types";

export const metadata: Metadata = {
  title: "Briefs",
};

const MIGAS = [{ texto: "Conejo App", href: "/dashboard" }, { texto: "Briefs" }];

/**
 * La bandeja de briefs: todo brief enviado entra aqui como «fase 0», y quien
 * atiende la empresa decide su destino. El ejecutivo ve los de sus empresas y
 * los de los prospectos que invito; el admin, todos. Lo decide la base.
 */

/** Lo que espera una decision: recien llegado, o con su presupuesto resuelto. */
function porDecidir(brief: Brief): boolean {
  return (
    brief.estado === "enviado" ||
    (brief.estado === "en_presupuesto" &&
      (brief.presupuestoEstado === "aprobado" ||
        brief.presupuestoEstado === "rechazado" ||
        brief.presupuestoVencido))
  );
}

function detalleDe(brief: Brief): string {
  if (brief.estado === "en_presupuesto") {
    if (brief.presupuestoEstado === "aprobado") return "Presupuesto aprobado: abre el proyecto";
    if (brief.presupuestoEstado === "rechazado" || brief.presupuestoVencido) {
      return "Presupuesto rechazado o vencido: decide de nuevo";
    }
    return brief.presupuestoId ? "Presupuesto enviado al cliente" : "Esperando su presupuesto";
  }
  if (brief.estado === "en_validacion") return "Proyecto abierto: falta validar el brief";
  if (brief.estado === "descartado") return "Descartado";
  if (brief.estado === "aceptado") return "Validado";
  return `Aspira al ${diaBrief(brief.fechaAspirada)}`;
}

const DIA = new Intl.DateTimeFormat("es-VE", {
  timeZone: ZONA_HORARIA,
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

function comoFila(enlace: EnlaceBrief): FilaEnlace {
  return {
    id: enlace.id,
    empresaNombre: enlace.empresaNombre,
    contactoNombre: enlace.contactoNombre,
    email: enlace.email,
    formatoNombre: formatoPor(enlace.formato, enlace.formatoVersion)?.nombre ?? enlace.formato,
    estado: enlace.revocadoEn ? "revocado" : enlace.vigente ? "vigente" : "vencido",
    vence: DIA.format(enlace.venceEn),
    briefId: enlace.briefId,
    briefRuta: enlace.briefId !== null && enlace.briefEstado !== "borrador" ? rutaBrief(enlace.briefId) : null,
    briefEstado: enlace.briefEstado ? NOMBRES_DE_ESTADO_BRIEF[enlace.briefEstado] : null,
  };
}

function Grupo({ titulo, briefs, vacio }: { titulo: string; briefs: Brief[]; vacio: string }) {
  return (
    <section aria-label={titulo} className="surge">
      <h2 className="mb-3 text-[19px] font-extrabold tracking-[-0.02em]">
        {titulo}
        <span className="ml-2 text-[14px] font-semibold text-suave">{briefs.length}</span>
      </h2>
      <div className={SECCION_BRIEF}>
        {briefs.length === 0 ? (
          <p className="text-[13px] text-suave">{vacio}</p>
        ) : (
          <ul className="-my-1 flex flex-col">
            {briefs.map((brief) => (
              <li key={brief.id} className="border-b border-borde last:border-0">
                <Link
                  href={rutaBrief(brief.id)}
                  className="suave -mx-2 flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-acento-tenue"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[11.5px] font-semibold tabular-nums text-acento">
                      {brief.codigo}
                      {brief.versionActual > 1 ? ` · version ${brief.versionActual}` : ""}
                      {brief.empresaId === null ? " · prospecto" : ""}
                    </p>
                    <p className="truncate text-[14px] font-bold">{brief.solicitante}</p>
                    <p className="mt-0.5 text-[12px] text-suave">
                      {formatoPor(brief.formato, brief.formatoVersion)?.nombre ?? brief.formato} · enviado{" "}
                      {cuandoBrief(brief.enviadoEn)}
                    </p>
                    <p className="mt-0.5 text-[12px] font-semibold">{detalleDe(brief)}</p>
                  </div>
                  <EtiquetaBrief estado={brief.estado} />
                  <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-suave" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default async function PaginaBriefs() {
  const usuario = await requerirCargo("cuentas");

  const [lista, enlaces] = await conSesion(usuario, async (tx) => [
    await briefsModelo.listar({ sinBorradores: true }, tx),
    await enlacesModelo.listar(tx),
  ] as const);

  const decidir = lista.filter(porDecidir);
  const enCurso = lista.filter((b) => !porDecidir(b) && (b.estado === "en_validacion" || b.estado === "en_presupuesto"));
  const cerrados = lista.filter((b) => b.estado === "aceptado" || b.estado === "descartado");

  return (
    <Wrapper
      migas={MIGAS}
      kicker="Trabajo"
      titulo="Briefs"
      descripcion="Todo brief enviado entra aqui como fase 0. Tu decides su destino: proyecto, presupuesto o descarte."
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <Grupo titulo="Por decidir" briefs={decidir} vacio="Nada por decidir. Los briefs nuevos aparecen aqui." />
        <div className="flex flex-col gap-6">
          <Grupo titulo="En curso" briefs={enCurso} vacio="Ningun brief en validacion ni en presupuesto." />
          <Grupo titulo="Cerrados" briefs={cerrados} vacio="Aqui quedan los validados y los descartados." />
        </div>
      </div>

      <section aria-labelledby="titulo-enlaces" className="surge mt-6 [--retraso:0.08s]">
        <h2 id="titulo-enlaces" className="mb-1 text-[19px] font-extrabold tracking-[-0.02em]">
          Enlaces para prospectos
        </h2>
        <p className="mb-3 text-[13px] text-suave">
          Para quien aun no es cliente: llena su brief por un enlace privado, sin cuenta. Al aceptarlo se convierte en
          cliente.
        </p>
        <div className={SECCION_BRIEF}>
          <EnlacesProspectos
            enlaces={enlaces.map(comoFila)}
            formatos={formatosVigentes().map((f) => ({ clave: f.clave, nombre: f.nombre }))}
          />
        </div>
      </section>
    </Wrapper>
  );
}
