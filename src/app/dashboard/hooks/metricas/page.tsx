import type { Metadata } from "next";

import { Wrapper } from "@/components/layout/Wrapper";
import { FormularioMetricas } from "@/components/hooks/FormularioMetricas";
import { ListadoVacio } from "@/components/listado";
import { BotonEnlace } from "@/components/ui";
import { requerirCargo } from "@/lib/sesion";
import * as fichasModelo from "@/models/fichas";

/**
 * El registro de metricas: el final del recorrido.
 *
 * Solo ofrece las fichas que aun no tienen resultado. Ofrecer las medidas
 * mezclaria dos cosas distintas —registrar y corregir— en el mismo
 * desplegable, y corregir se hace desde el historial, sobre la ficha.
 */

export const metadata: Metadata = {
  title: "Metricas de hooks",
};

const MIGAS = [
  { texto: "Conejo App", href: "/dashboard" },
  { texto: "Hooks", href: "/dashboard/hooks" },
  { texto: "Metricas" },
];

export default async function PaginaMetricas() {
  const usuario = await requerirCargo("redes");

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

  return (
    <Wrapper
      migas={MIGAS}
      kicker="05 / Metricas"
      titulo="Lo que paso de verdad"
      descripcion="El final del recorrido. Una pieza esta terminada cuando tiene sus numeros registrados: la nota del auditor es un control por el camino, no un resultado."
    >
      {pendientes.filas.length > 0 ? (
        <FormularioMetricas fichas={pendientes.filas} />
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
