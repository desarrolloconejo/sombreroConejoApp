import type { Metadata } from "next";
import { Plus } from "lucide-react";

import { Wrapper } from "@/components/layout/Wrapper";
import {
  Listado,
  ListadoVacio,
  ModalConfirmacion,
  PanelLateral,
} from "@/components/listado";
import { columnasFichas, filtrosFichas } from "@/components/hooks/ColumnasFichas";
import { FormularioReferencia } from "@/components/hooks";
import { objetivoDe } from "@/lib/hooks/catalogo";
import { ConfirmarBorradoFicha } from "@/components/hooks/ConfirmarBorradoFicha";
import { DetalleFicha } from "@/components/hooks/DetalleFicha";
import { BotonEnlace } from "@/components/ui";
import { leerEstadoListado } from "@/lib/parametros";
import { conPanel } from "@/lib/urlListado";
import { requerirCargo } from "@/lib/sesion";
import * as empresasModelo from "@/models/empresas";
import * as fichasModelo from "@/models/fichas";
import * as referenciasModelo from "@/models/referencias";
import type { EstadoFicha, SlugObjetivo } from "@/types";

/**
 * El historial: todas las fichas y en que punto del recorrido se quedo cada
 * una. Solo consulta y mantenimiento — escribir, auditar y medir viven en sus
 * propios pasos.
 *
 * Reutiliza el listado estandar entero: buscador, filtros, orden, paginacion
 * y tarjetas en movil. Lo unico que aporta este modulo son sus columnas, sus
 * filtros y su consulta, que es justo lo que hace rentable el patron.
 */

export const metadata: Metadata = {
  title: "Historial de hooks",
};

const RUTA = "/dashboard/hooks/historial";

const ORDEN_PERMITIDO = ["creadoEn", "actualizadoEn", "nota", "empresa"] as const;

const ESTADOS: readonly EstadoFicha[] = ["borrador", "auditada", "medida"];
const OBJETIVOS: readonly SlugObjetivo[] = [
  "alcance",
  "guardados",
  "compartidos",
  "comunidad",
  "consideracion",
  "accion",
];

const MIGAS = [
  { texto: "Conejo App", href: "/dashboard" },
  { texto: "Hooks", href: "/dashboard/hooks" },
  { texto: "Historial" },
];

/*
 * Las conversiones descartan lo que no reconocen en lugar de arriesgar un
 * cast: un parametro escrito a mano no debe llegar nunca a la consulta.
 *
 * Reciben y devuelven LISTAS porque el listado admite varios valores por
 * grupo. Filtrar aqui, ademas, hace que "?estado=borrador&estado=inventado"
 * consulte por el valido y descarte el otro, en lugar de fallar entera.
 */
function comoEstados(valores: string[] | undefined): EstadoFicha[] | undefined {
  const validos = (valores ?? []).filter((v): v is EstadoFicha =>
    ESTADOS.some((e) => e === v),
  );

  return validos.length > 0 ? validos : undefined;
}

function comoObjetivos(valores: string[] | undefined): SlugObjetivo[] | undefined {
  const validos = (valores ?? []).filter((v): v is SlugObjetivo =>
    OBJETIVOS.some((o) => o === v),
  );

  return validos.length > 0 ? validos : undefined;
}

function comoEmpresas(valores: string[] | undefined): number[] | undefined {
  const validos = (valores ?? [])
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);

  return validos.length > 0 ? validos : undefined;
}

export default async function PaginaHistorial(
  props: PageProps<"/dashboard/hooks/historial">,
) {
  await requerirCargo("redes");

  const parametros = await props.searchParams;

  const estado = leerEstadoListado(parametros, {
    ordenPermitido: ORDEN_PERMITIDO,
    ordenPorDefecto: "actualizadoEn",
    direccionPorDefecto: "desc",
    filtrosPermitidos: ["estado", "empresa", "objetivo"],
  });

  const [pagina, empresas, fichaPanel] = await Promise.all([
    fichasModelo.listar({
      busqueda: estado.busqueda || undefined,
      estado: comoEstados(estado.filtros.estado),
      empresaId: comoEmpresas(estado.filtros.empresa),
      objetivo: comoObjetivos(estado.filtros.objetivo),
      orden: estado.orden,
      direccion: estado.direccion,
      pagina: estado.pagina,
      porPagina: estado.porPagina,
    }),
    empresasModelo.listarActivas(),

    // Solo se consulta la ficha que el panel va a mostrar. Si el id no
    // corresponde a nadie devuelve null y no se abre nada, que es lo que pasa
    // al recargar un "?panel=ver&id=999" viejo.
    (estado.panel === "ver" ||
      estado.panel === "borrar" ||
      estado.panel === "referencia") && estado.panelId !== null
      ? fichasModelo.buscarConResultado(estado.panelId)
      : null,
  ]);

  /*
   * Que fichas de esta pagina ya estan en el banco.
   *
   * Va despues del listado porque necesita sus ids, y se pregunta por el lote
   * entero de una vez: una consulta por fila serian veinte viajes para decidir
   * un icono.
   */
  const guardadas = await referenciasModelo.fichasGuardadas(
    pagina.filas.map((ficha) => ficha.id),
  );

  const hrefCerrar = conPanel(RUTA, estado, null);

  return (
    <Wrapper
      migas={MIGAS}
      kicker="06 / Historial"
      titulo="Todas las fichas y donde se quedo cada una"
      descripcion="Solo consulta y mantenimiento. Para escribir se va a Hooks, para auditar al Auditor y para registrar numeros a Metricas."
      accion={
        <BotonEnlace href="/dashboard/hooks/nuevo" tamano="chico">
          <Plus aria-hidden="true" />
          Nuevo hook
        </BotonEnlace>
      }
    >
      <Listado
        ruta={RUTA}
        estado={estado}
        columnas={columnasFichas(RUTA, estado, guardadas)}
        filtros={filtrosFichas(empresas)}
        filas={pagina.filas}
        total={pagina.total}
        totalPaginas={pagina.totalPaginas}
        claveFila={(ficha) => ficha.id}
        titulo="Fichas de hook"
        etiquetaBusqueda="Buscar fichas"
        marcadorBusqueda="Buscar hook, Insert-Titulo o cliente"
        vacio={
          <ListadoVacio
            titulo="Todavia no hay ninguna ficha"
            descripcion="Una ficha se crea escribiendo la decision de una pieza. La primera que aparezca aqui sera la que escribas ahora."
            accion={
              <BotonEnlace href="/dashboard/hooks/nuevo" tamano="chico">
                <Plus aria-hidden="true" />
                Escribir el primero
              </BotonEnlace>
            }
          />
        }
        panel={
          <>
            {fichaPanel && estado.panel === "ver" && (
              <PanelLateral
                hrefCerrar={hrefCerrar}
                kicker="Ficha de hook"
                titulo={fichaPanel.empresaNombre ?? "Sin cliente"}
                descripcion="La decision completa que se tomo antes de grabar, y lo que paso despues si llego a publicarse."
              >
                <DetalleFicha
                  ficha={fichaPanel}
                  hrefEditar={`/dashboard/hooks/nuevo?panel=editar&id=${fichaPanel.id}`}
                  hrefPlantilla={`/dashboard/hooks/nuevo?panel=plantilla&id=${fichaPanel.id}`}
                  hrefCerrar={hrefCerrar}
                />
              </PanelLateral>
            )}

            {fichaPanel && estado.panel === "borrar" && (
              <ModalConfirmacion
                hrefCerrar={hrefCerrar}
                tono="aviso"
                kicker="Borrar"
                titulo="¿Borrar esta ficha?"
              >
                <ConfirmarBorradoFicha ficha={fichaPanel} hrefCerrar={hrefCerrar} />
              </ModalConfirmacion>
            )}

            {fichaPanel && estado.panel === "referencia" && (
              <PanelLateral
                hrefCerrar={hrefCerrar}
                kicker="Banco de referencias"
                titulo="Guardar como referencia"
                descripcion="Lo que merece repetirse deja de vivir en el historial de una cuenta y pasa al banco del equipo."
              >
                <FormularioReferencia
                  referencia={null}
                  origen={{
                    fichaId: fichaPanel.id,
                    hablado: fichaPanel.hablado,
                    insertTitulo: fichaPanel.insertTitulo ?? "",
                    plataforma: fichaPanel.plataforma,

                    /*
                     * El territorio se SUGIERE desde el objetivo, no se decide.
                     * Cada objetivo del catalogo declara con que territorios se
                     * escribe; se propone el primero y queda a la vista para
                     * cambiarlo, que es mejor que dejar el desplegable vacio
                     * sabiendo la respuesta probable.
                     */
                    territorio: objetivoDe(fichaPanel.objetivo).territorios[0] ?? "",

                    /*
                     * El aprendizaje que se escribio al registrar metricas es
                     * literalmente lo que el banco llama lectura: por que
                     * funciono. Si existe, no hay que escribirlo dos veces.
                     */
                    lectura: fichaPanel.resultado?.aprendizaje ?? "",
                  }}
                  hrefCancelar={hrefCerrar}
                />
              </PanelLateral>
            )}
          </>
        }
      />
    </Wrapper>
  );
}
