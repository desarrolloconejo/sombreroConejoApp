import type { Metadata } from "next";
import Link from "next/link";
import { FilePlus2 } from "lucide-react";

import { Wrapper } from "@/components/layout/Wrapper";
import { Listado, ListadoVacio, PanelLateral } from "@/components/listado";
import { SECCION_DOCUMENTO } from "@/components/finanzas";
import {
  columnasPresupuestos,
  filtrosPresupuestos,
  FormularioPresupuesto,
  PresupuestarBrief,
} from "@/components/presupuestos";
import { BotonEnlace } from "@/components/ui";
import { conSesion } from "@/lib/db";
import { DIAS_DE_VALIDEZ, sumarDias } from "@/lib/finanzas/documentos";
import { RUTA_PRESUPUESTOS } from "@/lib/finanzas/rutas";
import { leerEstadoListado } from "@/lib/parametros";
import { formatoPor } from "@/lib/portal/briefs";
import { rutaBrief } from "@/lib/portal/rutas";
import { hoyEnCaracas } from "@/lib/portal/fases";
import { requerirFinanzas } from "@/lib/sesion";
import { conPanel } from "@/lib/urlListado";
import { comoIdentificador } from "@/lib/validaciones";
import * as briefsModelo from "@/models/briefs";
import * as empresasModelo from "@/models/empresas";
import * as presupuestosModelo from "@/models/presupuestos";
import * as proformasModelo from "@/models/proformas";
import type { ProyectoDeProforma, SituacionPresupuesto } from "@/types";

/**
 * Los presupuestos de la agencia: lo que se ofrece a cada cliente, con sus
 * renglones, a la espera de que lo apruebe.
 *
 * Lo ven el administrador y administracion. Nadie mas del equipo.
 */

export const metadata: Metadata = {
  title: "Presupuestos",
};

const ORDEN_PERMITIDO = ["numero", "creadoEn", "total"] as const;

const MIGAS = [{ texto: "Conejo App", href: "/dashboard" }, { texto: "Presupuestos" }];

const SITUACIONES: readonly SituacionPresupuesto[] = [
  "borrador",
  "enviado",
  "aprobado",
  "rechazado",
  "vencido",
];

/** Lo que no se reconoce se descarta: la URL no llega cruda a la consulta. */
function soloDe<T extends string>(valores: string[] | undefined, permitidos: readonly T[]) {
  const validos = (valores ?? []).filter((v): v is T => (permitidos as readonly string[]).includes(v));
  return validos.length > 0 ? validos : undefined;
}

export default async function PaginaPresupuestos(props: PageProps<"/dashboard/presupuestos">) {
  const usuario = await requerirFinanzas();

  const estado = leerEstadoListado(await props.searchParams, {
    ordenPermitido: ORDEN_PERMITIDO,
    ordenPorDefecto: "numero",
    direccionPorDefecto: "desc",
    filtrosPermitidos: ["situacion", "empresa"],
  });

  const nombres = await empresasModelo.nombres();

  const datos = await conSesion(usuario, async (tx) => {
    const empresaIds = (estado.filtros.empresa ?? [])
      .map(comoIdentificador)
      .filter((id): id is number => id !== null);

    const pagina = await presupuestosModelo.listar(
      {
        busqueda: estado.busqueda || undefined,
        situacion: soloDe(estado.filtros.situacion, SITUACIONES),
        empresaId: empresaIds.length > 0 ? empresaIds : undefined,
        orden: estado.orden as (typeof ORDEN_PERMITIDO)[number],
        direccion: estado.direccion,
        pagina: estado.pagina,
        porPagina: estado.porPagina,
      },
      tx,
    );

    // El alta necesita las empresas activas y los proyectos de cada una.
    let alta = null;
    if (estado.panel === "nuevo") {
      const activas = await empresasModelo.listarActivas();
      const proyectos: Record<number, ProyectoDeProforma[]> = {};
      for (const empresa of activas) {
        proyectos[empresa.id] = await proformasModelo.proyectosLigables(empresa.id, tx);
      }
      alta = { empresas: activas.map((e) => ({ id: e.id, nombre: e.nombre })), proyectos };
    }

    // Los briefs que el ejecutivo paso a presupuesto y aun no lo tienen.
    const briefsPendientes = await briefsModelo.esperandoPresupuesto(tx);

    return { pagina, alta, briefsPendientes };
  });

  const hrefCerrar = conPanel(RUTA_PRESUPUESTOS, estado, null);
  const hrefAlta = conPanel(RUTA_PRESUPUESTOS, estado, "nuevo");

  return (
    <Wrapper
      migas={MIGAS}
      kicker="Finanzas"
      titulo="Presupuestos"
      descripcion="Lo que se ofrece a cada cliente. Se envia, el cliente lo aprueba, y de ahi sale la proforma."
    >
      {datos.briefsPendientes.length > 0 && (
        <section aria-labelledby="titulo-briefs" className={`surge mb-6 ${SECCION_DOCUMENTO}`}>
          <h2 id="titulo-briefs" className="text-[15px] font-bold">
            Briefs que esperan su presupuesto
          </h2>
          <p className="mt-1 text-[12.5px] text-suave">
            Los paso a presupuesto su ejecutivo. Leelos y arma el presupuesto: nace en borrador, ligado al brief.
          </p>
          <ul className="mt-3 flex flex-col">
            {datos.briefsPendientes.map((brief) => (
              <li key={brief.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-borde py-3">
                <div className="min-w-0">
                  <Link href={rutaBrief(brief.id)} className="text-[13.5px] font-semibold hover:underline">
                    {brief.solicitante} · {brief.codigo}
                  </Link>
                  <p className="text-[12px] text-suave">
                    {formatoPor(brief.formato, brief.formatoVersion)?.nombre ?? brief.formato}
                  </p>
                </div>
                <PresupuestarBrief briefId={brief.id} codigo={brief.codigo ?? ""} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <Listado
        ruta={RUTA_PRESUPUESTOS}
        estado={estado}
        columnas={columnasPresupuestos()}
        filtros={filtrosPresupuestos(nombres)}
        filas={datos.pagina.filas}
        total={datos.pagina.total}
        totalPaginas={datos.pagina.totalPaginas}
        claveFila={(presupuesto) => presupuesto.id}
        titulo="Presupuestos"
        etiquetaBusqueda="Buscar presupuestos"
        marcadorBusqueda="Buscar por titulo, empresa o numero"
        accion={{ texto: "Nuevo presupuesto", href: hrefAlta }}
        vacio={
          <ListadoVacio
            titulo="Todavia no hay presupuestos"
            descripcion="Un presupuesto es lo que se le ofrece a un cliente, renglon a renglon. Cuando lo aprueba, sale su proforma."
            accion={
              <BotonEnlace href={hrefAlta} tamano="chico">
                <FilePlus2 aria-hidden="true" />
                Crear el primero
              </BotonEnlace>
            }
          />
        }
        panel={
          datos.alta && (
            <PanelLateral
              hrefCerrar={hrefCerrar}
              kicker="Nuevo presupuesto"
              titulo="Abrir un presupuesto"
              descripcion="Para quien es y hasta cuando vale. Los renglones se escriben despues."
            >
              <FormularioPresupuesto
                empresas={datos.alta.empresas}
                proyectos={datos.alta.proyectos}
                validoHasta={sumarDias(hoyEnCaracas(), DIAS_DE_VALIDEZ)}
                hrefCancelar={hrefCerrar}
              />
            </PanelLateral>
          )
        }
      />
    </Wrapper>
  );
}
