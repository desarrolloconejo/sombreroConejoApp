import type { Metadata } from "next";

import { Wrapper } from "@/components/layout/Wrapper";
import { ListadoVacio } from "@/components/listado";
import { FormularioMetricas, PendientesPaso } from "@/components/hooks";
import { BotonEnlace } from "@/components/ui";
import { requerirCargo } from "@/lib/sesion";
import * as fichasModelo from "@/models/fichas";

/**
 * El registro de metricas: el final del recorrido.
 *
 * Una pieza esta terminada cuando tiene sus numeros, no cuando saca buena nota
 * en el auditor. Por eso este paso existe aparte y no dentro del canvas.
 */

export const metadata: Metadata = {
  title: "Metricas de hooks",
};

const RUTA = "/dashboard/hooks/metricas";

const MIGAS = [
  { texto: "Conejo App", href: "/dashboard" },
  { texto: "Hooks", href: "/dashboard/hooks" },
  { texto: "Metricas" },
];

export default async function PaginaMetricas(
  props: PageProps<"/dashboard/hooks/metricas">,
) {
  const usuario = await requerirCargo("redes");

  const parametros = await props.searchParams;

  // Se piden mas de las que caben en un desplegable comodo y se cortan aqui:
  // si hay veinte pendientes, el problema no es el desplegable.
  const pendientes = await fichasModelo.listar({
    estado: ["auditada"],
    orden: "actualizadoEn",
    direccion: "desc",
    porPagina: 50,
  });

  // El recuento es el de quien mira, igual que en la portada: dice cuantas
  // piezas propias faltan por cerrar, no cuantas tiene la agencia.
  const conteo = await fichasModelo.contarPorEstado(usuario.id);

  /*
   * La ficha que llega ya elegida desde la lista.
   *
   * Se valida contra las pendientes en lugar de confiar en la URL: un
   * "?ficha=999" escrito a mano no debe dejar el desplegable en un estado que
   * no corresponde a ninguna opcion.
   */
  const pedida = typeof parametros.ficha === "string" ? parametros.ficha : "";
  const fichaInicial = pendientes.filas.some((f) => String(f.id) === pedida)
    ? pedida
    : "";

  return (
    <Wrapper
      migas={MIGAS}
      kicker="05 / Metricas"
      titulo="Lo que paso de verdad"
      descripcion="El final del recorrido. Una pieza esta terminada cuando tiene sus numeros registrados: la nota del auditor es un control por el camino, no un resultado."
    >
      {pendientes.filas.length > 0 ? (
        <>
          {/*
            La cola va antes del formulario. Escondida dentro del desplegable
            no se veia hasta abrirlo, asi que para saber que faltaba por medir
            habia que ir al historial y volver.
          */}
          <PendientesPaso
            fichas={pendientes.filas}
            titulo="Esperan sus numeros"
            descripcion="Piezas auditadas y publicadas a las que solo les faltan las metricas para quedar terminadas."
            accion="Registrar"
            hrefDe={(ficha) => `${RUTA}?ficha=${ficha.id}`}
            vacio="Ninguna pieza espera numeros."
          />

          <div className="mt-5">
            <FormularioMetricas
              fichas={pendientes.filas}
              fichaInicial={fichaInicial}
            />
          </div>
        </>
      ) : (
        <ListadoVacio
          titulo={
            conteo.medida > 0
              ? "Ninguna pieza espera numeros"
              : "Todavia no hay nada que medir"
          }
          descripcion={
            conteo.borrador > 0
              ? `Hay ${conteo.borrador} ${conteo.borrador === 1 ? "borrador" : "borradores"} sin auditar. Una pieza llega aqui despues de pasar por el auditor y publicarse.`
              : "Una pieza llega aqui despues de escribirse, auditarse y publicarse."
          }
          accion={
            <BotonEnlace href="/dashboard/hooks/historial" tamano="chico" variante="fantasma">
              Ver el historial
            </BotonEnlace>
          }
        />
      )}
    </Wrapper>
  );
}
