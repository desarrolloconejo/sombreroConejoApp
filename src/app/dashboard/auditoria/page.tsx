import type { Metadata } from "next";

import {
  columnasAuditoria,
  DetalleAuditoria,
  filtrosAuditoria,
  nombreDeAccion,
} from "@/components/auditoria";
import { Wrapper } from "@/components/layout/Wrapper";
import { Listado, ListadoVacio, PanelLateral } from "@/components/listado";
import { leerEstadoListado } from "@/lib/parametros";
import { requerirAdmin } from "@/lib/sesion";
import { conPanel } from "@/lib/urlListado";
import * as auditoriaModelo from "@/models/auditoria";
import {
  MODULOS_DE_AUDITORIA,
  type ModuloAuditoria,
  type PeriodoAuditoria,
} from "@/types";

/**
 * Todo lo que ha ocurrido en la aplicacion, lo mas reciente primero.
 *
 * Es de solo lectura por definicion: la tabla no admite cambios ni borrados,
 * asi que aqui no hay altas, ediciones ni acciones sobre las filas. Lo unico
 * que se abre es el detalle de una linea.
 */

export const metadata: Metadata = {
  title: "Auditoria",
};

const RUTA = "/dashboard/auditoria";

const ORDEN_PERMITIDO = ["creadoEn"] as const;

const MIGAS = [{ texto: "Conejo App", href: "/dashboard" }, { texto: "Auditoria" }];

const PERIODOS: readonly PeriodoAuditoria[] = ["hoy", "semana", "mes"];

/*
 * Las conversiones descartan lo que no reconocen en lugar de arriesgar un
 * cast: un parametro escrito a mano no debe llegar nunca a la consulta.
 */
function comoModulos(valores: string[] | undefined): ModuloAuditoria[] | undefined {
  const validos = (valores ?? []).filter(
    (valor): valor is ModuloAuditoria => valor in MODULOS_DE_AUDITORIA,
  );

  return validos.length > 0 ? validos : undefined;
}

/**
 * El periodo es uno solo aunque el filtro deje marcar varios: si llegan dos,
 * manda el mas amplio, que es el que contiene a los demas.
 */
function comoPeriodo(valores: string[] | undefined): PeriodoAuditoria | undefined {
  const validos = PERIODOS.filter((periodo) => (valores ?? []).includes(periodo));

  return validos.at(-1);
}

export default async function PaginaAuditoria(
  props: PageProps<"/dashboard/auditoria">,
) {
  // El proxy ya filtra esta ruta por rol, pero la comprobacion tiene que estar
  // tambien aqui: es lo que impide el acceso si su matcher cambia.
  await requerirAdmin();

  const parametros = await props.searchParams;

  const estado = leerEstadoListado(parametros, {
    ordenPermitido: ORDEN_PERMITIDO,
    ordenPorDefecto: "creadoEn",
    direccionPorDefecto: "desc",
    filtrosPermitidos: ["modulo", "periodo"],
  });

  const pagina = await auditoriaModelo.listar({
    busqueda: estado.busqueda || undefined,
    modulo: comoModulos(estado.filtros.modulo),
    periodo: comoPeriodo(estado.filtros.periodo),
    direccion: estado.direccion,
    pagina: estado.pagina,
    porPagina: estado.porPagina,
  });

  // Si el id no corresponde a ninguna linea no se abre nada.
  const lineaPanel =
    estado.panel === "ver" && estado.panelId !== null
      ? await auditoriaModelo.buscarPorId(estado.panelId)
      : null;

  return (
    <Wrapper
      migas={MIGAS}
      kicker="Sistema"
      titulo="Auditoria"
      descripcion="Quien hizo que, y cuando. Cada linea se escribe junto al cambio que cuenta y no se puede modificar ni borrar."
    >
      <Listado
        ruta={RUTA}
        estado={estado}
        columnas={columnasAuditoria(RUTA, estado)}
        filtros={filtrosAuditoria()}
        filas={pagina.filas}
        total={pagina.total}
        totalPaginas={pagina.totalPaginas}
        claveFila={(linea) => linea.id}
        titulo="Registro de actividad"
        etiquetaBusqueda="Buscar en la auditoria"
        marcadorBusqueda="Buscar por persona, empresa o accion"
        vacio={
          <ListadoVacio
            titulo="Todavia no hay nada anotado"
            descripcion="En cuanto alguien inicie sesion o cambie algo, aparecera aqui."
          />
        }
        panel={
          lineaPanel && (
            <PanelLateral
              hrefCerrar={conPanel(RUTA, estado, null)}
              kicker="Detalle"
              titulo={nombreDeAccion(lineaPanel.accion)}
              descripcion="Lo que quedo anotado en el momento del cambio."
            >
              <DetalleAuditoria linea={lineaPanel} />
            </PanelLateral>
          )
        }
      />
    </Wrapper>
  );
}
