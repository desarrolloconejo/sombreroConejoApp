import type { Metadata } from "next";
import { Plus } from "lucide-react";

import { Wrapper } from "@/components/layout/Wrapper";
import {
  Listado,
  ListadoVacio,
  ModalConfirmacion,
  PanelLateral,
} from "@/components/listado";
import {
  columnasEmpresas,
  ConfirmarEstadoEmpresa,
  DetalleEmpresa,
  filtrosEmpresas,
  FormularioEmpresa,
} from "@/components/empresas";
import { BotonEnlace } from "@/components/ui";
import { conSesion } from "@/lib/db";
import { leerEstadoListado } from "@/lib/parametros";
import { requerirAdmin } from "@/lib/sesion";
import { conPanel } from "@/lib/urlListado";
import * as asignacionesModelo from "@/models/asignaciones";
import * as clientesModelo from "@/models/clientes";
import * as empresasModelo from "@/models/empresas";
import * as fichasModelo from "@/models/fichas";
import type { OrdenEmpresas, ResumenEmpresa } from "@/types";

/**
 * La cartera de clientes de la agencia.
 *
 * Es el hermano del modulo de usuarios, y por eso reutiliza el mismo listado
 * estandar: buscador, filtros, orden, paginacion y tarjetas en movil. Lo unico
 * que aporta este modulo son sus columnas, sus filtros y su consulta.
 *
 * La division entre los dos es esta: aqui estan las CUENTAS que se atienden,
 * en Usuarios las PERSONAS que las representan. Una empresa no da acceso a
 * nada; lo que da permisos es vincularle un usuario, y eso se hace alli.
 */

export const metadata: Metadata = {
  title: "Empresas",
};

const RUTA = "/dashboard/empresas";

const ORDEN_PERMITIDO: readonly OrdenEmpresas[] = ["nombre", "creadoEn"];

const MIGAS = [{ texto: "Conejo App", href: "/dashboard" }, { texto: "Empresas" }];

function comoOrden(valor: string): OrdenEmpresas {
  return ORDEN_PERMITIDO.find((clave) => clave === valor) ?? "nombre";
}

/*
 * Las conversiones descartan lo que no reconocen en lugar de arriesgar un
 * cast: un parametro escrito a mano no debe llegar nunca a la consulta.
 *
 * Devuelven `undefined` cuando no queda nada valido: una lista vacia y la
 * ausencia de filtro significan lo mismo, y el modelo solo entiende una.
 */
function soloValidos<T>(valores: T[]): T[] | undefined {
  return valores.length > 0 ? valores : undefined;
}

/** El sector se valida contra los que existen, no contra una lista escrita. */
function comoSectores(
  valores: string[] | undefined,
  sectores: string[],
): string[] | undefined {
  return soloValidos((valores ?? []).filter((v) => sectores.includes(v)));
}

/** El chip manda "true" o "false"; el modelo espera booleanos. */
function comoActivos(valores: string[] | undefined): boolean[] | undefined {
  return soloValidos(
    (valores ?? [])
      .filter((v) => v === "true" || v === "false")
      .map((v) => v === "true"),
  );
}

export default async function PaginaEmpresas(
  props: PageProps<"/dashboard/empresas">,
) {
  // El proxy ya filtra esta ruta por rol, pero la comprobacion tiene que estar
  // tambien aqui: es lo que impide el acceso si su matcher cambia.
  const admin = await requerirAdmin();

  const parametros = await props.searchParams;

  const estado = leerEstadoListado(parametros, {
    ordenPermitido: ORDEN_PERMITIDO,
    ordenPorDefecto: "nombre",
    direccionPorDefecto: "asc",
    filtrosPermitidos: ["sector", "activo"],
  });

  // Los sectores se consultan siempre: alimentan los chips del filtro y son la
  // lista blanca contra la que se valida el parametro `sector`.
  const sectores = await empresasModelo.sectores();

  const pagina = await empresasModelo.listar({
    busqueda: estado.busqueda || undefined,
    sector: comoSectores(estado.filtros.sector, sectores),
    activo: comoActivos(estado.filtros.activo),
    orden: comoOrden(estado.orden),
    direccion: estado.direccion,
    pagina: estado.pagina,
    porPagina: estado.porPagina,
  });

  /*
   * Los dos recuentos, por lote y no por fila.
   *
   * Van despues del listado porque necesitan sus ids. Con un JOIN en la
   * consulta principal habria que agrupar por todas las columnas de la empresa
   * para pintar dos numeros, y ademas los dos agregados se multiplicarian
   * entre si: una cuenta con 3 contactos y 4 piezas daria 12 filas.
   */
  const ids = pagina.filas.map((empresa) => empresa.id);

  const [contactos, piezas] = await Promise.all([
    clientesModelo.contarPorEmpresas(ids),
    fichasModelo.contarPorEmpresas(ids),
  ]);

  const filas: ResumenEmpresa[] = pagina.filas.map((empresa) => ({
    ...empresa,
    contactos: contactos.get(empresa.id) ?? 0,
    piezas: piezas.get(empresa.id) ?? 0,
  }));

  /*
   * Los paneles que trabajan sobre una empresa concreta.
   *
   * Se resuelve una sola vez para los tres. Si el id no corresponde a ninguna
   * devuelve null y no se abre nada, que es lo que pasa al recargar un
   * "?panel=editar&id=999" viejo.
   */
  const panelDeFila =
    estado.panel === "ver" || estado.panel === "editar" || estado.panel === "estado";

  const empresaPanel =
    panelDeFila && estado.panelId !== null
      ? await empresasModelo.buscarPorId(estado.panelId)
      : null;

  // La ficha de detalle es la unica que necesita el desglose por estado.
  const piezasDePanel =
    empresaPanel && estado.panel === "ver"
      ? await fichasModelo.contarPorEstadoDeEmpresa(empresaPanel.id)
      : null;

  const contactosDePanel =
    empresaPanel && estado.panel === "ver"
      ? (await clientesModelo.contarPorEmpresas([empresaPanel.id])).get(
          empresaPanel.id,
        ) ?? 0
      : 0;

  // Quien atiende a la empresa, y a quien mas se le puede asignar.
  const ejecutivosDePanel =
    empresaPanel && estado.panel === "ver"
      ? await conSesion(admin, async (tx) => {
          const asignados = await asignacionesModelo.deEmpresa(empresaPanel.id, tx);
          const yaEstan = new Set(asignados.map((asignacion) => asignacion.usuarioId));
          const candidatos = (await asignacionesModelo.candidatos(tx)).filter(
            (persona) => !yaEstan.has(persona.id),
          );

          return { asignados, candidatos };
        })
      : { asignados: [], candidatos: [] };

  const hrefCerrar = conPanel(RUTA, estado, null);
  const hrefAlta = conPanel(RUTA, estado, "nuevo");

  return (
    <Wrapper
      migas={MIGAS}
      kicker="Clientes"
      titulo="Empresas"
      descripcion="Las cuentas que atiende la agencia. Aqui se registran y se mantienen; las personas que las representan se dan de alta en Usuarios."
    >
      <Listado
        ruta={RUTA}
        estado={estado}
        columnas={columnasEmpresas(RUTA, estado)}
        filtros={filtrosEmpresas(sectores)}
        filas={filas}
        total={pagina.total}
        totalPaginas={pagina.totalPaginas}
        claveFila={(empresa) => empresa.id}
        titulo="Empresas cliente"
        etiquetaBusqueda="Buscar empresas"
        marcadorBusqueda="Buscar por nombre o RIF"
        accion={{ texto: "Nueva empresa", href: hrefAlta }}
        vacio={
          <ListadoVacio
            titulo="Todavia no hay ninguna empresa"
            descripcion="Una empresa es un cliente de la agencia. En cuanto exista, se podra elegir al escribir hooks y al dar de alta a su gente."
            accion={
              <BotonEnlace href={hrefAlta} tamano="chico">
                <Plus aria-hidden="true" />
                Registrar la primera
              </BotonEnlace>
            }
          />
        }
        panel={
          <>
            {estado.panel === "nuevo" && (
              <PanelLateral
                hrefCerrar={hrefCerrar}
                kicker="Alta de cliente"
                titulo="Nueva empresa"
                descripcion="Solo hace falta el nombre. El resto se puede completar despues."
              >
                <FormularioEmpresa hrefCancelar={hrefCerrar} />
              </PanelLateral>
            )}

            {empresaPanel && estado.panel === "editar" && (
              <PanelLateral
                hrefCerrar={hrefCerrar}
                kicker="Editar cliente"
                titulo={empresaPanel.nombre}
                descripcion="Los cambios se aplican en todos los sitios donde aparece esta cuenta."
              >
                <FormularioEmpresa
                  empresa={empresaPanel}
                  hrefCancelar={hrefCerrar}
                />
              </PanelLateral>
            )}

            {empresaPanel && piezasDePanel && estado.panel === "ver" && (
              <PanelLateral
                hrefCerrar={hrefCerrar}
                kicker="Ficha de cliente"
                titulo={empresaPanel.nombre}
                descripcion="Quien es, como se le escribe, donde publica y cuanto trabajo lleva hecho."
              >
                <DetalleEmpresa
                  empresa={empresaPanel}
                  contactos={contactosDePanel}
                  piezas={piezasDePanel}
                  asignados={ejecutivosDePanel.asignados}
                  candidatos={ejecutivosDePanel.candidatos}
                  hrefEditar={conPanel(RUTA, estado, "editar", empresaPanel.id)}
                  /* Sus personas, en el modulo donde se gestionan. */
                  hrefContactos={`/dashboard/usuarios?empresa=${empresaPanel.id}`}
                  hrefCerrar={hrefCerrar}
                />
              </PanelLateral>
            )}

            {empresaPanel && estado.panel === "estado" && (
              <ModalConfirmacion
                hrefCerrar={hrefCerrar}
                tono={empresaPanel.activo ? "aviso" : "normal"}
                kicker={empresaPanel.activo ? "Desactivar" : "Reactivar"}
                titulo={
                  empresaPanel.activo
                    ? "¿Desactivar esta empresa?"
                    : "¿Reactivar esta empresa?"
                }
              >
                <ConfirmarEstadoEmpresa
                  empresa={{
                    ...empresaPanel,
                    contactos: contactos.get(empresaPanel.id) ?? 0,
                    piezas: piezas.get(empresaPanel.id) ?? 0,
                  }}
                  hrefCerrar={hrefCerrar}
                />
              </ModalConfirmacion>
            )}
          </>
        }
      />
    </Wrapper>
  );
}
