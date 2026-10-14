import { Copy, Lock, Pencil } from "lucide-react";
import type { ReactNode } from "react";

import { PanelCuerpo, PanelPie, SeparadorPanel } from "@/components/listado";
import { BotonEnlace, Etiqueta } from "@/components/ui";
import {
  metricaDe,
  nombrePlataforma,
  objetivoDe,
  porcentajeDe,
} from "@/lib/hooks/catalogo";
import type { FichaConResultado } from "@/types";
import { ZONA_HORARIA } from "@/lib/fechas";

/**
 * La ficha de un hook en modo lectura, dentro del panel lateral.
 *
 * Es la unica pantalla donde se ve una pieza ENTERA: la decision que se tomo
 * antes de grabar y, si llego a publicarse, lo que paso despues. El historial
 * solo puede mostrar cuatro columnas, y con eso no se juzga nada.
 *
 * El orden no es casual: primero lo que se dijo, luego con que se sostiene,
 * despues como se ejecuta y al final los numeros. Es el mismo recorrido que
 * hace quien escribe la pieza, y el mismo con el que se lee para aprender.
 */

const FORMATO = new Intl.DateTimeFormat("es-VE", {
  timeZone: ZONA_HORARIA,
  dateStyle: "long",
  timeStyle: "short",
});

const ESTADOS = {
  borrador: { texto: "Borrador", tono: "contorno" as const },
  auditada: { texto: "Auditada", tono: "contorno" as const },
  medida: { texto: "Medida", tono: "solida" as const },
};

function Dato({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,120px)_minmax(0,1fr)] items-baseline gap-4 border-b border-borde py-[11px] last:border-b-0">
      <dt className="text-[10.5px] font-bold tracking-[0.08em] text-suave uppercase">
        {rotulo}
      </dt>
      <dd className="min-w-0 text-[13px] break-words">{children ?? "—"}</dd>
    </div>
  );
}

/** Un texto que puede faltar. Se dice que falta, no se deja el hueco mudo. */
function Texto({ valor }: { valor: string | null }) {
  if (!valor) {
    return <span className="text-[12.5px] text-suave italic">Sin escribir</span>;
  }

  return <>{valor}</>;
}

function Cifra({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="rounded-xl bg-campo px-3.5 py-3">
      <p className="text-[10.5px] font-bold tracking-[0.08em] text-suave uppercase">
        {rotulo}
      </p>
      <p className="mt-1 text-[19px] font-extrabold tracking-[-0.025em]">
        {valor.toLocaleString("es-VE")}
      </p>
    </div>
  );
}

export function DetalleFicha({
  ficha,
  hrefEditar,
  hrefPlantilla,
  hrefCerrar,
}: {
  ficha: FichaConResultado;
  hrefEditar: string;
  /** Crea una pieza nueva partiendo de esta. No la modifica. */
  hrefPlantilla: string;
  hrefCerrar: string;
}) {
  const objetivo = objetivoDe(ficha.objetivo);
  const estado = ESTADOS[ficha.estado];
  const avance = porcentajeDe(ficha.estado);

  return (
    <>
      <PanelCuerpo>
        {/* Lo primero es lo que se dice en voz: es la pieza. Todo lo demas
            existe para sostener esa frase. */}
        <p className="text-[19px] leading-snug font-bold tracking-[-0.022em]">
          &laquo;{ficha.hablado}&raquo;
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Etiqueta variante={estado.tono}>{estado.texto}</Etiqueta>
          <span className="text-[12px] text-suave">{avance}% del recorrido</span>

          {ficha.notaAuditor !== null && (
            <span className="text-[12px] text-suave">
              · auditada con <b className="text-texto">{ficha.notaAuditor}</b>
            </span>
          )}
        </div>

        <SeparadorPanel>La decision</SeparadorPanel>

        <dl>
          <Dato rotulo="Cliente">{ficha.empresaNombre ?? "—"}</Dato>
          <Dato rotulo="Objetivo">
            {objetivo.nombre}
            <span className="block text-[11.5px] text-suave">
              Se lee con {metricaDe(ficha.objetivo).toLowerCase()}
            </span>
          </Dato>
          <Dato rotulo="Plataforma">{nombrePlataforma(ficha.plataforma)}</Dato>
          <Dato rotulo="Audiencia">
            <Texto valor={ficha.audiencia} />
          </Dato>
          <Dato rotulo="Tension">
            <Texto valor={ficha.tension} />
          </Dato>
          <Dato rotulo="Verdad de marca">
            <Texto valor={ficha.verdadMarca} />
          </Dato>
          <Dato rotulo="Prueba">
            <Texto valor={ficha.prueba} />
          </Dato>
        </dl>

        <SeparadorPanel>En pantalla</SeparadorPanel>

        <dl>
          <Dato rotulo="Insert-Titulo">
            <Texto valor={ficha.insertTitulo} />
          </Dato>
          <Dato rotulo="Primer fotograma">
            <Texto valor={ficha.primerFotograma} />
          </Dato>
          <Dato rotulo="Pago de promesa">
            <Texto valor={ficha.pagoPromesa} />
          </Dato>
          <Dato rotulo="CTA">
            <Texto valor={ficha.cta} />
          </Dato>
          <Dato rotulo="Riesgo del claim">
            <Texto valor={ficha.riesgoClaim} />
          </Dato>
        </dl>

        <SeparadorPanel>Resultados</SeparadorPanel>

        {ficha.resultado ? (
          <>
            {ficha.hookRate !== null && (
              <div className="mb-3.5 rounded-xl border border-borde bg-superficie px-4 py-3.5">
                <p className="text-[10.5px] font-bold tracking-[0.08em] text-suave uppercase">
                  Hook rate
                </p>
                <p className="mt-1 text-[27px] leading-none font-extrabold tracking-[-0.03em] text-acento">
                  {ficha.hookRate.toFixed(1).replace(".", ",")}%
                </p>
                <p className="mt-1.5 text-[11.5px] text-suave">
                  Vistas de 3 segundos sobre impresiones
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Cifra rotulo="Impresiones" valor={ficha.resultado.impresiones} />
              <Cifra rotulo="Vistas 3 s" valor={ficha.resultado.vistas3s} />
              <Cifra rotulo="Me gusta" valor={ficha.resultado.meGusta} />
              <Cifra rotulo="Compartidos" valor={ficha.resultado.compartidos} />
              <Cifra rotulo="Clics" valor={ficha.resultado.clics} />
              <Cifra rotulo="Guardados" valor={ficha.resultado.guardados} />
            </div>

            {/* El aprendizaje es lo unico de aqui que sirve para la pieza
                siguiente. Las cifras cuentan lo que paso; esto, por que. */}
            {ficha.resultado.aprendizaje && (
              <div className="mt-3.5 rounded-xl bg-acento-tenue px-4 py-3.5">
                <p className="text-[10.5px] font-bold tracking-[0.08em] text-acento uppercase">
                  Lo que dejo escrito
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed">
                  {ficha.resultado.aprendizaje}
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="rounded-xl border border-borde bg-campo px-4 py-3.5 text-[12.5px] leading-relaxed text-suave">
            Todavia sin numeros. Una pieza esta terminada cuando tiene sus
            metricas registradas: hasta entonces no le ensena nada a la cuenta.
          </p>
        )}

        <SeparadorPanel>Rastro</SeparadorPanel>

        <dl>
          <Dato rotulo="La escribio">{ficha.creadoPorNombre ?? "—"}</Dato>
          <Dato rotulo="Creada">{FORMATO.format(ficha.creadoEn)}</Dato>
          <Dato rotulo="Ultimo cambio">{FORMATO.format(ficha.actualizadoEn)}</Dato>
        </dl>
      </PanelCuerpo>

      <PanelPie>
        <BotonEnlace href={hrefCerrar} variante="fantasma">
          Cerrar
        </BotonEnlace>

        <BotonEnlace href={hrefPlantilla} variante="fantasma" scroll>
          <Copy aria-hidden="true" />
          Usar como plantilla
        </BotonEnlace>

        {/* Cerrada: se dice, no se esconde. Usar como plantilla sigue estando
            ahi al lado, que es la salida cuando hace falta otra version. */}
        {ficha.estado === "medida" ? (
          <span className="inline-flex min-h-11 items-center gap-2.5 rounded-xl border border-borde px-5 text-[12.5px] font-semibold text-suave">
            <Lock aria-hidden="true" className="size-4" />
            Cerrada: ya tiene sus metricas
          </span>
        ) : (
          <BotonEnlace href={hrefEditar} scroll>
            <Pencil aria-hidden="true" />
            Editar
          </BotonEnlace>
        )}
      </PanelPie>
    </>
  );
}
