"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Eraser, Save } from "lucide-react";

import { guardarResultados } from "@/actions/hooksDocumentacion";
import { Boton, Etiqueta } from "@/components/ui";
import { metricaDe, objetivoDe } from "@/lib/hooks/catalogo";
import { ESTADO_INICIAL } from "@/types";
import type { FichaConResultado } from "@/types";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";

import { aNumero, CamposMetricas, DiagnosticoHookRate } from "./CamposMetricas";

/**
 * El registro de metricas: el final del recorrido.
 *
 * LA PIEZA SE ELIGE ARRIBA, EN LA LISTA
 * -------------------------------------
 * Antes habia un desplegable que repetia la lista de pendientes que ya esta
 * encima. Sobraba, y ademas no funcionaba del todo: `fichaInicial` se metia en
 * un `useState`, que solo lee su valor al montar, asi que pulsar una fila
 * estando ya en la pantalla no rellenaba nada — solo funcionaba recargando.
 *
 * Ahora la ficha elegida ES la URL. Pulsar una fila navega a `?ficha=N` dentro
 * de la misma ruta, el servidor la valida contra las pendientes y este
 * formulario la recibe ya resuelta. La eleccion queda ademas enlazable y
 * sobrevive a recargar.
 *
 * Es de cliente porque el diagnostico de hook rate se calcula mientras se
 * teclea: ver la tasa antes de guardar es lo que hace que alguien note que
 * cruzo dos campos, la equivocacion mas comun al copiar cifras.
 */
export function FormularioMetricas({
  ficha,
  yaEnBanco = false,
  rutaLimpia,
}: {
  /** La pieza que se esta midiendo, resuelta en el servidor. */
  ficha: FichaConResultado | null;

  /** Ya esta en el banco de referencias: entonces no se ofrece, se dice. */
  yaEnBanco?: boolean;

  /** La misma ruta sin `?ficha`, para el boton de limpiar. */
  rutaLimpia: string;
}) {
  const router = useRouter();

  const [estado, enviar, enviando] = useActionState(guardarResultados, ESTADO_INICIAL);

  // El resultado sale como aviso flotante: en un formulario largo, una alerta
  // arriba queda fuera de la vista de quien acaba de pulsar el boton.
  useAvisoDeAccion(estado);

  const [impresiones, setImpresiones] = useState("");
  const [vistas, setVistas] = useState("");

  const fichaId = ficha?.id ?? null;

  /*
   * Al cambiar de pieza se vacian los dos campos que viven aqui.
   *
   * Los otros cinco, el checkbox del banco y el territorio viven dentro de
   * `CamposMetricas`, y se van con la `key` de mas abajo. Sin las dos cosas se
   * pueden registrar las cifras de una pieza sobre otra, que es justo el error
   * que este formulario existe para evitar — y con las filas de arriba
   * clicables es facil de provocar.
   *
   * Se ajusta DURANTE el render y no en un efecto: asi no hay un fotograma con
   * las cifras de la pieza anterior bajo la cabecera de la nueva. Es el patron
   * que React documenta para esto, y por eso el ultimo id vive en un estado.
   */
  const [ultimaFicha, setUltimaFicha] = useState(fichaId);

  if (fichaId !== ultimaFicha) {
    setUltimaFicha(fichaId);
    setImpresiones("");
    setVistas("");
  }

  const imp = aNumero(impresiones);
  const vis = aNumero(vistas);
  const cruzados = vis > imp;

  const limpiar = () => {
    setImpresiones("");
    setVistas("");
    router.replace(rutaLimpia, { scroll: false });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
      <form
        action={enviar}
        noValidate
        className="surge overflow-hidden rounded-[15px] border border-borde bg-superficie shadow-[var(--sombra)]"
      >
        <input type="hidden" name="fichaId" value={fichaId ?? ""} />

        {/*
          La cabecera dice QUE pieza se esta midiendo, y no se puede cambiar
          desde aqui: para eso esta la lista de arriba. Es la misma informacion
          que daba la ayuda del desplegable, pero leyendose de un vistazo.
        */}
        <div className="border-b border-borde px-[22px] py-[18px]">
          {ficha ? (
            <>
              <p className="mb-2 text-[10.5px] font-bold tracking-[0.1em] text-suave uppercase">
                Pieza que se mide
              </p>

              <p className="text-[15px] leading-snug font-bold tracking-[-0.02em]">
                &laquo;{ficha.hablado}&raquo;
              </p>

              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12px] text-suave">
                {ficha.notaAuditor !== null && (
                  <Etiqueta variante="contorno">nota {ficha.notaAuditor}</Etiqueta>
                )}
                <span>{ficha.empresaNombre}</span>
                <span aria-hidden="true">·</span>
                <span>{objetivoDe(ficha.objetivo).nombre}</span>
                <span aria-hidden="true">·</span>
                <span>se lee con {metricaDe(ficha.objetivo).toLowerCase()}</span>
              </div>
            </>
          ) : (
            <p className="text-[13px] leading-relaxed text-suave">
              <b className="text-texto">Elige una pieza de la lista de arriba.</b>{" "}
              Solo aparecen las que ya pasaron el auditor y aun no tienen
              resultado registrado.
            </p>
          )}
        </div>

        {/*
          Sin pieza no se pintan los campos: serian editables y no se podrian
          guardar, que es peor que no estar.
        */}
        {ficha && (
          <div className="px-[22px] py-[22px]">
            <div className="mb-5 rounded-xl border border-[#d77474] bg-[#fff2f1] px-4 py-3.5 text-[12.5px] leading-relaxed text-[#7f2b2b] dark-tema:bg-[rgb(215_116_116/0.12)] dark-tema:text-[#f0b8b8]">
              La lectura organica es direccional; no conviertas pequenas
              diferencias en certezas.
            </div>

            {/*
              La `key` remonta los campos al cambiar de pieza, y con ellos se
              van los cinco de `useCampos`, el checkbox del banco y el
              territorio. No puede ir sobre este componente en la page: al
              guardar, la ficha pasa a medida y sale de las pendientes, la key
              cambiaria, y el aviso de exito se perderia con el desmontaje.
            */}
            <CamposMetricas
              key={ficha.id}
              prefijo="metricas"
              impresiones={impresiones}
              alCambiarImpresiones={setImpresiones}
              vistas={vistas}
              alCambiarVistas={setVistas}
              cruzados={cruzados}
              errorVistas={estado.errores?.vistas3s}
              errorTerritorio={estado.errores?.territorioReferencia}
              errorAprendizaje={estado.errores?.aprendizaje}
              banco={{
                yaGuardada: yaEnBanco,
                territorioSugerido: objetivoDe(ficha.objetivo).territorios[0] ?? "",
              }}
            />

            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <Boton type="submit" disabled={enviando || cruzados}>
                <Save aria-hidden="true" />
                {enviando ? "Guardando…" : "Guardar resultados"}
              </Boton>

              {/* Limpiar suelta tambien la pieza: deja la URL sin `?ficha`, que
                  es lo que remonta los campos y devuelve la pantalla a cero. */}
              <Boton type="button" variante="fantasma" onClick={limpiar}>
                <Eraser aria-hidden="true" />
                Limpiar
              </Boton>

              <p className="text-[11.5px] font-medium text-suave">
                Los numeros se registran una vez: al guardarlos la pieza queda cerrada.
              </p>
            </div>
          </div>
        )}
      </form>

      {/* ================= el diagnostico, en vivo ================= */}
      <div className="surge [--retraso:0.06s]">
        <DiagnosticoHookRate impresiones={imp} vistas={vis} />
      </div>
    </div>
  );
}
