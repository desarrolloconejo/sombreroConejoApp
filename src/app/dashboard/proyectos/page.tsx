import type { Metadata } from "next";
import { FolderPlus } from "lucide-react";

import { Wrapper } from "@/components/layout/Wrapper";
import { Listado, ListadoVacio, PanelLateral } from "@/components/listado";
import {
  columnasProyectos,
  filtrosProyectos,
  FormularioProyecto,
} from "@/components/proyectos";
import { BotonEnlace } from "@/components/ui";
import { conSesion } from "@/lib/db";
import { leerEstadoListado } from "@/lib/parametros";
import { RUTA_PROYECTOS } from "@/lib/portal/rutas";
import { requerirCargo } from "@/lib/sesion";
import { conPanel } from "@/lib/urlListado";
import { comoIdentificador } from "@/lib/validaciones";
import * as asignacionesModelo from "@/models/asignaciones";
import * as proyectosModelo from "@/models/proyectos";
import type { EstadoProyecto, TipoProyecto } from "@/types";

/**
 * Los proyectos de la agencia: lo que pidio cada cliente, con su bateria.
 *
 * Lo ven el admin, todos, y cada ejecutivo de cuentas, los de sus empresas.
 * Quien decide cuales es la base: el listado pide todos y las politicas
 * devuelven los que tocan.
 */

export const metadata: Metadata = {
  title: "Proyectos",
};

const ORDEN_PERMITIDO = ["creadoEn", "nombre", "cierre"] as const;

const MIGAS = [{ texto: "Conejo App", href: "/dashboard" }, { texto: "Proyectos" }];

const ESTADOS: readonly EstadoProyecto[] = ["activo", "pausado", "cerrado", "cancelado"];
const TIPOS: readonly TipoProyecto[] = ["redes_sociales", "especial"];

/** Lo que no se reconoce se descarta: la URL no llega cruda a la consulta. */
function soloDe<T extends string>(valores: string[] | undefined, permitidos: readonly T[]) {
  const validos = (valores ?? []).filter((v): v is T => (permitidos as readonly string[]).includes(v));
  return validos.length > 0 ? validos : undefined;
}

export default async function PaginaProyectos(props: PageProps<"/dashboard/proyectos">) {
  const usuario = await requerirCargo("cuentas");

  const parametros = await props.searchParams;

  const estado = leerEstadoListado(parametros, {
    ordenPermitido: ORDEN_PERMITIDO,
    ordenPorDefecto: "creadoEn",
    direccionPorDefecto: "desc",
    filtrosPermitidos: ["estado", "tipo", "empresa"],
  });

  const datos = await conSesion(usuario, async (tx) => {
    const empresas = await proyectosModelo.empresasGestionables(tx);

    const empresaIds = (estado.filtros.empresa ?? [])
      .map(comoIdentificador)
      .filter((id): id is number => id !== null);

    const pagina = await proyectosModelo.listar(
      {
        busqueda: estado.busqueda || undefined,
        estado: soloDe(estado.filtros.estado, ESTADOS),
        tipo: soloDe(estado.filtros.tipo, TIPOS),
        empresaId: empresaIds.length > 0 ? empresaIds : undefined,
        orden: estado.orden as (typeof ORDEN_PERMITIDO)[number],
        direccion: estado.direccion,
        pagina: estado.pagina,
        porPagina: estado.porPagina,
      },
      tx,
    );

    // El alta necesita saber quien puede llevar cada proyecto.
    const alta =
      estado.panel === "nuevo"
        ? {
            administradores: await proyectosModelo.administradores(tx),
            asignaciones: await asignacionesModelo.visibles(tx),
          }
        : null;

    return { empresas, pagina, alta, empresaIds };
  });

  const hrefCerrar = conPanel(RUTA_PROYECTOS, estado, null);
  const hrefAlta = conPanel(RUTA_PROYECTOS, estado, "nuevo");
  const puedeAbrir = datos.empresas.length > 0;

  return (
    <Wrapper
      migas={MIGAS}
      kicker="Trabajo"
      titulo="Proyectos"
      descripcion="Lo que pidio cada cliente, pieza a pieza. La bateria dice cuanto falta; las alertas, que mirar primero."
    >
      <Listado
        ruta={RUTA_PROYECTOS}
        estado={estado}
        columnas={columnasProyectos()}
        filtros={filtrosProyectos(datos.empresas)}
        filas={datos.pagina.filas}
        total={datos.pagina.total}
        totalPaginas={datos.pagina.totalPaginas}
        claveFila={(proyecto) => proyecto.id}
        titulo="Proyectos"
        etiquetaBusqueda="Buscar proyectos"
        marcadorBusqueda="Buscar por proyecto o empresa"
        accion={puedeAbrir ? { texto: "Nuevo proyecto", href: hrefAlta } : undefined}
        vacio={
          <ListadoVacio
            titulo={puedeAbrir ? "Todavia no hay proyectos" : "No atiendes ninguna empresa"}
            descripcion={
              puedeAbrir
                ? "Un proyecto es lo que pidio un cliente: una parrilla de redes o un entregable a medida."
                : "Un administrador te asigna las empresas desde su ficha. Entonces veras aqui sus proyectos."
            }
            accion={
              puedeAbrir ? (
                <BotonEnlace href={hrefAlta} tamano="chico">
                  <FolderPlus aria-hidden="true" />
                  Abrir el primero
                </BotonEnlace>
              ) : undefined
            }
          />
        }
        panel={
          datos.alta && (
            <PanelLateral
              hrefCerrar={hrefCerrar}
              kicker="Nuevo proyecto"
              titulo="Abrir un proyecto"
              descripcion="Elige la empresa y el servicio. Las piezas nacen con sus cinco fases."
            >
              <FormularioProyecto
                empresas={datos.empresas}
                administradores={datos.alta.administradores}
                asignaciones={datos.alta.asignaciones}
                usuarioId={usuario.id}
                empresaInicial={datos.empresaIds[0] ?? null}
                hrefCancelar={hrefCerrar}
              />
            </PanelLateral>
          )
        }
      />
    </Wrapper>
  );
}
