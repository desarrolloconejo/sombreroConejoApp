"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eraser, Pencil, Zap } from "lucide-react";

import { enviarAuditor } from "@/actions/hooks";
import { Boton, BotonEnlace, Etiqueta, Selector } from "@/components/ui";
import { contarPalabras } from "@/lib/hooks/auditor";
import { objetivoDe } from "@/lib/hooks/catalogo";
import { MINIMO_PALABRAS } from "@/lib/hooks/listas";
import { ESTADO_AUDITORIA } from "@/types";
import type { Empresa, EstadoAuditoria, FichaHook, ResultadoAuditoria as Resultado } from "@/types";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";

import { FiltroCalidad } from "./FiltroCalidad";
import { ResultadoAuditoria } from "./ResultadoAuditoria";

/**
 * El auditor. Una sola tarjeta, con o sin ficha detras.
 *
 * POR QUE ES UNA Y NO DOS
 * -----------------------
 * Antes esta pantalla montaba el resultado DOS VECES al llegar desde el
 * canvas: arriba una tarjeta con la nota real de la pieza, y aqui debajo un
 * formulario vacio con un `ResultadoNeutro` que decia «el score aparece solo
 * despues de pulsar Auditar» —justo debajo de un score que ya existia—. Daba
 * la impresion de que habia dos auditores y que el de abajo no habia evaluado
 * nada.
 *
 * Ahora la pieza que viene del canvas ATERRIZA AQUI: el formulario llega
 * relleno con su texto y la columna de al lado con su veredicto. Sigue siendo
 * el mismo auditor que sirve para probar una frase suelta; simplemente puede
 * venir con algo dentro.
 *
 * Nada de resultado se pinta hasta que hay auditoria: sin ella, el formulario
 * ocupa el ancho entero y no hay ninguna tarjeta esperando a llenarse.
 */
export function Auditor({
  empresas,
  limiteVoz,
  limiteInsert,
  ficha = null,
  resultadoInicial = null,
  hrefCorregir,
  hrefMetricas = null,
  rutaLimpia,
}: {
  empresas: Empresa[];

  /** Los limites de la regla activa, o el estandar de la casa. */
  limiteVoz: number;
  limiteInsert: number;

  /** La pieza que llega ya guardada y auditada desde el canvas. */
  ficha?: FichaHook | null;

  /**
   * Su veredicto, recalculado en el servidor.
   *
   * Llega junto a la ficha porque en el servidor se audita con la regla del
   * cliente y con el campo `prueba`, que este formulario no muestra. Sembrarlo
   * evita que la tarjeta arranque en blanco teniendo la nota ya calculada.
   */
  resultadoInicial?: Resultado | null;

  /** Volver al canvas a reescribir la pieza. Solo con ficha. */
  hrefCorregir?: string;

  /** El paso siguiente, si la nota lo merece. Null si no. */
  hrefMetricas?: string | null;

  /** El auditor sin ficha, para el boton de empezar de cero. */
  rutaLimpia: string;
}) {
  const router = useRouter();

  /*
   * El estado arranca con el veredicto ya calculado cuando hay ficha.
   *
   * `useAvisoDeAccion` compara la IDENTIDAD del estado y sale en el primer
   * render, asi que sembrarlo no dispara ningun aviso flotante: solo avisa
   * cuando de verdad se pulsa el boton.
   */
  const inicial: EstadoAuditoria =
    ficha && resultadoInicial
      ? { ok: true, resultado: resultadoInicial, fichaId: ficha.id }
      : ESTADO_AUDITORIA;

  const [estado, enviar, enviando] = useActionState(enviarAuditor, inicial);

  useAvisoDeAccion(estado);

  const [hablado, setHablado] = useState(ficha?.hablado ?? "");
  const [insertTitulo, setInsertTitulo] = useState(ficha?.insertTitulo ?? "");
  const [empresaId, setEmpresaId] = useState(ficha ? String(ficha.empresaId) : "");

  const errores = estado.errores ?? {};
  const palabras = contarPalabras(hablado);
  const palabrasInsert = contarPalabras(insertTitulo);

  const resultado = estado.resultado ?? null;

  /*
   * Un borrador llega de la cola de «Esperan auditoria»; una auditada, del
   * canvas. Se distinguen porque lo que se ofrece no es lo mismo: al borrador
   * hay que poder ponerle la nota desde aqui, y a la auditada ya la tiene.
   */
  const esBorrador = ficha?.estado === "borrador";

  /*
   * Empezar de cero con una ficha delante NO es vaciar los campos: hay que
   * soltar tambien su veredicto, y eso vive en `useActionState`, que no se
   * puede resetear. Se navega al auditor sin `?ficha`, y la `key` de la page
   * remonta el componente entero.
   */
  const empezarDeCero = () => {
    if (ficha) {
      router.replace(rutaLimpia, { scroll: false });
      return;
    }

    setHablado("");
    setInsertTitulo("");
  };

  return (
    <>
      <div
        className={[
          "grid gap-5",
          // La segunda columna solo existe si hay algo que poner en ella. Sin
          // esto, sin auditar quedaba un hueco de 420 px al lado del formulario.
          resultado ? "lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start" : "",
        ].join(" ")}
      >
        <form
          action={enviar}
          noValidate
          className="surge flex flex-col gap-5 rounded-[15px] border border-borde bg-superficie px-[26px] py-6 shadow-[var(--sombra)]"
        >
          <input type="hidden" name="empresaId" value={empresaId} />

          {/*
            La prueba viaja escondida cuando hay ficha.
            El formulario no la muestra —no es texto del hook— pero el auditor la
            mira si la regla del cliente exige prueba visible. Sin esto, volver a
            pulsar «Auditar» aqui daria una nota distinta de la que se guardo.
          */}
          {ficha?.prueba && (
            <input type="hidden" name="prueba" value={ficha.prueba} />
          )}

          {/*
            De que pieza se trata, cuando viene una. Es lo unico que aportaba la
            tarjeta que se elimino, y aqui esta pegado al texto que describe.
          */}
          {ficha && (
            <div className="-mx-[26px] -mt-6 border-b border-borde px-[26px] pt-[22px] pb-5">
              <input type="hidden" name="id" value={ficha.id} />

              <p className="mb-2 text-[10.5px] font-bold tracking-[0.1em] text-suave uppercase">
                {esBorrador ? "Borrador cargado de la cola" : "La pieza auditada"}
              </p>

              <div className="flex flex-wrap items-center gap-2 text-[12px] text-suave">
                <Etiqueta variante="contorno">
                  {esBorrador ? "Borrador" : "Auditada"}
                </Etiqueta>
                <span>{ficha.empresaNombre}</span>
                <span aria-hidden="true">·</span>
                <span>{objetivoDe(ficha.objetivo).nombre}</span>
              </div>

              {/* Un borrador llega con el veredicto ya calculado, pero sin
                  guardar: la nota no es suya hasta que se pulsa el boton. */}
              {esBorrador && (
                <p className="mt-2.5 text-[11.5px] leading-relaxed text-suave">
                  El resultado de al lado es una <b className="text-texto">prueba</b>:
                  la ficha sigue siendo un borrador y sigue en la cola hasta que
                  guardes la auditoria.
                </p>
              )}

              <div className="mt-3.5 flex flex-wrap gap-2.5">
                {hrefCorregir && (
                  <BotonEnlace href={hrefCorregir} variante="fantasma" tamano="chico">
                    <Pencil aria-hidden="true" />
                    Corregir y volver a auditar
                  </BotonEnlace>
                )}

                {/* El paso siguiente solo se ofrece si la pieza lo merece: con la
                    nota por debajo del umbral, invitar a medir seria empujar a
                    producir lo que el propio control acaba de desaconsejar. */}
                {hrefMetricas && (
                  <BotonEnlace href={hrefMetricas} tamano="chico">
                    Registrar sus metricas
                    <ArrowRight aria-hidden="true" />
                  </BotonEnlace>
                )}
              </div>
            </div>
          )}

          <Selector
            id="auditor-empresa"
            nombre="_empresaId"
            etiqueta="Cliente"
            marcador="Estandar de agencia (12/6)"
            valorInicial={empresaId}
            onCambio={setEmpresaId}
            opciones={empresas.map((e) => ({
              valor: String(e.id),
              texto: e.nombre,
              detalle: e.sector ?? undefined,
            }))}
            ayuda="Solo decide con que limites se mide. Sin cliente se usa el estandar de la casa."
          />

          <div>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
              <label htmlFor="auditor-hablado" className="text-xs font-semibold">
                Hook hablado
              </label>
              <span className="text-[11.5px] font-medium text-suave">
                <b className="font-bold text-acento">{palabras}</b> palabras · minimo{" "}
                {MINIMO_PALABRAS}, recomendado 7&ndash;{limiteVoz}
              </span>
            </div>

            <textarea
              id="auditor-hablado"
              name="hablado"
              value={hablado}
              onChange={(e) => setHablado(e.target.value)}
              rows={4}
              maxLength={400}
              placeholder="Pega o escribe el hook que quieres revisar."
              className={[
                "suave w-full rounded-xl border-[1.5px] border-borde bg-campo px-3.5 py-3",
                "text-[15px] leading-relaxed text-texto placeholder:text-suave",
                "focus:border-acento focus:bg-superficie focus:shadow-[var(--foco)] focus:outline-none",
                errores.hablado ? "border-blackberry" : "",
              ].join(" ")}
            />

            {errores.hablado && (
              <p role="alert" className="mt-1.5 text-[11.5px] font-medium text-blackberry dark-tema:text-[#e9a9cd]">
                {errores.hablado}
              </p>
            )}
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
              <label htmlFor="auditor-insert" className="text-xs font-semibold">
                Insert-Titulo{" "}
                <span className="font-normal text-suave">(opcional)</span>
              </label>
              <span className="text-[11.5px] font-medium text-suave">
                <b className="font-bold text-acento">{palabrasInsert}</b> palabras ·
                maximo {limiteInsert}
              </span>
            </div>

            <input
              id="auditor-insert"
              name="insertTitulo"
              value={insertTitulo}
              onChange={(e) => setInsertTitulo(e.target.value)}
              maxLength={160}
              placeholder="El nucleo de la promesa"
              className="suave min-h-11 w-full rounded-xl border-[1.5px] border-borde bg-campo px-3.5 py-3 text-[13.5px] text-texto placeholder:text-suave focus:border-acento focus:bg-superficie focus:shadow-[var(--foco)] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-2.5 pt-1">
            {/*
              Con una ficha delante hay DOS envios sobre el mismo formulario, y
              el valor del boton pulsado decide cual: probar no toca la base y
              guardar le pone la nota a la ficha. Es el mismo reparto que hace
              el canvas entre guardar y auditar.
            */}
            {ficha ? (
              <>
                <Boton type="submit" name="accion" value="guardar" disabled={enviando}>
                  <Zap aria-hidden="true" />
                  {enviando ? "Auditando…" : "Auditar y guardar"}
                </Boton>

                <Boton
                  type="submit"
                  name="accion"
                  value="probar"
                  variante="fantasma"
                  disabled={enviando}
                >
                  Probar sin guardar
                </Boton>
              </>
            ) : (
              <Boton type="submit" disabled={enviando}>
                <Zap aria-hidden="true" />
                {enviando ? "Auditando…" : "Auditar hook"}
              </Boton>
            )}

            <Boton type="button" variante="fantasma" onClick={empezarDeCero}>
              <Eraser aria-hidden="true" />
              {ficha ? "Empezar de cero" : "Limpiar"}
            </Boton>
          </div>

          {ficha && (
            <p className="-mt-2 text-[11.5px] leading-relaxed text-suave">
              {esBorrador
                ? "Guardar le pone la nota a la ficha, la saca de la cola y guarda el hablado y el Insert-Titulo tal como estan aqui."
                : "Guardar recalcula su nota con el texto que haya ahora en los dos campos."}
            </p>
          )}
        </form>

        {/*
          Sin auditoria no se pinta NADA aqui, ni siquiera un marcador de sitio.
          El que habia decia que el resultado aparece despues de pulsar Auditar,
          y con una ficha delante se leia debajo de un resultado que ya estaba.
        */}
        {resultado && (
          <div className="surge [--retraso:0.06s]">
            <ResultadoAuditoria resultado={resultado} />
          </div>
        )}
      </div>

      {/*
        EL FILTRO VIVE AQUI, Y NO EN LA PAGE.

        Son las comprobaciones que ningun algoritmo puede hacer —si el
        contenido puede demostrar lo que promete, si el tono es de este
        cliente— y solo tienen sentido sobre una pieza ya auditada. Puesto en
        la page solo sabria de las que llegan con ficha; aqui aparece tambien
        despues de auditar un texto suelto, que es cuando hace falta.
      */}
      {resultado && (
        <div className="mt-5">
          <FiltroCalidad />
        </div>
      )}
    </>
  );
}
