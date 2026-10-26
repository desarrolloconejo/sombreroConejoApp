import type { Metadata } from "next";

import { Wrapper } from "@/components/layout/Wrapper";
import { Listado } from "@/components/listado";
import { AvisoRevision, TarjetaProyectoCliente } from "@/components/misProyectos";
import { conSesion } from "@/lib/db";
import { leerEstadoListado } from "@/lib/parametros";
import { RUTA_MIS_PROYECTOS } from "@/lib/portal/rutas";
import { requerirEmpresa } from "@/lib/sesion";
import * as piezasModelo from "@/models/piezas";
import * as proyectosModelo from "@/models/proyectos";
import {
  NOMBRES_DE_ESTADO_PROYECTO,
  type Columna,
  type DefinicionFiltro,
  type EstadoProyecto,
  type Proyecto,
} from "@/types";

/**
 * Mis proyectos: lo que la agencia hace para la empresa de quien mira.
 *
 * La base solo le devuelve los de su empresa. Arriba, lo que espera su
 * revision; debajo, sus proyectos en el listado estandar: buscar, filtrar por
 * estado y ordenar. Los cancelados no se le muestran.
 */

export const metadata: Metadata = {
  title: "Mis proyectos",
};

const MIGAS = [{ texto: "Conejo App", href: "/dashboard" }, { texto: "Mis proyectos" }];

/** Lo que el cliente puede ver: un proyecto cancelado no es algo que tenga que seguir. */
const VISIBLES: readonly EstadoProyecto[] = ["activo", "pausado", "cerrado"];

const ORDEN_PERMITIDO = ["creadoEn", "nombre", "cierre"] as const;

/** Solo para ordenar: el listado se pinta en tarjetas. */
const COLUMNAS: Columna<Proyecto>[] = [
  { clave: "creadoEn", titulo: "Mas recientes", ordenable: true, render: () => null },
  { clave: "nombre", titulo: "Nombre", ordenable: true, render: () => null },
  { clave: "cierre", titulo: "Cierre estimado", ordenable: true, render: () => null },
];

const FILTROS: DefinicionFiltro[] = [
  {
    clave: "estado",
    titulo: "Estado",
    opciones: VISIBLES.map((estado) => ({ valor: estado, texto: NOMBRES_DE_ESTADO_PROYECTO[estado] })),
  },
];

export default async function PaginaMisProyectos(props: PageProps<"/dashboard/mis-proyectos">) {
  const { usuario } = await requerirEmpresa();
  const estado = leerEstadoListado(await props.searchParams, {
    ordenPermitido: ORDEN_PERMITIDO,
    ordenPorDefecto: "creadoEn",
    direccionPorDefecto: "desc",
    filtrosPermitidos: ["estado"],
  });
  const estados = (estado.filtros.estado ?? []).filter((v): v is EstadoProyecto =>
    (VISIBLES as readonly string[]).includes(v),
  );

  const { pagina, esperando } = await conSesion(usuario, async (tx) => ({
    pagina: await proyectosModelo.listar(
      {
        busqueda: estado.busqueda || undefined,
        estado: estados.length > 0 ? estados : [...VISIBLES],
        orden: estado.orden as (typeof ORDEN_PERMITIDO)[number],
        direccion: estado.direccion,
        pagina: estado.pagina,
        porPagina: estado.porPagina,
      },
      tx,
    ),
    esperando: await piezasModelo.esperandoCliente(tx),
  }));

  return (
    <Wrapper
      migas={MIGAS}
      kicker={usuario.empresaNombre ?? "Mi espacio"}
      titulo="Mis proyectos"
      descripcion="Como va cada proyecto, pieza a pieza. Cuando una pieza esta lista, la revisas aqui."
    >
      <div className="flex flex-col gap-8">
        <AvisoRevision piezas={esperando} />

        <Listado
          ruta={RUTA_MIS_PROYECTOS}
          estado={estado}
          columnas={COLUMNAS}
          filas={pagina.filas}
          total={pagina.total}
          totalPaginas={pagina.totalPaginas}
          filtros={FILTROS}
          marcadorBusqueda="Nombre del proyecto"
          etiquetaBusqueda="Buscar proyectos"
          claveFila={(proyecto) => proyecto.id}
          titulo="Tus proyectos"
          rejilla={(proyecto) => <TarjetaProyectoCliente proyecto={proyecto} />}
          vacio={
            <p className="px-5 py-8 text-center text-[13px] text-suave">
              Todavia no hay proyectos. Cuando la agencia abra uno, lo veras aqui.
            </p>
          }
        />
      </div>
    </Wrapper>
  );
}
