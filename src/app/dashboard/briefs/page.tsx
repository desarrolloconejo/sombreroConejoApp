import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import {
  EnlacesProspectos,
  EtiquetaBrief,
  SECCION_BRIEF,
  type FilaEnlace,
} from "@/components/briefs";
import { Wrapper } from "@/components/layout/Wrapper";
import { conSesion } from "@/lib/db";
import { haceCuanto, ZONA_HORARIA } from "@/lib/fechas";
import { formatoPor, formatosVigentes } from "@/lib/portal/briefs";
import { rutaBrief } from "@/lib/portal/rutas";
import { requerirCargo } from "@/lib/sesion";
import * as briefsModelo from "@/models/briefs";
import * as enlacesModelo from "@/models/enlacesBrief";
import { NOMBRES_DE_ESTADO_BRIEF, type Brief, type EnlaceBrief } from "@/types";

export const metadata: Metadata = {
  title: "Briefs",
};

const RUTA = "/dashboard/briefs";

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
  return brief.versionActual > 1 ? "Version nueva: revisala y decide" : "Decide: proyecto, presupuesto o descarte";
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

/** Las tres bandejas. La URL dice cual se ve (`?ver=`); por defecto, lo que espera decision. */
const PESTANAS = [
  { clave: "decidir", titulo: "Por decidir", vacio: "Nada por decidir. Los briefs nuevos aparecen aqui." },
  { clave: "curso", titulo: "En curso", vacio: "Ningun brief en validacion ni en presupuesto." },
  { clave: "cerrados", titulo: "Cerrados", vacio: "Aqui quedan los validados y los descartados." },
] as const;

type ClavePestana = (typeof PESTANAS)[number]["clave"];

function comoPestana(valor: string | string[] | undefined): ClavePestana {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  return PESTANAS.find((p) => p.clave === texto)?.clave ?? "decidir";
}

/** Un dia del calendario, corto («14 nov»). En UTC para no correrlo al anterior. */
const DIA_CORTO = new Intl.DateTimeFormat("es-VE", { timeZone: "UTC", day: "numeric", month: "short" });

/** Los cerrados crecen sin fin: se muestran los ultimos. */
const MAXIMO_CERRADOS = 30;

function Pestanas({ activa, cuentas }: { activa: ClavePestana; cuentas: Record<ClavePestana, number> }) {
  return (
    <nav aria-label="Bandejas de briefs" className="surge mb-4">
      <ul className="grid grid-cols-3 gap-1 rounded-[14px] border border-borde bg-campo p-1 sm:inline-grid">
        {PESTANAS.map((pestana) => {
          const actual = pestana.clave === activa;
          return (
            <li key={pestana.clave}>
              <Link
                href={pestana.clave === "decidir" ? RUTA : `${RUTA}?ver=${pestana.clave}`}
                aria-current={actual ? "page" : undefined}
                scroll={false}
                className={[
                  "suave flex min-h-10 items-center justify-center gap-1.5 rounded-[10px] px-2 text-[13px] font-semibold whitespace-nowrap sm:gap-2 sm:px-3.5 sm:text-[13.5px]",
                  actual
                    ? "bg-acento text-acento-contraste shadow-[var(--sombra)]"
                    : "text-suave hover:-translate-y-0.5 hover:text-texto",
                ].join(" ")}
              >
                {pestana.titulo}
                <span
                  className={[
                    "min-w-6 rounded-full px-1.5 py-0.5 text-center text-[11.5px] font-bold tabular-nums",
                    actual ? "bg-acento-contraste/15" : "bg-superficie",
                  ].join(" ")}
                >
                  {cuentas[pestana.clave]}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Una fila de la bandeja. Se lee de arriba abajo: quien lo pide, que hay que
 * hacer con el y los datos de referencia. El codigo va al final y pequeno:
 * sirve para buscarlo, no para reconocerlo.
 */
function FilaBrief({ brief, pestana }: { brief: Brief; pestana: ClavePestana }) {
  const formato = formatoPor(brief.formato, brief.formatoVersion)?.nombre ?? brief.formato;
  const desde = pestana === "decidir" ? (brief.enviadoEn ?? brief.actualizadoEn) : brief.actualizadoEn;
  const referencia = [
    formato,
    brief.fechaAspirada ? `aspira al ${DIA_CORTO.format(new Date(`${brief.fechaAspirada}T00:00:00Z`))}` : null,
    brief.versionActual > 1 ? `version ${brief.versionActual}` : null,
  ].filter(Boolean);

  return (
    <li className="border-b border-borde last:border-0">
      <Link
        href={rutaBrief(brief.id)}
        className="suave -mx-2 flex items-start gap-3 rounded-xl px-2 py-3.5 hover:bg-acento-tenue sm:items-center"
      >
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="min-w-0 truncate text-[15px] font-bold text-texto">{brief.solicitante}</span>
            {brief.empresaId === null && (
              <span className="rounded-full border border-borde px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-suave">
                Prospecto
              </span>
            )}
          </p>
          <p className={["mt-1 text-[13px] font-semibold", pestana === "decidir" ? "text-acento" : "text-texto"].join(" ")}>
            {detalleDe(brief)}
          </p>
          <p className="mt-1 text-[12px] text-suave">
            {referencia.join(" · ")}
            {brief.codigo && <span className="ml-2 whitespace-nowrap tabular-nums opacity-80">{brief.codigo}</span>}
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-2 sm:hidden">
            {pestana !== "decidir" && <EtiquetaBrief estado={brief.estado} />}
            <span className="text-[12px] text-suave">{haceCuanto(desde)}</span>
          </p>
        </div>

        <div className="hidden shrink-0 flex-col items-end gap-1.5 text-right sm:flex">
          <span className="text-[12px] whitespace-nowrap text-suave">
            <span className="sr-only">{pestana === "decidir" ? "Recibido " : "Ultimo movimiento "}</span>
            {haceCuanto(desde)}
          </span>
          {pestana !== "decidir" && <EtiquetaBrief estado={brief.estado} />}
        </div>
        <ChevronRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-suave sm:mt-0" />
      </Link>
    </li>
  );
}

function Bandeja({ pestana, briefs, total }: { pestana: ClavePestana; briefs: Brief[]; total: number }) {
  const { titulo, vacio } = PESTANAS.find((p) => p.clave === pestana) ?? PESTANAS[0];
  return (
    <section aria-label={titulo} className={`surge [--retraso:0.04s] ${SECCION_BRIEF}`}>
      {briefs.length === 0 ? (
        <p className="py-2 text-[13px] text-suave">{vacio}</p>
      ) : (
        <>
          {pestana === "decidir" && (
            <p className="mb-1 text-[12px] text-suave">Primero los que mas llevan esperando.</p>
          )}
          <ul className="-my-1 flex flex-col">
            {briefs.map((brief) => (
              <FilaBrief key={brief.id} brief={brief} pestana={pestana} />
            ))}
          </ul>
          {total > briefs.length && (
            <p className="mt-3 border-t border-borde pt-3 text-[12px] text-suave">
              Se muestran los ultimos {briefs.length} de {total}.
            </p>
          )}
        </>
      )}
    </section>
  );
}

export default async function PaginaBriefs(props: PageProps<"/dashboard/briefs">) {
  const usuario = await requerirCargo("cuentas");
  const pestana = comoPestana((await props.searchParams).ver);

  const [lista, enlaces] = await conSesion(usuario, async (tx) => [
    await briefsModelo.listar({ sinBorradores: true }, tx),
    await enlacesModelo.listar(tx),
  ] as const);

  const recientes = (a: Brief, b: Brief) => b.actualizadoEn.getTime() - a.actualizadoEn.getTime();
  const llegada = (b: Brief) => (b.enviadoEn ?? b.actualizadoEn).getTime();
  const grupos: Record<ClavePestana, Brief[]> = {
    // Lo que espera decision, del que mas lleva esperando al mas nuevo.
    decidir: lista.filter(porDecidir).sort((a, b) => llegada(a) - llegada(b)),
    curso: lista
      .filter((b) => !porDecidir(b) && (b.estado === "en_validacion" || b.estado === "en_presupuesto"))
      .sort(recientes),
    cerrados: lista.filter((b) => b.estado === "aceptado" || b.estado === "descartado").sort(recientes),
  };
  const cuentas = { decidir: grupos.decidir.length, curso: grupos.curso.length, cerrados: grupos.cerrados.length };
  const visibles = pestana === "cerrados" ? grupos.cerrados.slice(0, MAXIMO_CERRADOS) : grupos[pestana];

  return (
    <Wrapper
      migas={MIGAS}
      kicker="Trabajo"
      titulo="Briefs"
      descripcion="Todo brief enviado entra aqui como fase 0. Tu decides su destino: proyecto, presupuesto o descarte."
    >
      <Pestanas activa={pestana} cuentas={cuentas} />
      <Bandeja pestana={pestana} briefs={visibles} total={cuentas[pestana]} />

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
