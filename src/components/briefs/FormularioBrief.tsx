"use client";

import {
  createContext,
  useActionState,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowLeft, ArrowRight, Check, Save, Send } from "lucide-react";

import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { Alerta, Boton, CampoFecha, CLASE_CONTROL, claseLinea } from "@/components/ui";
import { ZONA_HORARIA } from "@/lib/fechas";
import { avisosDeReglas, contarNoSe, pasoCompleto, pasosVisibles } from "@/lib/portal/briefs";
import {
  ESTADO_INICIAL,
  type EstadoFormulario,
  type FormatoBrief,
  type Pregunta,
  type Respuestas,
  type ValorRespuesta,
} from "@/types";

/**
 * El formulario de un brief, un paso por pantalla.
 *
 * Las respuestas viven en el estado de React y viajan como JSON: un formato
 * tiene 44 preguntas de siete tipos, y un formulario HTML plano no sabria
 * mandar la matriz ni las opciones multiples sin perder su forma.
 *
 * Se guarda solo: cada 20 segundos si algo cambio, y al cambiar de paso. Los
 * pasos que oculta una regla desaparecen de la cuenta y del envio, aunque se
 * hubieran escrito (la base solo recibe lo congelado de los visibles).
 *
 * Las actions llegan como props: la del cliente o la del prospecto. La de
 * enviar la lleva `ProveedorEnvioBrief`, por encima, porque al enviar el
 * formulario desaparece y el aviso no debe irse con el.
 */

type Accion = (estado: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
type Envio = [EstadoFormulario, (datos: FormData) => void, boolean];

const ContextoEnvio = createContext<Envio | null>(null);

export function ProveedorEnvioBrief({ accion, children }: { accion: Accion; children: ReactNode }) {
  const envio = useActionState(accion, ESTADO_INICIAL);
  useAvisoDeAccion(envio[0]);
  return <ContextoEnvio.Provider value={envio}>{children}</ContextoEnvio.Provider>;
}

const GUARDADO_CADA_MS = 20_000;

const HORA = new Intl.DateTimeFormat("es-VE", {
  timeZone: ZONA_HORARIA,
  hour: "numeric",
  minute: "2-digit",
});

export function FormularioBrief({
  briefId,
  formato,
  iniciales,
  fechaInicial,
  hoy,
  version,
  guardar,
}: {
  briefId: number;
  formato: FormatoBrief;
  iniciales: Respuestas;
  fechaInicial: string | null;
  /** Hoy en Caracas: la fecha aspirada no puede ser anterior. */
  hoy: string;
  /** La version que se va a enviar: 1 la primera vez. */
  version: number;
  guardar: (id: number, respuestas: string, fecha: string) => Promise<{ ok: boolean; mensaje?: string }>;
}) {
  const envio = useContext(ContextoEnvio);
  if (!envio) throw new Error("FormularioBrief va dentro de ProveedorEnvioBrief");
  const [estadoEnvio, enviar, enviando] = envio;

  const [respuestas, setRespuestas] = useState<Respuestas>(iniciales);
  const [fecha, setFecha] = useState(fechaInicial ?? "");
  const [indice, setIndice] = useState(0);
  const [guardado, setGuardado] = useState<{ estado: "guardado" | "guardando" | "error"; texto: string }>({
    estado: "guardado",
    texto: "Borrador al dia",
  });
  const sucio = useRef(false);

  const visibles = useMemo(() => pasosVisibles(formato, respuestas), [formato, respuestas]);
  const avisos = useMemo(() => avisosDeReglas(formato, respuestas), [formato, respuestas]);
  const noSe = contarNoSe(formato, respuestas);
  const paso = visibles[Math.min(indice, visibles.length - 1)];
  const errores = estadoEnvio.errores ?? {};

  const guardarAhora = useCallback(async () => {
    if (!sucio.current) return;
    sucio.current = false;
    setGuardado({ estado: "guardando", texto: "Guardando..." });
    const resultado = await guardar(briefId, JSON.stringify(respuestas), fecha);
    setGuardado(
      resultado.ok
        ? { estado: "guardado", texto: `Guardado a las ${HORA.format(new Date())}` }
        : { estado: "error", texto: resultado.mensaje ?? "No se pudo guardar" },
    );
    if (!resultado.ok) sucio.current = true;
  }, [briefId, fecha, guardar, respuestas]);

  // Guardado automatico mientras se escribe.
  useEffect(() => {
    const reloj = setInterval(() => void guardarAhora(), GUARDADO_CADA_MS);
    return () => clearInterval(reloj);
  }, [guardarAhora]);

  // Si el envio devolvio errores, se va al primer paso que tiene uno. Solo
  // cuando llega una respuesta nueva del servidor, y durante el render: es la
  // forma de ajustar estado a un cambio sin un efecto en cascada.
  const [envioVisto, setEnvioVisto] = useState(estadoEnvio);
  if (estadoEnvio !== envioVisto) {
    setEnvioVisto(estadoEnvio);
    const claves = Object.keys(estadoEnvio.errores ?? {});
    const conError = visibles.findIndex((p) => p.preguntas.some((q) => claves.includes(q.clave)));
    if (conError >= 0) setIndice(conError);
  }

  function responder(clave: string, valor: ValorRespuesta) {
    sucio.current = true;
    setGuardado({ estado: "guardado", texto: "Cambios sin guardar" });
    setRespuestas((actuales) => ({ ...actuales, [clave]: valor }));
  }

  function irA(nuevo: number) {
    void guardarAhora();
    setIndice(Math.max(0, Math.min(nuevo, visibles.length - 1)));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const completos = (p: (typeof visibles)[number]) => pasoCompleto(p, respuestas);

  if (!paso) return null;

  return (
    <div>
      <div className="surge mb-5 flex flex-col gap-2 rounded-[15px] border border-borde bg-superficie px-4 py-3.5 shadow-[var(--sombra)] sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-bold">
            Paso {indice + 1} de {visibles.length} · {paso.titulo}
          </p>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-campo"
            role="progressbar"
            aria-label="Avance del brief"
            aria-valuemin={0}
            aria-valuemax={visibles.length}
            aria-valuenow={indice + 1}
          >
            <div
              className="h-full rounded-full bg-acento transition-[width] duration-300"
              style={{ width: `${((indice + 1) / visibles.length) * 100}%` }}
            />
          </div>
        </div>
        <p className="text-[12px] text-suave">
          <span
            aria-live="polite"
            className={guardado.estado === "error" ? "font-semibold text-blackberry dark-tema:text-acento" : ""}
          >
            {guardado.texto}
          </span>
          {" · "}unos {formato.tiempoEstimadoMinutos} minutos
        </p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[220px_minmax(0,1fr)_280px]">
        <nav aria-label="Pasos del brief" className="hidden lg:block">
          <ol className="flex flex-col gap-1 rounded-[15px] border border-borde bg-superficie p-2.5 shadow-[var(--sombra)]">
            {visibles.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => irA(i)}
                  aria-current={i === indice ? "step" : undefined}
                  className={[
                    "suave flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[12.5px]",
                    i === indice ? "bg-acento-tenue font-semibold" : "hover:bg-campo",
                  ].join(" ")}
                >
                  <span
                    aria-hidden="true"
                    className={[
                      "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold [&>svg]:size-3.5",
                      completos(p) ? "bg-acento text-acento-contraste" : "border border-borde",
                    ].join(" ")}
                  >
                    {completos(p) ? <Check /> : i + 1}
                  </span>
                  {p.titulo}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <section aria-labelledby="titulo-paso" className="min-w-0">
          {indice === 0 && (
            <div className="mb-4 rounded-[15px] bg-navy px-4 py-3.5 text-[13px] leading-relaxed text-white">
              <b className="font-semibold text-gold">Antes de empezar:</b> {formato.instrucciones}
            </div>
          )}

          {avisos.map((aviso) => (
            <Alerta key={aviso} tono="info" className="mb-4">
              {aviso}
            </Alerta>
          ))}

          <div className="rounded-[15px] border border-borde bg-superficie p-4 shadow-[var(--sombra)] sm:p-5">
            <h2 id="titulo-paso" className="text-[19px] font-extrabold tracking-[-0.02em]">
              {paso.titulo}
            </h2>
            {paso.introduccion && (
              <p className="mt-1 text-[13px] leading-relaxed text-suave">{paso.introduccion}</p>
            )}

            <div className="mt-4 flex flex-col">
              {paso.preguntas.map((pregunta) => (
                <CampoPregunta
                  key={pregunta.clave}
                  pregunta={pregunta}
                  valor={respuestas[pregunta.clave]}
                  valorNoSe={formato.valorNoSe}
                  error={errores[pregunta.clave]}
                  onCambio={(valor) => responder(pregunta.clave, valor)}
                />
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5">
            <Boton type="button" variante="fantasma" disabled={indice === 0} onClick={() => irA(indice - 1)}>
              <ArrowLeft aria-hidden="true" />
              Anterior
            </Boton>
            <Boton
              type="button"
              variante="fantasma"
              tamano="chico"
              onClick={() => {
                sucio.current = true;
                void guardarAhora();
              }}
            >
              <Save aria-hidden="true" />
              Guardar borrador
            </Boton>
            {indice < visibles.length - 1 ? (
              <Boton type="button" onClick={() => irA(indice + 1)}>
                Siguiente
                <ArrowRight aria-hidden="true" />
              </Boton>
            ) : (
              <span className="text-[12.5px] text-suave lg:hidden">Ultimo paso: envialo abajo</span>
            )}
          </div>
        </section>

        <aside aria-labelledby="titulo-enviar" className="lg:sticky lg:top-6 lg:self-start">
          <form
            action={enviar}
            noValidate
            className="rounded-[15px] border border-borde bg-superficie p-4 shadow-[var(--sombra)] sm:p-5"
          >
            <input type="hidden" name="id" value={briefId} />
            <input type="hidden" name="respuestas" value={JSON.stringify(respuestas)} />

            <h2 id="titulo-enviar" className="text-[15px] font-bold">
              {version > 1 ? `Enviar la version ${version}` : "Al enviar"}
            </h2>

            <CampoFecha
              id="brief-fecha-aspirada"
              nombre="fechaAspirada"
              etiqueta="Fecha de entrega que aspiras"
              min={hoy}
              valor={fecha}
              onCambio={(valor) => {
                sucio.current = true;
                setFecha(valor);
              }}
              error={errores.fechaAspirada}
              ayuda="El equipo confirma si es viable o te propone otra."
              className="mt-3"
            />

            <dl className="mt-4 flex flex-col gap-2 border-t border-borde pt-3.5 text-[12px] leading-relaxed">
              <div>
                <dt className="font-semibold">Fecha de envio</dt>
                <dd className="text-suave">Se estampa sola al enviar, en hora de Caracas.</dd>
              </div>
              <div>
                <dt className="font-semibold">Codigo de seguimiento</dt>
                <dd className="text-suave">
                  {version > 1 ? "El mismo de la primera version." : "ECS-AAAAMMDD-XXXXXX, se asigna al enviar."}
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Copia por correo</dt>
                <dd className="text-suave">Recibes todo lo que llenaste, tal como lo escribiste.</dd>
              </div>
            </dl>

            <p className="mt-3.5 rounded-xl bg-gold/40 px-3 py-2.5 text-[12px] leading-relaxed text-navy dark-tema:bg-gold/15 dark-tema:text-gold">
              {noSe === 0
                ? "Ninguna respuesta marcada «No sé» por ahora."
                : noSe === 1
                  ? "1 respuesta marcada «No sé». La revisamos juntos en la reunion de arranque."
                  : `${noSe} respuestas marcadas «No sé». Las revisamos juntos en la reunion de arranque.`}
            </p>

            {estadoEnvio.mensaje && !estadoEnvio.ok && (
              <p role="alert" className="mt-3 text-[12px] font-medium text-blackberry dark-tema:text-acento">
                {estadoEnvio.mensaje}
              </p>
            )}

            <Boton type="submit" disabled={enviando} className="mt-3.5 w-full">
              <Send aria-hidden="true" />
              {enviando ? "Enviando..." : version > 1 ? `Enviar la version ${version}` : "Enviar brief"}
            </Boton>
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-suave">
              Si necesitas cambiar algo despues, envias una version nueva con el mismo codigo.
            </p>
          </form>
        </aside>
      </div>
    </div>
  );
}

/** Una pregunta, segun su tipo. */
function CampoPregunta({
  pregunta,
  valor,
  valorNoSe,
  error,
  onCambio,
}: {
  pregunta: Pregunta;
  valor: ValorRespuesta | undefined;
  valorNoSe: string;
  error?: string;
  onCambio: (valor: ValorRespuesta) => void;
}) {
  const id = `pregunta-${pregunta.clave}`;
  const texto = typeof valor === "string" ? valor : "";
  const esNoSe = texto === valorNoSe;

  const encabezado = (
    <>
      <span className="block text-[13.5px] font-semibold leading-snug">
        {pregunta.numero !== undefined && <span className="text-suave">{pregunta.numero}. </span>}
        {pregunta.texto}
        {pregunta.obligatoria && (
          <span className="text-blackberry dark-tema:text-acento" aria-hidden="true">
            {" "}*
          </span>
        )}
      </span>
      {pregunta.ayuda && <span className="mt-0.5 block text-[12px] leading-relaxed text-suave">{pregunta.ayuda}</span>}
    </>
  );

  const pieDeError = error && (
    <span role="alert" className="mt-1.5 block text-[12px] font-medium text-blackberry dark-tema:text-acento">
      {error}
    </span>
  );

  const fila = "border-b border-borde/70 py-4 first:pt-0 last:border-0 last:pb-0";

  if (pregunta.tipo === "matriz_alcance") {
    const filas = typeof valor === "object" && !Array.isArray(valor) && valor !== null ? (valor as Record<string, string>) : {};
    return (
      <fieldset className={fila}>
        <legend className="sr-only">{pregunta.texto}</legend>
        {pieDeError}
        <div className="flex flex-col">
          {(pregunta.filas ?? []).map((f) => (
            <div key={f.clave} role="group" aria-label={f.titulo} className="border-b border-borde/70 py-3 last:border-0">
              <p className="text-[13.5px] font-semibold">{f.titulo}</p>
              {f.descripcion && <p className="text-[12px] text-suave">{f.descripcion}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                {(pregunta.columnas ?? []).map((columna) => {
                  const elegida = filas[f.clave] === columna.valor;
                  return (
                    <button
                      key={columna.valor}
                      type="button"
                      aria-pressed={elegida}
                      onClick={() => onCambio({ ...filas, [f.clave]: columna.valor })}
                      className={[
                        "suave rounded-xl border px-3 py-2 text-[12.5px] font-semibold",
                        elegida
                          ? "border-acento bg-acento text-acento-contraste"
                          : "border-borde hover:-translate-y-px hover:border-acento",
                      ].join(" ")}
                    >
                      {columna.texto}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </fieldset>
    );
  }

  if (pregunta.tipo === "opcion_unica" || pregunta.tipo === "opcion_multiple") {
    const multiple = pregunta.tipo === "opcion_multiple";
    const elegidas = multiple ? (Array.isArray(valor) ? valor : []) : [texto];
    return (
      <fieldset className={fila}>
        <legend className="mb-2.5">{encabezado}</legend>
        <div className="flex flex-col gap-2">
          {(pregunta.opciones ?? []).map((opcion) => {
            const marcada = elegidas.includes(opcion.valor);
            return (
              <label
                key={opcion.valor}
                className={[
                  "suave flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 text-[13px]",
                  marcada ? "border-acento bg-acento-tenue" : "border-borde hover:border-acento",
                ].join(" ")}
              >
                <input
                  type={multiple ? "checkbox" : "radio"}
                  name={id}
                  checked={marcada}
                  onChange={() =>
                    onCambio(
                      multiple
                        ? marcada
                          ? elegidas.filter((v) => v !== opcion.valor)
                          : [...elegidas, opcion.valor]
                        : opcion.valor,
                    )
                  }
                  className="mt-0.5 accent-[var(--acento)]"
                />
                {opcion.texto}
              </label>
            );
          })}
        </div>
        {pieDeError}
      </fieldset>
    );
  }

  if (pregunta.tipo === "confirmacion") {
    return (
      <div className={fila}>
        <label className="flex cursor-pointer items-start gap-3 text-[13px] leading-relaxed">
          <input
            type="checkbox"
            checked={valor === true}
            onChange={(evento) => onCambio(evento.target.checked)}
            className="mt-0.5 size-[18px] shrink-0 accent-[var(--acento)]"
          />
          <span>{encabezado}</span>
        </label>
        {pieDeError}
      </div>
    );
  }

  const comunes = {
    id,
    value: texto,
    onChange: (evento: { target: { value: string } }) => onCambio(evento.target.value),
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  } as const;

  return (
    <div className={fila}>
      <label htmlFor={id} className="mb-2 block">
        {encabezado}
      </label>
      {pregunta.tipo === "texto_largo" ? (
        <textarea {...comunes} rows={3} maxLength={4000} className={`${CLASE_CONTROL} min-h-[84px]`} />
      ) : pregunta.tipo === "fecha" ? (
        // La fecha con el calendario de la casa; «No lo se» la deja vacia.
        <CampoFecha
          id={id}
          etiqueta={pregunta.texto}
          etiquetaOculta
          valor={esNoSe ? "" : texto}
          onCambio={onCambio}
        />
      ) : (
        <input
          {...comunes}
          type={pregunta.tipo === "email" ? "email" : pregunta.tipo === "telefono" ? "tel" : "text"}
          inputMode={pregunta.tipo === "numero" ? "decimal" : undefined}
          maxLength={500}
          className={claseLinea()}
        />
      )}
      {pregunta.permiteNoSe && (
        <button
          type="button"
          aria-pressed={esNoSe}
          onClick={() => onCambio(esNoSe ? "" : valorNoSe)}
          className={[
            "suave mt-2 rounded-lg border px-2.5 py-1 text-[12px] font-semibold",
            esNoSe ? "border-acento bg-acento text-acento-contraste" : "border-borde text-suave hover:border-acento",
          ].join(" ")}
        >
          No lo sé
        </button>
      )}
      {error && (
        <span id={`${id}-error`} role="alert" className="mt-1.5 block text-[12px] font-medium text-blackberry dark-tema:text-acento">
          {error}
        </span>
      )}
    </div>
  );
}
