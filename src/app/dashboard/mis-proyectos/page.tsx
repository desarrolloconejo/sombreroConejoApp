import type { Metadata } from "next";

import { Wrapper } from "@/components/layout/Wrapper";
import { AvisoRevision, TarjetaProyectoCliente } from "@/components/misProyectos";
import { conSesion } from "@/lib/db";
import { requerirEmpresa } from "@/lib/sesion";
import * as piezasModelo from "@/models/piezas";
import * as proyectosModelo from "@/models/proyectos";

/**
 * Mis proyectos: lo que la agencia hace para la empresa de quien mira.
 *
 * La base solo le devuelve los de su empresa. Arriba, lo que espera su
 * revision; debajo, los proyectos en curso y, aparte, los ya cerrados.
 */

export const metadata: Metadata = {
  title: "Mis proyectos",
};

const MIGAS = [{ texto: "Conejo App", href: "/dashboard" }, { texto: "Mis proyectos" }];

export default async function PaginaMisProyectos() {
  const { usuario } = await requerirEmpresa();

  const { pagina, esperando } = await conSesion(usuario, async (tx) => ({
    pagina: await proyectosModelo.listar({ porPagina: 100, direccion: "desc" }, tx),
    esperando: await piezasModelo.esperandoCliente(tx),
  }));

  // Un proyecto cancelado no es algo que el cliente tenga que seguir.
  const visibles = pagina.filas.filter((proyecto) => proyecto.estado !== "cancelado");
  const enCurso = visibles.filter((p) => p.estado === "activo" || p.estado === "pausado");
  const cerrados = visibles.filter((p) => p.estado === "cerrado");

  return (
    <Wrapper
      migas={MIGAS}
      kicker={usuario.empresaNombre ?? "Mi espacio"}
      titulo="Mis proyectos"
      descripcion="Como va cada proyecto, pieza a pieza. Cuando una pieza esta lista, la revisas aqui."
    >
      <div className="flex flex-col gap-8">
        <AvisoRevision piezas={esperando} />

        <section aria-labelledby="titulo-en-curso" className="surge [--retraso:0.1s]">
          <h2 id="titulo-en-curso" className="mb-3 text-[19px] font-extrabold tracking-[-0.02em]">
            En curso
          </h2>
          {enCurso.length === 0 ? (
            <p className="rounded-[15px] border border-borde bg-superficie px-5 py-8 text-center text-[13px] text-suave">
              No hay proyectos en curso ahora mismo.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {enCurso.map((proyecto) => (
                <li key={proyecto.id}>
                  <TarjetaProyectoCliente proyecto={proyecto} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {cerrados.length > 0 && (
          <section aria-labelledby="titulo-cerrados" className="surge [--retraso:0.16s]">
            <h2 id="titulo-cerrados" className="mb-3 text-[19px] font-extrabold tracking-[-0.02em]">
              Historial
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {cerrados.map((proyecto) => (
                <li key={proyecto.id}>
                  <TarjetaProyectoCliente proyecto={proyecto} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Wrapper>
  );
}
