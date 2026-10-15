import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { diaBrief, EtiquetaBrief, SECCION_BRIEF } from "@/components/briefs";
import { NuevoBrief } from "@/components/briefs/AccionesMisBriefs";
import { Wrapper } from "@/components/layout/Wrapper";
import { conSesion } from "@/lib/db";
import { formatoPor, formatosVigentes } from "@/lib/portal/briefs";
import { rutaMiBrief } from "@/lib/portal/rutas";
import { requerirEmpresa } from "@/lib/sesion";
import * as briefsModelo from "@/models/briefs";

export const metadata: Metadata = {
  title: "Mis briefs",
};

const MIGAS = [{ texto: "Conejo App", href: "/dashboard" }, { texto: "Mis briefs" }];

/**
 * Lo que la empresa le pide a la agencia por escrito. Cualquier persona de la
 * empresa empieza un brief, lo llena —entre varias si hace falta— y lo
 * envia; aqui ve en que punto esta cada uno.
 */
export default async function PaginaMisBriefs() {
  const { usuario } = await requerirEmpresa();

  const lista = await conSesion(usuario, (tx) => briefsModelo.listar({}, tx));
  const formatos = formatosVigentes();

  return (
    <Wrapper
      migas={MIGAS}
      kicker={usuario.empresaNombre ?? "Tu empresa"}
      titulo="Mis briefs"
      descripcion="Cuentanos que necesitas. Lo recibe tu ejecutivo y te responde con el siguiente paso."
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section aria-labelledby="titulo-lista" className="surge">
          <h2 id="titulo-lista" className="mb-3 text-[19px] font-extrabold tracking-[-0.02em]">
            Tus briefs
          </h2>
          <div className={SECCION_BRIEF}>
            {lista.length === 0 ? (
              <p className="text-[13px] leading-relaxed text-suave">
                Todavia no hay briefs. Empieza uno con el tipo de trabajo que necesitas.
              </p>
            ) : (
              <ul aria-label="Briefs de la empresa" className="-my-1 flex flex-col">
                {lista.map((brief) => (
                  <li key={brief.id} className="border-b border-borde last:border-0">
                    <Link
                      href={rutaMiBrief(brief.id)}
                      className="suave group -mx-2 flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-acento-tenue"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[11.5px] font-semibold tabular-nums text-suave">
                          {brief.codigo ?? "Sin enviar"}
                          {brief.versionActual > 1 ? ` · version ${brief.versionActual}` : ""}
                        </p>
                        <p className="truncate text-[14px] font-semibold">
                          {formatoPor(brief.formato, brief.formatoVersion)?.nombre ?? brief.formato}
                        </p>
                        <p className="mt-0.5 text-[12px] text-suave">
                          {brief.fechaPropuesta
                            ? `Te proponemos el ${diaBrief(brief.fechaPropuesta)}`
                            : brief.fechaAspirada
                              ? `Aspiras al ${diaBrief(brief.fechaAspirada)}`
                              : "Borrador: aun no tiene fecha"}
                        </p>
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

        <section aria-labelledby="titulo-nuevo" className="surge [--retraso:0.06s]">
          <h2 id="titulo-nuevo" className="mb-3 text-[19px] font-extrabold tracking-[-0.02em]">
            Pedir un trabajo
          </h2>
          <ul className="flex flex-col gap-3">
            {formatos.map((formato) => (
              <li key={formato.clave} className={SECCION_BRIEF}>
                <p className="text-[15px] font-bold">{formato.nombre}</p>
                {formato.lema && <p className="mt-0.5 text-[12.5px] text-suave">{formato.lema}</p>}
                <p className="mt-2 text-[12px] text-suave">Unos {formato.tiempoEstimadoMinutos} minutos. Se guarda solo.</p>
                <div className="mt-3.5">
                  <NuevoBrief formato={formato.clave} nombre={formato.nombre} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Wrapper>
  );
}
