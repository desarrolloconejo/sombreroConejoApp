"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Save, Zap } from "lucide-react";

import { enviarCanvas } from "@/actions/hooks";
import { Boton, Campo, Selector } from "@/components/ui";
import { contarPalabras } from "@/lib/hooks/auditor";
import { metricaDe, OBJETIVOS, PLATAFORMAS } from "@/lib/hooks/catalogo";
import { ESTADO_AUDITORIA } from "@/types";
import type { Empresa, FichaHook, ReferenciaHook } from "@/types";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";

import { FichaProduccion, type ValoresFicha } from "./FichaProduccion";

/**
 * El canvas: la decision completa de una pieza.
 *
 * Es de cliente por dos motivos concretos, no por costumbre: los contadores
 * de palabras tienen que responder a cada tecla, y la ficha del final se
 * regenera con lo que hay escrito ahora mismo. Sin eso no se sabria si el
 * hablado se pasa de 12 hasta despues de enviar.
 *
 * Los campos van CONTROLADOS, los catorce. Es lo que hace que la ficha sea de
 * verdad un espejo de lo escrito y no una copia que se queda atras.
 */

const CAMPOS_VACIOS = {
  empresaId: "",
  objetivo: "",
  plataforma: "",
  audiencia: "",
  tension: "",
  verdadMarca: "",
  prueba: "",
  hablado: "",
  insertTitulo: "",
  primerFotograma: "",
  pagoPromesa: "",
  cta: "",
  riesgoClaim: "",
};

type Campos = typeof CAMPOS_VACIOS;

/**
 * Los valores iniciales del formulario.
 *
 * En modo PLANTILLA se copia todo menos el cliente. Es a proposito: una
 * plantilla sirve para repetir una formula que funciono, y lo normal es
 * llevarla a otra cuenta. Heredar el cliente haria que se guardara sin
 * mirarlo, y ademas es el cliente el que decide que regla aplica el auditor:
 * elegirlo es una decision, no un tramite.
 */
function desdeFicha(ficha: FichaHook | null, plantilla = false): Campos {
  if (!ficha) return CAMPOS_VACIOS;

  return {
    empresaId: plantilla ? "" : String(ficha.empresaId),
    objetivo: ficha.objetivo,
    plataforma: ficha.plataforma,
    audiencia: ficha.audiencia ?? "",
    tension: ficha.tension ?? "",
    verdadMarca: ficha.verdadMarca ?? "",
    prueba: ficha.prueba ?? "",
    hablado: ficha.hablado,
    insertTitulo: ficha.insertTitulo ?? "",
    primerFotograma: ficha.primerFotograma ?? "",
    pagoPromesa: ficha.pagoPromesa ?? "",
    cta: ficha.cta ?? "",
    riesgoClaim: ficha.riesgoClaim ?? "",
  };
}

/**
 * Los valores iniciales al partir de una referencia del banco.
 *
 * Se copian TRES campos y ni uno mas, porque son los tres que una referencia
 * tiene: el hook observado, su Insert-Titulo y la plataforma donde se vio. El
 * objetivo, la audiencia y la tension no se heredan porque no existen ahi —
 * una referencia es material observado, no una decision tomada— y rellenarlos
 * a ojo seria inventarle a la pieza una intencion que nadie eligio.
 */
function desdeReferencia(referencia: ReferenciaHook): Campos {
  return {
    ...CAMPOS_VACIOS,
    plataforma: referencia.plataforma,
    hablado: referencia.hablado,
    insertTitulo: referencia.insertTitulo ?? "",
  };
}

/** El contador de palabras: verde dentro del limite, morado al pasarse. */
function Contador({ texto, maximo }: { texto: string; maximo: number }) {
  const palabras = contarPalabras(texto);

  return (
    <span className="text-[11.5px] font-medium text-suave">
      <b
        className={
          palabras > maximo
            ? "font-bold text-blackberry dark-tema:text-[#e9a9cd]"
            : "font-bold text-acento"
        }
      >
        {palabras}
      </b>
      /{maximo} palabras
    </span>
  );
}

export function FormularioHook({
  empresas,
  ficha,
  referencia = null,
  limiteVoz,
  limiteInsert,
  etiquetaRegla,
  hrefNuevaEmpresa,
  plantilla = false,
  tarea = null,
}: {
  /**
   * La tarea que cumple esta ficha, si se llego desde una. Viaja en el
   * formulario y propone el cliente de su proyecto.
   */
  tarea?: { id: number; empresaId: number } | null;

  empresas: Empresa[];
  ficha: FichaHook | null;

  /**
   * Se parte de una referencia del banco en lugar de una ficha.
   *
   * Nunca llega junto con `ficha`: son dos origenes distintos de la misma
   * pantalla. Tiene prioridad porque la page solo la resuelve cuando el enlace
   * la pidio expresamente.
   */
  referencia?: ReferenciaHook | null;

  /**
   * Se parte de `ficha` pero se guarda como una pieza NUEVA.
   *
   * Lo unico que decide crear o actualizar es el input oculto con el id: en
   * modo plantilla no se emite, asi que la action toma el camino de crear y la
   * ficha de la que se partio queda intacta.
   */
  plantilla?: boolean;

  /** Los limites de la regla activa, o el estandar de la casa. */
  limiteVoz: number;
  limiteInsert: number;
  etiquetaRegla: string;

  /** Salida cuando falta el cliente. Sin esto el desplegable es un muro. */
  hrefNuevaEmpresa: string;
}) {
  const [estado, enviar, enviando] = useActionState(enviarCanvas, ESTADO_AUDITORIA);

  // El resultado sale como aviso flotante: en un formulario largo, una alerta
  // arriba queda fuera de la vista de quien acaba de pulsar el boton.
  useAvisoDeAccion(estado);
  const [campos, setCampos] = useState<Campos>(() => {
    const iniciales = referencia ? desdeReferencia(referencia) : desdeFicha(ficha, plantilla);

    return tarea && !iniciales.empresaId
      ? { ...iniciales, empresaId: String(tarea.empresaId) }
      : iniciales;
  });

  /*
   * Sobre que ficha se esta escribiendo ahora mismo.
   *
   * Al abrir una plantilla no hay ninguna —se parte de otra pero se guarda
   * como nueva—, y en cuanto el primer guardado devuelve su id, el formulario
   * lo adopta y los siguientes actualizan esa misma. En modo edicion normal es
   * el de la ficha desde el principio.
   */
  const idActual = estado.fichaId ?? (plantilla ? null : (ficha?.id ?? null));

  const errores = estado.errores ?? {};
  const cambiar = (clave: keyof Campos) => (valor: string) =>
    setCampos((previos) => ({ ...previos, [clave]: valor }));

  const empresa = empresas.find((e) => String(e.id) === campos.empresaId);

  const valoresFicha: ValoresFicha = {
    empresaNombre: empresa?.nombre ?? "",
    objetivo: campos.objetivo,
    plataforma: campos.plataforma,
    audiencia: campos.audiencia,
    tension: campos.tension,
    verdadMarca: campos.verdadMarca,
    prueba: campos.prueba,
    hablado: campos.hablado,
    insertTitulo: campos.insertTitulo,
    primerFotograma: campos.primerFotograma,
    pagoPromesa: campos.pagoPromesa,
    cta: campos.cta,
    riesgoClaim: campos.riesgoClaim,
    nota: estado.resultado?.nota ?? ficha?.notaAuditor ?? null,
    aprobado: estado.resultado?.aprobado ?? false,
  };

  return (
    <form action={enviar} noValidate className="flex flex-col gap-5">
      {/*
        ESTE INPUT ES LO UNICO QUE DECIDE CREAR O ACTUALIZAR.

        En modo plantilla no se emite al principio, asi que el primer guardado
        crea una pieza nueva y la original no se toca. Pero en cuanto existe,
        la action devuelve su id y a partir de ahi el formulario lo lleva: sin
        eso, pulsar "Guardar" dos veces crearia dos fichas iguales.
      */}
      {idActual !== null && <input type="hidden" name="id" value={idActual} />}
      {tarea && <input type="hidden" name="tareaId" value={tarea.id} />}

      {/* Los controlados viajan igual, pero se declaran explicitos para que
          el formulario siga sirviendo si el estado se quedara atras. */}
      {Object.entries(campos).map(([clave, valor]) => (
        <input key={clave} type="hidden" name={clave} value={valor} />
      ))}


      {/* ================= contexto ================= */}
      <section className="surge rounded-[15px] border border-borde bg-superficie px-[26px] py-6 shadow-[var(--sombra)]">
        <p className="mb-4 flex items-center gap-3 text-[10.5px] font-bold tracking-[0.12em] text-suave uppercase">
          Contexto
          <span aria-hidden="true" className="h-px flex-1 bg-borde" />
        </p>

        <div className="grid gap-[18px] sm:grid-cols-2">
          <div>
            <Selector
              id="hook-empresa"
              nombre="_empresaId"
              etiqueta="Cliente"
              marcador="Elige un cliente"
              requerido
              valorInicial={campos.empresaId}
              onCambio={cambiar("empresaId")}
              opciones={empresas.map((e) => ({
                valor: String(e.id),
                texto: e.nombre,
                detalle: e.sector ?? undefined,
              }))}
              ayuda={`Decide la regla del auditor. Ahora manda «${etiquetaRegla}».`}
              error={errores.empresaId}
            />

            {/*
              Sin empresas el desplegable salia vacio, obligatorio y sin
              explicacion: no habia forma de guardar una ficha ni de saber por
              que. Ahora dice que falta y a donde ir.
            */}
            {empresas.length === 0 && (
              <p className="mt-2 text-[11.5px] leading-relaxed text-blackberry dark-tema:text-[#e9a9cd]">
                Todavia no hay ninguna empresa registrada.{" "}
                <Link
                  href={hrefNuevaEmpresa}
                  scroll={false}
                  className="font-semibold underline"
                >
                  Registra la primera
                </Link>{" "}
                para poder escribir la ficha.
              </p>
            )}
          </div>

          <Selector
            id="hook-objetivo"
            nombre="_objetivo"
            etiqueta="Objetivo de la pieza"
            marcador="Elige un objetivo"
            requerido
            valorInicial={campos.objetivo}
            onCambio={cambiar("objetivo")}
            opciones={OBJETIVOS.map((o) => ({
              valor: o.slug,
              texto: o.nombre,
              detalle: o.metrica,
            }))}
            ayuda={
              campos.objetivo
                ? `Se leera con: ${metricaDe(campos.objetivo)}.`
                : "Decide el territorio con el que se escribe y la metrica con la que se lee."
            }
            error={errores.objetivo}
          />

          <Selector
            id="hook-plataforma"
            nombre="_plataforma"
            etiqueta="Plataforma"
            marcador="Elige una plataforma"
            requerido
            valorInicial={campos.plataforma}
            onCambio={cambiar("plataforma")}
            opciones={PLATAFORMAS.map((p) => ({ valor: p.slug, texto: p.nombre }))}
            error={errores.plataforma}
            className="sm:col-span-2"
          />

          <Campo
            id="hook-audiencia"
            name="_audiencia"
            etiqueta="Audiencia y momento"
            opcional
            placeholder="Piel sensible, comparando rutinas"
            value={campos.audiencia}
            onChange={(e) => cambiar("audiencia")(e.target.value)}
            ayuda="Persona concreta y contexto."
            className="sm:col-span-2"
          />

          <Campo
            id="hook-tension"
            name="_tension"
            etiqueta="Tension o deseo"
            opcional
            placeholder="Quiero una rutina simple sin probar diez productos."
            value={campos.tension}
            onChange={(e) => cambiar("tension")(e.target.value)}
            ayuda="La decision o friccion."
          />

          <Campo
            id="hook-verdad"
            name="_verdadMarca"
            etiqueta="Verdad de marca"
            opcional
            placeholder="Formula sin fragancia con ingredientes minimos."
            value={campos.verdadMarca}
            onChange={(e) => cambiar("verdadMarca")(e.target.value)}
            ayuda="Una conviccion demostrable."
          />

          <Campo
            id="hook-prueba"
            name="_prueba"
            etiqueta="Prueba disponible"
            opcional
            placeholder="Textura, aplicacion, resultado, proceso…"
            value={campos.prueba}
            onChange={(e) => cambiar("prueba")(e.target.value)}
            ayuda="Sin prueba hay eslogan. Si la regla la exige, el auditor la reclama."
            className="sm:col-span-2"
          />
        </div>
      </section>

      {/* ================= apertura ================= */}
      <section className="surge rounded-[15px] border border-borde bg-superficie px-[26px] py-6 shadow-[var(--sombra)] [--retraso:0.06s]">
        <p className="mb-1.5 flex items-center gap-3 text-[10.5px] font-bold tracking-[0.12em] text-suave uppercase">
          Apertura y pago
          <span aria-hidden="true" className="h-px flex-1 bg-borde" />
        </p>
        <p className="mb-[18px] text-[11.5px] leading-relaxed text-suave">
          Las capas se revisan como una decision, no como campos aislados.
        </p>

        <div className="grid gap-[18px] sm:grid-cols-2">
          <div className="sm:col-span-2">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <label htmlFor="hook-hablado" className="text-xs font-semibold">
                Hook hablado
              </label>
              <Contador texto={campos.hablado} maximo={limiteVoz} />
            </div>
            <textarea
              id="hook-hablado"
              value={campos.hablado}
              onChange={(e) => cambiar("hablado")(e.target.value)}
              rows={3}
              maxLength={400}
              placeholder="Tres pasos en vez de diez, para piel que se irrita con todo."
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
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <label htmlFor="hook-insert" className="text-xs font-semibold">
                Insert-Titulo
              </label>
              <Contador texto={campos.insertTitulo} maximo={limiteInsert} />
            </div>
            <input
              id="hook-insert"
              value={campos.insertTitulo}
              onChange={(e) => cambiar("insertTitulo")(e.target.value)}
              maxLength={160}
              placeholder="Tres pasos, no diez"
              className="suave min-h-11 w-full rounded-xl border-[1.5px] border-borde bg-campo px-3.5 py-3 text-[13.5px] text-texto placeholder:text-suave focus:border-acento focus:bg-superficie focus:shadow-[var(--foco)] focus:outline-none"
            />
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-suave">
              Nunca es transcripcion de la voz: lleva solo el nucleo.
            </p>
          </div>

          {/*
            La vista en mudo. Existe porque en Reels buena parte del consumo
            va sin sonido: si el Insert-Titulo no se sostiene solo aqui,
            tampoco se sostendra en el fotograma uno.
          */}
          <div className="rounded-xl border border-borde bg-campo px-[18px] py-4">
            <p className="mb-2.5 text-[10.5px] font-bold tracking-[0.1em] text-suave uppercase">
              Vista en mudo
            </p>
            <p className="text-[22px] leading-tight font-extrabold tracking-[-0.02em] text-acento">
              {campos.insertTitulo || (
                <span className="text-suave">El nucleo aparece aqui.</span>
              )}
            </p>
          </div>

          <Campo
            id="hook-fotograma"
            name="_primerFotograma"
            etiqueta="Primer fotograma"
            opcional
            placeholder="Tocador lleno que se reduce a tres productos"
            value={campos.primerFotograma}
            onChange={(e) => cambiar("primerFotograma")(e.target.value)}
            ayuda="Debe comunicar en silencio."
          />

          <Campo
            id="hook-pago"
            name="_pagoPromesa"
            etiqueta="Pago de la promesa"
            opcional
            placeholder="Segundo 4: los tres pasos y para que sirve cada uno"
            value={campos.pagoPromesa}
            onChange={(e) => cambiar("pagoPromesa")(e.target.value)}
            ayuda="Primera senal de valor."
          />

          <Campo
            id="hook-cta"
            name="_cta"
            etiqueta="CTA congruente"
            opcional
            placeholder="Guardalo para revisar tu rutina esta noche"
            value={campos.cta}
            onChange={(e) => cambiar("cta")(e.target.value)}
            ayuda="Proporcional al valor."
          />

          <Campo
            id="hook-riesgo"
            name="_riesgoClaim"
            etiqueta="Riesgo o claim a validar"
            opcional
            placeholder="Validar una comparacion o claim de salud"
            value={campos.riesgoClaim}
            onChange={(e) => cambiar("riesgoClaim")(e.target.value)}
            ayuda="No sale sin visto bueno."
          />
        </div>
      </section>

      {/* ================= la ficha, al final y a lo ancho ================= */}
      <section className="surge overflow-hidden rounded-[15px] border border-borde bg-superficie shadow-[var(--sombra)] [--retraso:0.1s]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borde px-[22px] py-4">
          <div>
            <p className="mb-1 text-[10.5px] font-bold tracking-[0.1em] text-suave uppercase">
              Ficha para edicion
            </p>
            <p className="text-[15px] font-bold tracking-[-0.012em]">
              Lo que se entrega, sin interpretar
            </p>
          </div>
          <span className="rounded-full bg-acento-tenue px-2.5 py-1 text-[11px] font-bold text-acento">
            {ficha?.estado ?? "sin guardar"}
          </span>
        </div>

        <FichaProduccion valores={valoresFicha} />

        <div className="flex flex-wrap items-center gap-2.5 border-t border-borde px-[22px] py-[18px]">
          <Boton type="submit" name="accion" value="guardar" variante="fantasma" disabled={enviando}>
            <Save aria-hidden="true" />
            Guardar como borrador
          </Boton>

          <Boton
            type="submit"
            name="accion"
            value="auditar"
            disabled={enviando}
            className="ml-auto"
          >
            <Zap aria-hidden="true" />
            {enviando ? "Guardando…" : "Auditar este hook"}
          </Boton>
        </div>
      </section>

      {/*
        El resultado YA NO se pinta aqui.

        Auditar guarda la ficha, calcula la nota y lleva al Auditor, que es el
        paso 04 del recorrido. Desplegarlo debajo del formulario mezclaba dos
        pasos que el modulo separa a proposito —el canvas decide y escribe, el
        auditor juzga— y dejaba la pieza a medio camino entre los dos.
      */}
    </form>
  );
}
