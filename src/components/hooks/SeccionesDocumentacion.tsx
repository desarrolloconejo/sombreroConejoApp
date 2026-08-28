import Link from "next/link";
import { Archive, Copy, Eye, Pencil, Plus, Trash2 } from "lucide-react";

import { nombreMecanismo, nombreTerritorio, TERRITORIOS } from "@/lib/hooks/catalogo";
import { ESTANDAR_INSERT, ESTANDAR_VOZ } from "@/lib/hooks/listas";
import type { Apertura, ReferenciaHook, ReglaHook } from "@/types";

/**
 * Las tres secciones de Documentacion: reglas, aperturas y referencias.
 *
 * Van en este orden y no en otro. Las reglas primero porque dicen COMO habla
 * esta marca, y eso hay que saberlo antes de escribir una sola palabra: si se
 * miran despues, uno se las encuentra en el auditor cuando ya ha redactado.
 */

/** El rotulo grande que parte la pagina. */
export function RotuloSeccion({
  numero,
  titulo,
  children,
}: {
  numero: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-9 mb-[18px] flex items-end gap-5 first:mt-6">
      <span className="grid size-11 shrink-0 place-items-center rounded-[13px] bg-acento text-sm font-extrabold text-acento-contraste">
        {numero}
      </span>

      <div className="min-w-0 flex-1">
        <h2 className="text-[27px] leading-tight font-extrabold tracking-[-0.028em]">
          {titulo}
        </h2>
        <p className="mt-1.5 max-w-[70ch] text-[13px] leading-relaxed text-suave">
          {children}
        </p>
      </div>

      <span aria-hidden="true" className="mb-[11px] hidden h-px min-w-6 flex-1 bg-borde sm:block" />
    </div>
  );
}

function Acciones({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={["flex items-center justify-end gap-0.5", className].join(" ")}>
      {children}
    </div>
  );
}

function Accion({
  href,
  etiqueta,
  children,
  tono = "normal",
}: {
  href: string;
  etiqueta: string;
  children: React.ReactNode;
  tono?: "normal" | "aviso" | "panel";
}) {
  const tonos = {
    normal: "text-suave hover:border-acento hover:bg-acento hover:text-acento-contraste",
    aviso:
      "text-blackberry hover:border-blackberry hover:bg-blackberry hover:text-white dark-tema:text-[#e9a9cd]",
    panel: "text-suave hover:border-acento hover:bg-acento hover:text-acento-contraste",
  } as const;

  return (
    <Link
      href={href}
      scroll={false}
      aria-label={etiqueta}
      title={etiqueta}
      className={[
        "suave grid size-9 shrink-0 place-items-center rounded-[10px] border border-transparent",
        tonos[tono],
        "[&>svg]:size-4",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

/* ===========================================================================
   01 · REGLAS
   =========================================================================== */

export function SeccionReglas({
  reglas,
  hrefNueva,
  hrefVer,
  hrefEditar,
  hrefBorrar,
}: {
  reglas: ReglaHook[];
  hrefNueva: string;
  hrefVer: (id: number) => string;
  hrefEditar: (id: number) => string;
  hrefBorrar: (id: number) => string;
}) {
  return (
    <div className="rounded-[15px] border border-borde bg-superficie px-[26px] py-6 shadow-[var(--sombra)]">
      <div className="mb-[18px] flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="mb-1.5 text-[18px] font-extrabold tracking-[-0.02em]">
            {reglas.length} {reglas.length === 1 ? "regla activa" : "reglas activas"}
          </p>
          <p className="max-w-[66ch] text-[12.5px] leading-relaxed text-suave">
            El estandar de agencia es voz ≤ {ESTANDAR_VOZ} palabras e
            Insert-Titulo ≤ {ESTANDAR_INSERT}. Una cuenta puede subirlos, pero la
            desviacion queda marcada en cada auditoria.
          </p>
        </div>

        <Link
          href={hrefNueva}
          scroll={false}
          className="suave inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-borde px-4 text-[12.5px] font-semibold text-texto hover:border-acento hover:bg-acento hover:text-acento-contraste"
        >
          <Plus aria-hidden="true" className="size-4" />
          Nueva regla
        </Link>
      </div>

      {reglas.length === 0 ? (
        <p className="rounded-xl border border-borde bg-campo px-4 py-6 text-center text-[12.5px] text-suave">
          Aun no hay reglas. La auditoria usa el estandar general de la agencia.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {reglas.map((regla) => {
            const ampliada =
              regla.maxPalabrasVoz > ESTANDAR_VOZ ||
              regla.maxPalabrasInsert > ESTANDAR_INSERT;

            return (
              <li
                key={regla.id}
                className={[
                  "flex flex-col rounded-xl border bg-campo px-4 py-[15px]",
                  ampliada ? "border-acento" : "border-borde",
                ].join(" ")}
              >
                <div className="mb-2 flex items-start justify-between gap-2.5">
                  {/*
                    El titulo NO es un enlace, y ademas lleva su color escrito.
                    Era un <Link>, asi que heredaba del `a` global el color de
                    acento: en tema claro eso es blackberry, y blackberry sobre
                    esta tarjeta no se leia. Ademas repetia lo que ya hace
                    el ojo del pie, con la diferencia de que no lo parecia.
                  */}
                  <h4 className="text-[14.5px] font-bold tracking-[-0.01em] text-texto">
                    {regla.etiqueta}
                  </h4>
                  {ampliada && (
                    <span className="shrink-0 rounded-md bg-acento px-2 py-0.5 text-[10px] font-extrabold tracking-[0.06em] text-acento-contraste uppercase">
                      Ampliado
                    </span>
                  )}
                </div>

                <p className="mb-2 text-[11.5px] leading-relaxed text-suave">
                  {regla.empresaId !== null ? "Cliente" : `Sector · ${regla.sector}`} ·
                  Voz ≤ {regla.maxPalabrasVoz} · Insert ≤ {regla.maxPalabrasInsert} ·{" "}
                  {regla.exigirPrueba ? "Prueba requerida" : "Prueba opcional"}
                </p>

                {ampliada && (
                  <p className="text-[11px] leading-relaxed text-acento">
                    Supera el estandar {ESTANDAR_VOZ}/{ESTANDAR_INSERT}. El auditor
                    respeta la regla, pero la desviacion queda visible.
                  </p>
                )}

                {/* El pie se empuja al fondo: las tarjetas no miden lo mismo y
                    con las acciones colgando del texto la fila se lee torcida. */}
                <Acciones className="mt-auto border-t border-borde pt-[11px]">
                  <Accion
                    href={hrefVer(regla.id)}
                    etiqueta={`Ver detalles de la regla ${regla.etiqueta}`}
                    tono="panel"
                  >
                    <Eye aria-hidden="true" />
                  </Accion>
                  <Accion
                    href={hrefEditar(regla.id)}
                    etiqueta={`Editar la regla ${regla.etiqueta}`}
                    tono="panel"
                  >
                    <Pencil aria-hidden="true" />
                  </Accion>
                  <Accion
                    href={hrefBorrar(regla.id)}
                    etiqueta={`Borrar la regla ${regla.etiqueta}`}
                    tono="panel"
                  >
                    <Trash2 aria-hidden="true" />
                  </Accion>
                </Acciones>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-[18px] border-t border-borde pt-[18px]">
        <p className="mb-[11px] text-[10.5px] font-bold tracking-[0.1em] text-suave uppercase">
          Cual gana cuando hay varias
        </p>

        <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
          <span className="rounded-[9px] bg-acento-tenue px-3 py-1.5 text-xs font-bold text-acento">
            1. Regla del cliente
          </span>
          <span aria-hidden="true" className="text-suave">
            &rsaquo;
          </span>
          <span className="rounded-[9px] bg-campo px-3 py-1.5 text-xs font-semibold">
            2. Regla del sector
          </span>
          <span aria-hidden="true" className="text-suave">
            &rsaquo;
          </span>
          <span className="rounded-[9px] bg-campo px-3 py-1.5 text-xs font-semibold">
            3. Estandar {ESTANDAR_VOZ}/{ESTANDAR_INSERT}
          </span>
        </div>

        <p className="max-w-[76ch] text-[11.5px] leading-relaxed text-suave">
          Se busca primero una regla para ese cliente concreto. Si no la hay,
          una de su sector. Si tampoco, el estandar de la casa.{" "}
          <b className="text-texto">Nunca se suman: gana una sola.</b>
        </p>
      </div>
    </div>
  );
}

/* ===========================================================================
   02 · APERTURAS
   =========================================================================== */

export function SeccionAperturas({
  aperturas,
  total,
  territoriosActivos,
  hrefTerritorio,
  hrefVer,
  hrefEditar,
  hrefRetirar,
  hrefNueva,
  verRetiradas = false,
  hrefRetiradas,
}: {
  aperturas: Apertura[];
  total: number;
  /** Los territorios marcados. Vacio significa "todos". */
  territoriosActivos: readonly string[];
  /** null limpia el grupo; un slug lo alterna. */
  hrefTerritorio: (slug: string | null) => string;
  hrefVer: (id: number) => string;
  hrefEditar: (id: number) => string;
  hrefRetirar: (id: number) => string;
  hrefNueva?: string;

  /** Si la lista incluye ademas las retiradas. */
  verRetiradas?: boolean;
  /** El interruptor de arriba. Sin el, retirar no tiene vuelta. */
  hrefRetiradas?: (ver: boolean) => string;
}) {
  return (
    <div className="overflow-hidden rounded-[15px] border border-borde bg-superficie shadow-[var(--sombra)]">
      <div className="border-b border-borde px-6 pt-5 pb-4">
        <p className="mb-2.5 text-[10.5px] font-bold tracking-[0.1em] text-suave uppercase">
          Territorio · elige los que quieras
        </p>

        <div className="flex flex-wrap gap-[7px]">
          <Link
            href={hrefTerritorio(null)}
            scroll={false}
            className={[
              "suave inline-flex min-h-8 items-center rounded-full border-[1.5px] px-3 text-xs font-semibold",
              territoriosActivos.length === 0
                ? "border-acento bg-acento text-acento-contraste"
                : "border-borde text-suave hover:border-acento hover:text-acento",
            ].join(" ")}
          >
            Todos
          </Link>

          {TERRITORIOS.map((t) => (
            <Link
              key={t.slug}
              href={hrefTerritorio(t.slug)}
              scroll={false}
              className={[
                "suave inline-flex min-h-8 items-center rounded-full border-[1.5px] px-3 text-xs font-semibold",
                territoriosActivos.includes(t.slug)
                  ? "border-acento bg-acento text-acento-contraste"
                  : "border-borde text-suave hover:border-acento hover:text-acento",
              ].join(" ")}
            >
              {t.letra} · {t.nombre}
            </Link>
          ))}
        </div>

        <p className="mt-3.5 text-[11.5px] leading-relaxed text-suave">
          El territorio lo sugiere el objetivo que elijas al escribir. Guardados
          pide E o B; Compartidos pide D o G.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borde px-6 py-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[11.5px] font-medium text-suave">
            <b className="text-texto">{aperturas.length}</b> de {total} aperturas
          </p>

          {/*
            Sin esto, retirar es un camino sin vuelta.

            Una apertura retirada sale de la lista —que es justo lo que se le
            pide—, pero si ademas no hay forma de verla, reponerla deja de ser
            posible desde la aplicacion aunque la action lo permita. El
            interruptor es lo unico que convierte "retirar" en algo reversible.
          */}
          {hrefRetiradas && (
            <Link
              href={hrefRetiradas(!verRetiradas)}
              scroll={false}
              aria-pressed={verRetiradas}
              className={[
                "suave inline-flex min-h-8 items-center gap-1.5 rounded-full border-[1.5px] px-3 text-[11.5px] font-semibold",
                verRetiradas
                  ? "border-acento bg-acento text-acento-contraste"
                  : "border-borde text-suave hover:border-acento hover:text-acento",
              ].join(" ")}
            >
              <Archive aria-hidden="true" className="size-3.5" />
              {verRetiradas ? "Ocultar retiradas" : "Ver retiradas"}
            </Link>
          )}
        </div>

        {hrefNueva && (
          <Link
            href={hrefNueva}
            scroll={false}
            className="suave inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg bg-acento px-3 text-xs font-semibold text-acento-contraste hover:bg-acento-hover"
          >
            <Plus aria-hidden="true" className="size-3.5" />
            Nueva apertura
          </Link>
        )}
      </div>

      <ul>
        {aperturas.map((apertura) => (
          <li
            key={apertura.id}
            className="grid border-b border-borde last:border-b-0 lg:grid-cols-[minmax(0,1fr)_300px]"
          >
            {/*
              La retirada se apaga en lugar de esconderse: sigue leyendose
              entera —hace falta para decidir si reponerla— pero el filo lateral
              pierde el acento y el contenido baja de opacidad, asi que no se
              confunde con las que si se ofrecen al escribir.
            */}
            <div
              className={[
                "border-l-[3px] px-6 py-[22px]",
                apertura.activa ? "border-acento" : "border-borde opacity-60",
              ].join(" ")}
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-[10.5px] font-bold tracking-[0.1em] text-suave uppercase">
                  {apertura.numero} · {nombreTerritorio(apertura.territorio)}
                </span>

                {!apertura.activa && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-campo px-2.5 py-[3px] text-[10.5px] font-bold text-suave">
                    <Archive aria-hidden="true" className="size-3" />
                    Retirada
                  </span>
                )}
                {apertura.mecanismos.map((m) => (
                  <span
                    key={m}
                    className="rounded-full bg-acento-tenue px-2.5 py-[3px] text-[10.5px] font-bold text-acento"
                  >
                    {nombreMecanismo(m)}
                  </span>
                ))}
              </div>

              {/*
                Los corchetes se resaltan porque son lo unico que hay que
                sustituir: sin marcarlos, la plantilla se lee como una frase y
                acaba copiada tal cual, que es justo lo que no debe pasar.
              */}
              <p className="mb-4 text-[19px] leading-snug font-bold tracking-[-0.015em]">
                {apertura.plantilla.split(/(\[[^\]]+\])/g).map((trozo, i) =>
                  trozo.startsWith("[") ? (
                    <span
                      key={i}
                      className="rounded-[5px] bg-acento-tenue px-1.5 font-bold text-acento"
                    >
                      {trozo}
                    </span>
                  ) : (
                    trozo
                  ),
                )}
              </p>

              <p className="mb-1.5 text-[10.5px] font-bold tracking-[0.1em] text-suave uppercase">
                Ejemplo hablado
              </p>
              <p className="mb-3 text-[13.5px] leading-relaxed text-suave">
                &ldquo;{apertura.ejemplo}&rdquo;
              </p>

              <span className="inline-flex items-center rounded-full bg-navy px-3 py-[5px] text-[11.5px] font-bold text-gold">
                {apertura.insertTitulo}
              </span>
            </div>

            <div className="border-t border-borde bg-campo px-6 py-[22px] lg:border-t-0 lg:border-l">
              <p className="mb-1.5 text-[10.5px] font-bold tracking-[0.1em] text-suave uppercase">
                Direccion para edicion
              </p>
              <p className="mb-4 text-[12.5px] leading-relaxed">
                {apertura.direccionEdicion}
              </p>

              <p className="mb-1.5 text-[10.5px] font-bold tracking-[0.1em] text-suave uppercase">
                Usala cuando
              </p>
              <p className="mb-4 text-[12.5px] leading-relaxed">{apertura.usalaCuando}</p>

              <Acciones className="border-t border-borde pt-3">
                <Accion href={hrefVer(apertura.id)} etiqueta={`Ver la apertura ${apertura.numero}`}>
                  <Eye aria-hidden="true" />
                </Accion>
                <Accion
                  href={hrefEditar(apertura.id)}
                  etiqueta={`Editar la apertura ${apertura.numero}`}
                >
                  <Pencil aria-hidden="true" />
                </Accion>
                <Accion
                  href={hrefRetirar(apertura.id)}
                  etiqueta={
                    apertura.activa
                      ? `Retirar la apertura ${apertura.numero}`
                      : `Reponer la apertura ${apertura.numero}`
                  }
                  tono="aviso"
                >
                  <Trash2 aria-hidden="true" />
                </Accion>
              </Acciones>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ===========================================================================
   03 · REFERENCIAS
   =========================================================================== */

export function SeccionReferencias({
  referencias,
  hrefNueva,
  hrefVer,
  hrefEditar,
  hrefBorrar,
  hrefPlantilla,
}: {
  referencias: ReferenciaHook[];
  hrefNueva: string;
  hrefVer: (id: number) => string;
  hrefEditar: (id: number) => string;
  hrefBorrar: (id: number) => string;

  /**
   * Abrir el canvas partiendo de esta referencia.
   *
   * Es el motivo por el que existe el banco: una referencia se guarda para
   * volver a usarla, y sin esto habia que copiar el texto a mano. Se copia el
   * mecanismo, no la cuenta: el canvas nace sin cliente y sin objetivo.
   */
  hrefPlantilla: (id: number) => string;
}) {
  return (
    <div className="overflow-hidden rounded-[15px] border border-borde bg-superficie shadow-[var(--sombra)]">
      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-borde px-6 py-5">
        <div>
          <p className="mb-1.5 text-[18px] font-extrabold tracking-[-0.02em]">
            {referencias.length}{" "}
            {referencias.length === 1 ? "referencia guardada" : "referencias guardadas"}
          </p>
          <p className="max-w-[66ch] text-[12.5px] leading-relaxed text-suave">
            Guardar una exige escribir por que funciona. Sin esa linea es un
            recorte suelto que dentro de un mes no le dice nada a nadie.
          </p>
        </div>

        <Link
          href={hrefNueva}
          scroll={false}
          className="suave inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-acento px-4 text-[12.5px] font-semibold text-acento-contraste hover:bg-acento-hover"
        >
          <Plus aria-hidden="true" className="size-4" />
          Guardar referencia
        </Link>
      </div>

      {referencias.length === 0 ? (
        <p className="px-6 py-10 text-center text-[12.5px] text-suave">
          Aun no hay referencias guardadas. Anade un hook que este funcionando y
          registra que mecanismo vale la pena adaptar.
        </p>
      ) : (
        <ul>
          {referencias.map((ref) => (
            <li
              key={ref.id}
              className="flex flex-wrap items-start gap-5 border-b border-borde px-6 py-5 last:border-b-0"
            >
              <div className="min-w-[240px] flex-1">
                <p className="mb-2 text-[10.5px] font-bold tracking-[0.1em] text-suave uppercase">
                  {nombreTerritorio(ref.territorio)}
                </p>

                {/* Tampoco es enlace: el ojo del pie ya abre el detalle, y
                    como <Link> heredaba el color de acento en lugar del color
                    de texto, el hook se leia como si fuera otra cosa. */}
                <h4 className="mb-2.5 text-base leading-snug font-bold tracking-[-0.01em] text-texto">
                  &laquo;{ref.hablado}&raquo;
                </h4>

                {ref.insertTitulo && (
                  <span className="inline-flex items-center rounded-full bg-navy px-3 py-[5px] text-[11.5px] font-bold text-gold">
                    {ref.insertTitulo}
                  </span>
                )}

                <p className="mt-3 text-[12.5px] leading-relaxed text-suave">
                  <b className="text-texto">Lectura:</b> {ref.lectura}
                </p>

                {ref.etiquetas.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {ref.etiquetas.map((e) => (
                      <span
                        key={e}
                        className="rounded-full bg-acento-tenue px-2.5 py-[3px] text-[10.5px] font-bold text-acento"
                      >
                        #{e}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                {ref.urlFuente && (
                  <a
                    href={ref.urlFuente}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-xs font-semibold"
                  >
                    Abrir fuente
                  </a>
                )}

                <Acciones>
                  <Accion href={hrefVer(ref.id)} etiqueta="Ver la referencia">
                    <Eye aria-hidden="true" />
                  </Accion>
                  <Accion
                    href={hrefPlantilla(ref.id)}
                    etiqueta="Usar esta referencia como plantilla"
                  >
                    <Copy aria-hidden="true" />
                  </Accion>
                  <Accion href={hrefEditar(ref.id)} etiqueta="Editar la referencia">
                    <Pencil aria-hidden="true" />
                  </Accion>
                  <Accion
                    href={hrefBorrar(ref.id)}
                    etiqueta="Borrar la referencia"
                    tono="aviso"
                  >
                    <Trash2 aria-hidden="true" />
                  </Accion>
                </Acciones>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
