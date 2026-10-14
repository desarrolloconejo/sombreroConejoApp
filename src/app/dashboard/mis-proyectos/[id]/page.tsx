import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Wrapper } from "@/components/layout/Wrapper";
import { PiezasCliente } from "@/components/misProyectos";
import { fechaCorta } from "@/components/proyectos";
import { Bateria, segmentosDeProyecto } from "@/components/ui";
import { conSesion } from "@/lib/db";
import { RUTA_MIS_PROYECTOS } from "@/lib/portal/rutas";
import { requerirEmpresa } from "@/lib/sesion";
import { comoIdentificador } from "@/lib/validaciones";
import * as piezasModelo from "@/models/piezas";
import * as proyectosModelo from "@/models/proyectos";

/**
 * Un proyecto, como lo ve el cliente: su bateria y la de cada pieza. Las que
 * esperan su revision se abren para decidir.
 */

export const metadata: Metadata = {
  title: "Proyecto",
};

export default async function PaginaMiProyecto(props: PageProps<"/dashboard/mis-proyectos/[id]">) {
  const { usuario } = await requerirEmpresa();

  const id = comoIdentificador((await props.params).id);
  if (id === null) notFound();

  const datos = await conSesion(usuario, async (tx) => {
    const proyecto = await proyectosModelo.buscarPorId(id, tx);
    if (!proyecto || proyecto.estado === "cancelado") return null;

    return { proyecto, piezas: await piezasModelo.deProyecto(id, tx) };
  });

  // Un proyecto de otra empresa, para el, no existe.
  if (!datos) notFound();

  const { proyecto, piezas } = datos;

  const migas = [
    { texto: "Conejo App", href: "/dashboard" },
    { texto: "Mis proyectos", href: RUTA_MIS_PROYECTOS },
    { texto: proyecto.nombre },
  ];

  return (
    <Wrapper migas={migas} kicker={proyecto.empresaNombre} titulo={proyecto.nombre}>
      <section
        aria-label="Avance del proyecto"
        className="surge mb-8 flex flex-wrap items-center gap-5 rounded-[15px] border border-borde bg-superficie p-5 shadow-[var(--sombra)] [--retraso:0.1s] sm:p-6"
      >
        <Bateria
          segmentos={segmentosDeProyecto(proyecto.avance.porcentaje)}
          porcentaje={proyecto.avance.porcentaje}
          etiqueta="Avance del proyecto"
          tamano="grande"
        />
        <div>
          <p className="text-[30px] leading-none font-extrabold tracking-[-0.03em] tabular-nums">
            {Math.round(proyecto.avance.porcentaje)}%
          </p>
          <p className="mt-1 text-[12px] text-suave">
            {proyecto.avance.piezasAprobadas} de {proyecto.avance.totalPiezas} aprobadas · cierre
            estimado {fechaCorta(proyecto.fechaEstimadaCierre)}
          </p>
        </div>
      </section>

      <h2 className="surge mb-3 text-[19px] font-extrabold tracking-[-0.02em] [--retraso:0.14s]">Piezas</h2>

      <div className="surge [--retraso:0.18s]">
        <PiezasCliente
          proyectoId={id}
          tipo={proyecto.tipo}
          piezas={piezas}
          puedeAprobar={usuario.puedeAprobar === true}
        />
      </div>
    </Wrapper>
  );
}
