import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { aclararMiBrief, enviarMiBrief, guardarMiBrief } from "@/actions/misBriefs";
import { BriefEnviado, FormularioBrief, ProveedorEnvioBrief } from "@/components/briefs";
import { Wrapper } from "@/components/layout/Wrapper";
import { conSesion } from "@/lib/db";
import { formatoPor } from "@/lib/portal/briefs";
import { hoyEnCaracas } from "@/lib/portal/fases";
import { RUTA_MIS_BRIEFS, rutaMiProyecto } from "@/lib/portal/rutas";
import { requerirEmpresa } from "@/lib/sesion";
import { comoIdentificador } from "@/lib/validaciones";
import * as briefsModelo from "@/models/briefs";

export const metadata: Metadata = {
  title: "Brief",
};

/**
 * Un brief de la empresa. Con un borrador abierto es su formulario; si no, lo
 * enviado tal como se congelo, sus fechas y el hilo con el equipo.
 */
export default async function PaginaMiBrief(props: PageProps<"/dashboard/mis-briefs/[id]">) {
  const { usuario } = await requerirEmpresa();

  const id = comoIdentificador((await props.params).id);
  if (id === null) notFound();

  const datos = await conSesion(usuario, async (tx) => {
    const brief = await briefsModelo.buscarPorId(id, tx);
    if (!brief) return null;

    return {
      brief,
      borrador: brief.borradorAbierto ? await briefsModelo.borradorDe(id, tx) : null,
      versiones: await briefsModelo.versionesDe(id, tx),
      aclaraciones: await briefsModelo.aclaracionesDe(id, tx),
    };
  });

  if (!datos) notFound();

  const { brief, borrador, versiones, aclaraciones } = datos;
  const formato = formatoPor(brief.formato, brief.formatoVersion);
  if (!formato) notFound();

  const migas = [
    { texto: "Conejo App", href: "/dashboard" },
    { texto: "Mis briefs", href: RUTA_MIS_BRIEFS },
    { texto: brief.codigo ?? "Borrador" },
  ];

  return (
    <Wrapper
      migas={migas}
      kicker={brief.codigo ? `Brief ${brief.codigo}` : "Borrador"}
      titulo={formato.nombre}
      descripcion={formato.lema}
    >
      <ProveedorEnvioBrief accion={enviarMiBrief}>
        {borrador ? (
          <FormularioBrief
            briefId={brief.id}
            formato={formato}
            iniciales={borrador.respuestas}
            fechaInicial={borrador.fechaAspirada}
            hoy={hoyEnCaracas()}
            version={brief.versionActual + 1}
            guardar={guardarMiBrief}
          />
        ) : (
          <BriefEnviado
            brief={brief}
            ultima={versiones.at(-1)}
            aclaraciones={aclaraciones}
            aclarar={aclararMiBrief}
            rutaProyecto={brief.proyectoId !== null ? rutaMiProyecto(brief.proyectoId) : null}
          />
        )}
      </ProveedorEnvioBrief>
    </Wrapper>
  );
}
