import type { Metadata } from "next";

import { Wrapper } from "@/components/layout/Wrapper";
import { ListadoVacio } from "@/components/listado";
import { FormularioMetricas, PendientesPaso } from "@/components/hooks";
import { BotonEnlace } from "@/components/ui";
import { requerirCargo } from "@/lib/sesion";
import * as fichasModelo from "@/models/fichas";
import * as referenciasModelo from "@/models/referencias";

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

  // Cuales de las pendientes ya estan en el banco: decide si el formulario
  // ofrece guardarla como referencia o dice que ya lo esta.
  const guardadas = await referenciasModelo.fichasGuardadas(
    pendientes.filas.map((ficha) => ficha.id),
  );

  /*
   * La ficha que llega elegida desde la lista.
   *
   * Se resuelve contra las pendientes en lugar de confiar en la URL: un
   * "?ficha=999" escrito a mano, o el de una pieza que ya se midio, no debe
   * dejar el formulario apuntando a algo que no esta en la lista.
   *
   * Se pasa la ficha entera y no las cincuenta: quitado el desplegable, el
   * formulario solo necesita la que se esta midiendo.
   */
  const pedida = typeof parametros.ficha === "string" ? parametros.ficha : "";
  const elegida = pendientes.filas.find((f) => String(f.id) === pedida) ?? null;

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
            descripcion="Pulsa una para rellenar sus metricas aqui debajo."
            accion="Registrar"
            hrefDe={(ficha) => `${RUTA}?ficha=${ficha.id}`}
            activoId={elegida?.id ?? null}
            vacio="Ninguna pieza espera numeros."
          />

          <div className="mt-5">
            <FormularioMetricas
              ficha={elegida}
              yaEnBanco={elegida !== null && guardadas.has(elegida.id)}
              rutaLimpia={RUTA}
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
            <BotonEnlace href="/dashboard/hooks/historial" tamano="chico" variante="fantasma" scroll>
              Ver el historial
            </BotonEnlace>
          }
        />
      )}
    </Wrapper>
  );
}
