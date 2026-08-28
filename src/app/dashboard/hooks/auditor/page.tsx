import type { Metadata } from "next";
import { ArrowRight, Pencil } from "lucide-react";

import { Wrapper } from "@/components/layout/Wrapper";
import {
  AuditorSuelto,
  FiltroCalidad,
  PendientesPaso,
  ResultadoAuditoria,
} from "@/components/hooks";
import { BotonEnlace, Etiqueta } from "@/components/ui";
import { auditar, limitesPorDefecto } from "@/lib/hooks/auditor";
import { objetivoDe } from "@/lib/hooks/catalogo";
import { requerirCargo } from "@/lib/sesion";
import * as empresasModelo from "@/models/empresas";
import * as fichasModelo from "@/models/fichas";
import * as reglasModelo from "@/models/reglasHook";

/**
 * El paso 04: donde se juzga una pieza antes de producirla.
 *
 * Aqui se llega de dos formas y las dos importan:
 *
 * - Desde el canvas, al pulsar «Auditar». La ficha llega ya guardada y con su
 *   nota, y esta pantalla muestra el veredicto. Antes ese veredicto se
 *   desplegaba debajo del formulario, lo que mezclaba escribir con juzgar.
 * - A pelo, para revisar un texto suelto o mirar que hay pendiente.
 */

export const metadata: Metadata = {
  title: "Auditor de hooks",
};

const MIGAS = [
  { texto: "Conejo App", href: "/dashboard" },
  { texto: "Hooks", href: "/dashboard/hooks" },
  { texto: "Auditor" },
];

function comoId(valor: unknown): number | null {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

export default async function PaginaAuditor(
  props: PageProps<"/dashboard/hooks/auditor">,
) {
  await requerirCargo("redes");

  const parametros = await props.searchParams;
  const idPedida = comoId(parametros.ficha);

  const [empresas, pendientes, ficha] = await Promise.all([
    empresasModelo.listarActivas(),

    // Un borrador es, por definicion, una pieza escrita que aun no ha pasado
    // por aqui: son exactamente las que este paso tiene pendientes.
    fichasModelo.listar({
      estado: ["borrador"],
      orden: "actualizadoEn",
      direccion: "desc",
      porPagina: 50,
    }),

    idPedida !== null ? fichasModelo.buscarPorId(idPedida) : null,
  ]);

  /*
   * El veredicto se vuelve a calcular aqui, no viaja por la URL.
   *
   * El auditor es una funcion pura y determinista sobre el texto de la ficha y
   * la regla de su cliente, asi que el resultado es exactamente el mismo que
   * se calculo al guardar. Pasarlo por la URL obligaria a serializar los nueve
   * controles y dejaria una direccion que se puede alterar a mano para
   * ensenar una nota que nadie calculo.
   */
  const limites = ficha ? await reglasModelo.limitesDeEmpresa(ficha.empresaId) : null;

  const resultado = ficha
    ? auditar({
        hablado: ficha.hablado,
        insertTitulo: ficha.insertTitulo,
        prueba: ficha.prueba,
        regla: limites,
      })
    : null;

  const estandar = limitesPorDefecto();

  return (
    <Wrapper
      migas={MIGAS}
      kicker="04 / Auditor"
      titulo="Control previo"
      descripcion="Nueve controles conocidos antes de grabar. Umbral de paso visible: 70/100."
    >
      {/*
        El aviso va ANTES de cualquier cosa, y se queda siempre. Es una
        decision etica del producto, no un adorno: la puntuacion no esta
        contrastada contra resultados y quien la lee tiene derecho a saberlo
        antes de fiarse de ella.
      */}
      <div className="surge mb-[22px] rounded-xl border border-[#d77474] bg-[#fff2f1] px-4 py-3.5 text-[12.5px] leading-relaxed text-[#7f2b2b] dark-tema:bg-[rgb(215_116_116/0.12)] dark-tema:text-[#f0b8b8]">
        <b>Esta puntuacion todavia no esta validada.</b> Los controles salen de
        investigacion disponible y criterio de la casa, no de un modelo
        contrastado contra resultados. Usala como lista de comprobacion, no
        como oraculo.
      </div>

      {ficha && resultado && (
        <section className="surge mb-5">
          {/*
            Se dice DE QUE pieza es la nota. Sin esto, quien llega desde el
            canvas ve un veredicto suelto y no sabe si corresponde a lo que
            acaba de escribir o a otra cosa.
          */}
          <div className="mb-3.5 overflow-hidden rounded-[15px] border border-borde bg-superficie px-[22px] py-[18px] shadow-[var(--sombra)]">
            <p className="mb-2 text-[10.5px] font-bold tracking-[0.1em] text-suave uppercase">
              La pieza auditada
            </p>

            <p className="text-[17px] leading-snug font-bold tracking-[-0.02em]">
              &laquo;{ficha.hablado}&raquo;
            </p>

            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12px] text-suave">
              <Etiqueta variante="contorno">Auditada</Etiqueta>
              <span>{ficha.empresaNombre}</span>
              <span aria-hidden="true">·</span>
              <span>{objetivoDe(ficha.objetivo).nombre}</span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2.5 border-t border-borde pt-4">
              <BotonEnlace
                href={`/dashboard/hooks/nuevo?panel=editar&id=${ficha.id}`}
                variante="fantasma"
                tamano="chico"
              >
                <Pencil aria-hidden="true" />
                Corregir y volver a auditar
              </BotonEnlace>

              {/* El paso siguiente solo se ofrece si la pieza lo merece: con la
                  nota por debajo del umbral, invitar a medir seria empujar a
                  producir algo que el propio control acaba de desaconsejar. */}
              {resultado.aprobado && (
                <BotonEnlace href="/dashboard/hooks/metricas" tamano="chico">
                  Registrar sus metricas
                  <ArrowRight aria-hidden="true" />
                </BotonEnlace>
              )}
            </div>
          </div>

          <ResultadoAuditoria resultado={resultado} />
        </section>
      )}

      {/*
        La cola va antes del auditor de texto suelto. Auditar una pieza escrita
        es el trabajo; probar una frase suelta es la herramienta que ayuda
        mientras se escribe. Con la cola debajo, quien entraba aqui no llegaba
        a enterarse de que tenia borradores esperando.
      */}
      <PendientesPaso
        fichas={pendientes.filas}
        titulo="Esperan auditoria"
        descripcion="Borradores escritos que todavia no han pasado el control. Se auditan desde el canvas, con el boton Auditar."
        accion="Auditar"
        hrefDe={(pendiente) => `/dashboard/hooks/nuevo?panel=editar&id=${pendiente.id}`}
        vacio="Ningun borrador espera auditoria. Todo lo escrito ya paso el control."
      />

      <div className="mt-5">
        <AuditorSuelto
          empresas={empresas}
          limiteVoz={estandar.maxPalabrasVoz}
          limiteInsert={estandar.maxPalabrasInsert}
        />
      </div>

      <div className="mt-5">
        <FiltroCalidad />
      </div>
    </Wrapper>
  );
}
