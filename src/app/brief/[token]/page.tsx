import type { Metadata } from "next";
import { Link2Off } from "lucide-react";

import {
  abrirVersionPorEnlace,
  aclararPorEnlace,
  empezarBriefPorEnlace,
  enviarPorEnlace,
  guardarPorEnlace,
} from "@/actions/enlaceBrief";
import { BriefEnviado, EmpezarPorEnlace, FormularioBrief, ProveedorEnvioBrief, SECCION_BRIEF } from "@/components/briefs";
import { Marca } from "@/components/layout/Marca";
import { ProveedorAvisos } from "@/components/layout/ProveedorAvisos";
import { conEnlace } from "@/lib/db";
import { formatoPor } from "@/lib/portal/briefs";
import { enlaceValido } from "@/lib/portal/enlaceBrief";
import { hoyEnCaracas } from "@/lib/portal/fases";
import * as briefsModelo from "@/models/briefs";
import * as enlacesModelo from "@/models/enlacesBrief";

/**
 * El brief de un prospecto, por su enlace privado (S-05). Publica: quien
 * llega no tiene cuenta, y la guardia es el token (`enlaceValido`). Con el,
 * la base le deja su brief y nada mas (`conEnlace`).
 *
 * Sin `referrer`: el token va en la ruta, y no debe viajar a ningun sitio que
 * se abra desde aqui.
 */
export const metadata: Metadata = {
  title: "Tu brief",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <ProveedorAvisos>
      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
        <div className="surge mb-8 flex items-center gap-[11px]">
          <Marca tamano={32} className="shrink-0" />
          <b className="text-base font-bold tracking-[-0.015em]">El Conejo del Sombrero</b>
        </div>
        {children}
      </main>
    </ProveedorAvisos>
  );
}

function Encabezado({ kicker, titulo, descripcion }: { kicker: string; titulo: string; descripcion: string }) {
  return (
    <header className="surge mb-7">
      <p className="text-[13px] font-bold text-acento">{kicker}</p>
      <h1 className="mt-1.5 text-[27px] leading-[1.08] font-extrabold tracking-[-0.03em] text-balance sm:text-4xl">
        {titulo}
      </h1>
      <p className="mt-3 max-w-[60ch] text-[13.5px] leading-[1.6] text-pretty text-suave">{descripcion}</p>
    </header>
  );
}

export default async function PaginaBriefPorEnlace(props: PageProps<"/brief/[token]">) {
  const { token } = await props.params;
  const enlace = await enlaceValido(token);
  const formato = enlace ? formatoPor(enlace.formato, enlace.formatoVersion) : null;

  // Vencido, revocado o inexistente: el mismo mensaje para los tres.
  if (!enlace || !formato) {
    return (
      <Marco>
        <div className="surge mx-auto mt-10 flex max-w-[520px] flex-col items-center text-center">
          <span
            aria-hidden="true"
            className="grid size-12 place-items-center rounded-full bg-acento text-acento-contraste [&>svg]:size-[22px]"
          >
            <Link2Off />
          </span>
          <h1 className="mt-5 text-[27px] leading-[1.08] font-extrabold tracking-[-0.03em]">
            Este enlace ya no es valido
          </h1>
          <p className="mt-3 text-[13.5px] leading-[1.6] text-suave">
            Puede que haya vencido o que se haya retirado. Pide uno nuevo a tu ejecutivo de cuentas en El Conejo del
            Sombrero.
          </p>
        </div>
      </Marco>
    );
  }

  const datos = await conEnlace(enlace.id, async (tx) => {
    const prospecto = await enlacesModelo.prospectoDe(enlace.id, tx);
    const id = await briefsModelo.deEnlace(enlace.id, tx);
    const brief = id !== null ? await briefsModelo.buscarPorId(id, tx) : null;
    if (!brief) return { prospecto, brief: null, borrador: null, versiones: [], aclaraciones: [] };

    return {
      prospecto,
      brief,
      borrador: brief.borradorAbierto ? await briefsModelo.borradorDe(brief.id, tx) : null,
      versiones: await briefsModelo.versionesDe(brief.id, tx),
      aclaraciones: await briefsModelo.aclaracionesDe(brief.id, tx),
    };
  });

  const { prospecto, brief, borrador, versiones, aclaraciones } = datos;
  const hola = prospecto ? `Hola, ${prospecto.contactoNombre}` : "Hola";

  if (!brief) {
    return (
      <Marco>
        <Encabezado kicker={hola} titulo={formato.nombre} descripcion={formato.lema ?? ""} />
        <div className={`${SECCION_BRIEF} surge max-w-[640px] [--retraso:0.06s]`}>
          <p className="text-[13.5px] leading-[1.6]">
            Te invitamos a contarnos tu proyecto. Son unos pasos cortos: lo que ya sabemos de ti viene precargado, y
            puedes guardar y volver con este mismo enlace mientras siga vigente.
          </p>
          <div className="mt-5">
            <EmpezarPorEnlace accion={empezarBriefPorEnlace.bind(null, token)} />
          </div>
        </div>
      </Marco>
    );
  }

  return (
    <Marco>
      <Encabezado
        kicker={brief.codigo ? `${hola} · Brief ${brief.codigo}` : hola}
        titulo={formato.nombre}
        descripcion={formato.lema ?? ""}
      />
      <ProveedorEnvioBrief accion={enviarPorEnlace.bind(null, token)}>
        {borrador ? (
          <FormularioBrief
            briefId={brief.id}
            formato={formato}
            iniciales={borrador.respuestas}
            fechaInicial={borrador.fechaAspirada}
            hoy={hoyEnCaracas()}
            version={brief.versionActual + 1}
            guardar={guardarPorEnlace.bind(null, token)}
          />
        ) : (
          <BriefEnviado
            brief={brief}
            ultima={versiones.at(-1)}
            aclaraciones={aclaraciones}
            aclarar={aclararPorEnlace.bind(null, token)}
            abrirVersion={abrirVersionPorEnlace.bind(null, token)}
            rutaProyecto={null}
          />
        )}
      </ProveedorEnvioBrief>
    </Marco>
  );
}
