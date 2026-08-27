import type { Metadata } from "next";
import { Plus } from "lucide-react";

import { Wrapper } from "@/components/layout/Wrapper";
import { Listado, ListadoVacio } from "@/components/listado";
import { columnasFichas, filtrosFichas } from "@/components/hooks/ColumnasFichas";
import { BotonEnlace } from "@/components/ui";
import { leerEstadoListado } from "@/lib/parametros";
import { requerirCargo } from "@/lib/sesion";
import * as empresasModelo from "@/models/empresas";
import * as fichasModelo from "@/models/fichas";
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
 */
function comoEstado(valor: string | undefined): EstadoFicha | undefined {
  return ESTADOS.find((e) => e === valor);
}

function comoObjetivo(valor: string | undefined): SlugObjetivo | undefined {
  return OBJETIVOS.find((o) => o === valor);
}

function comoEmpresa(valor: string | undefined): number | undefined {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : undefined;
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

  const [pagina, empresas] = await Promise.all([
    fichasModelo.listar({
      busqueda: estado.busqueda || undefined,
      estado: comoEstado(estado.filtros.estado),
      empresaId: comoEmpresa(estado.filtros.empresa),
      objetivo: comoObjetivo(estado.filtros.objetivo),
      orden: estado.orden,
      direccion: estado.direccion,
      pagina: estado.pagina,
      porPagina: estado.porPagina,
    }),
    empresasModelo.listarActivas(),
  ]);

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
        columnas={columnasFichas(RUTA, estado)}
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
      />
    </Wrapper>
  );
}
