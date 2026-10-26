import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Pencil, Plus, ToggleLeft } from "lucide-react";

import { Wrapper } from "@/components/layout/Wrapper";
import { ModalConfirmacion, PanelLateral } from "@/components/listado";
import {
  CambiarEstadoProyecto,
  EditarProyecto,
  FormularioPieza,
  MatrizPiezas,
  ResumenProyecto,
} from "@/components/proyectos";
import { BotonEnlace } from "@/components/ui";
import { conSesion } from "@/lib/db";
import { leerEstadoListado } from "@/lib/parametros";
import { servicioPorSlug } from "@/lib/portal/catalogo";
import { RUTA_PROYECTOS, rutaProyecto } from "@/lib/portal/rutas";
import { requerirRol } from "@/lib/sesion";
import { conPanel } from "@/lib/urlListado";
import { comoIdentificador } from "@/lib/validaciones";
import * as piezasModelo from "@/models/piezas";
import * as proyectosModelo from "@/models/proyectos";

/**
 * Un proyecto: su bateria, la matriz de piezas por fases y, para quien lo
 * gestiona, las acciones sobre el.
 *
 * La pueden abrir el admin, el ejecutivo de la empresa y quien trabaja en
 * alguna de sus piezas; este ultimo solo ve esas piezas, porque la base no le
 * devuelve las demas. Para cualquier otro, el proyecto no existe.
 */

export const metadata: Metadata = {
  title: "Proyecto",
};

export default async function PaginaProyecto(props: PageProps<"/dashboard/proyectos/[id]">) {
  const usuario = await requerirRol("admin", "trabajador");

  const { id: crudo } = await props.params;
  const id = comoIdentificador(crudo);
  if (id === null) notFound();

  const estado = leerEstadoListado(await props.searchParams, {
    ordenPermitido: ["orden"],
    ordenPorDefecto: "orden",
    direccionPorDefecto: "asc",
    filtrosPermitidos: [],
  });

  const datos = await conSesion(usuario, async (tx) => {
    const proyecto = await proyectosModelo.buscarPorId(id, tx);
    if (!proyecto) return null;

    const gestiona = await proyectosModelo.gestiona(id, tx);

    return {
      proyecto,
      gestiona,
      piezas: await piezasModelo.deProyecto(id, tx),
      // Solo el administrador cambia quien lo lleva: el resto no necesita la lista.
      ejecutivos:
        gestiona && estado.panel === "editar" && usuario.rol === "admin"
          ? await proyectosModelo.ejecutivosPosibles(proyecto.empresaId, tx)
          : [],
    };
  });

  if (!datos) notFound();

  const { proyecto, gestiona, piezas, ejecutivos } = datos;
  const ruta = rutaProyecto(id);
  const servicio = servicioPorSlug(proyecto.servicio);
  const admiteMasPiezas = gestiona && servicio !== null && servicio.piezaUnica === null;
  const hrefCerrar = conPanel(ruta, estado, null);

  const migas = [
    { texto: "Conejo App", href: "/dashboard" },
    { texto: "Proyectos", href: RUTA_PROYECTOS },
    { texto: proyecto.nombre },
  ];

  return (
    <Wrapper
      migas={migas}
      kicker={proyecto.empresaNombre}
      titulo={proyecto.nombre}
    >
      <ResumenProyecto
        proyecto={proyecto}
        acciones={
          gestiona && (
            <>
              <BotonEnlace href={conPanel(ruta, estado, "editar")} variante="fantasma" tamano="chico">
                <Pencil aria-hidden="true" />
                Editar
              </BotonEnlace>
              <BotonEnlace href={conPanel(ruta, estado, "estado")} variante="fantasma" tamano="chico">
                <ToggleLeft aria-hidden="true" />
                Estado
              </BotonEnlace>
              {admiteMasPiezas && (
                <BotonEnlace href={conPanel(ruta, estado, "nuevo")} tamano="chico">
                  <Plus aria-hidden="true" />
                  Anadir pieza
                </BotonEnlace>
              )}
            </>
          )
        }
      />

      <h2 className="surge mt-8 mb-3 text-[19px] font-extrabold tracking-[-0.02em] [--retraso:0.14s]">
        Matriz de piezas
      </h2>

      <div className="surge [--retraso:0.18s]">
        {piezas.length === 0 ? (
          <p className="rounded-[15px] border border-borde bg-superficie px-5 py-8 text-center text-[13px] text-suave">
            Este proyecto todavia no tiene piezas.
          </p>
        ) : (
          <MatrizPiezas proyectoId={id} tipo={proyecto.tipo} piezas={piezas} />
        )}
      </div>

      {gestiona && estado.panel === "editar" && (
        <PanelLateral
          hrefCerrar={hrefCerrar}
          kicker="Editar proyecto"
          titulo={proyecto.nombre}
          descripcion="El servicio y la empresa no cambian: definen la plantilla de fases."
        >
          <EditarProyecto
            proyecto={proyecto}
            ejecutivos={ejecutivos}
            puedeReasignar={usuario.rol === "admin"}
            hrefCancelar={hrefCerrar}
          />
        </PanelLateral>
      )}

      {admiteMasPiezas && estado.panel === "nuevo" && servicio && (
        <PanelLateral
          hrefCerrar={hrefCerrar}
          kicker="Nueva pieza"
          titulo={proyecto.nombre}
          descripcion="Se anade al final de la matriz, con sus cinco fases."
        >
          <FormularioPieza proyectoId={id} tipos={servicio.tiposDePieza} hrefCancelar={hrefCerrar} />
        </PanelLateral>
      )}

      {gestiona && estado.panel === "estado" && (
        <ModalConfirmacion
          hrefCerrar={hrefCerrar}
          tono="normal"
          ancho="amplio"
          kicker="Estado"
          titulo="Cambiar el estado del proyecto"
        >
          <CambiarEstadoProyecto proyecto={proyecto} hrefCerrar={hrefCerrar} />
        </ModalConfirmacion>
      )}
    </Wrapper>
  );
}
