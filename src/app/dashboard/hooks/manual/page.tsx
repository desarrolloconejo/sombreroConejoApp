import type { Metadata } from "next";

import { Wrapper } from "@/components/layout/Wrapper";
import { RotuloSeccion } from "@/components/hooks/SeccionesDocumentacion";
import {
  MapaRetencion,
  Tabla,
  TarjetaFundamento,
} from "@/components/hooks/PiezasManual";
import { nombreTerritorio, OBJETIVOS, PLATAFORMAS } from "@/lib/hooks/catalogo";
import { requerirCargo } from "@/lib/sesion";

/**
 * El manual: el criterio de la casa.
 *
 * Aqui no se decide nada de una pieza concreta, se aprende COMO se decide. Es
 * la unica pantalla del modulo que se lee entera una vez y despues solo se
 * consulta, y por eso todo esta desplegado: plegarlo obligaria a abrir siete
 * cosas para encontrar una.
 */

export const metadata: Metadata = {
  title: "Manual de hooks",
};

const MIGAS = [
  { texto: "Conejo App", href: "/dashboard" },
  { texto: "Hooks", href: "/dashboard/hooks" },
  { texto: "Manual" },
];

const PRINCIPIOS = [
  {
    nombre: "Relevancia",
    pregunta: "¿Para quien es y que vive ahora?",
    senal: "Esto me pasa.",
  },
  {
    nombre: "Claridad",
    pregunta: "¿Que vera o resolvera esta pieza?",
    senal: "Se entiende en una lectura.",
  },
  {
    nombre: "Evidencia",
    pregunta: "¿Que prueba real aparecera en pantalla?",
    senal: "Hay demostracion o resultado.",
  },
  {
    nombre: "Voz propia",
    pregunta: "¿Podria decirlo cualquier otra marca?",
    senal: "La escena es de este cliente.",
  },
  {
    nombre: "Recompensa",
    pregunta: "¿Cuando llega la primera senal de valor?",
    senal: "Ocurre antes del segundo cuatro.",
  },
];

const CAPAS = [
  ["01 · Visual", "La imagen orienta incluso cuando el sonido esta apagado."],
  [
    "02 · Insert-Titulo",
    "Condensa el nucleo en seis palabras o menos, sin transcribir la voz.",
  ],
  [
    "03 · Voz",
    "Declara la promesa sin saludo, contexto sobrante ni presentacion.",
  ],
];

const PATRONES = [
  ["Antes / despues", "Mismo angulo de camara en ambos estados."],
  ["Pantalla dividida", "Dos metodos o productos en paralelo desde el fotograma uno."],
  ["Macro o detalle", "Textura, costura, ingrediente, cifra o gesto."],
  ["Mano en accion", "Preparar, ajustar, mezclar, reparar o probar."],
  ["Objeto fuera de contexto", "Situacion inesperada pero relevante."],
  ["Pregunta fisica", "Tarjeta, pizarra, comentario o busqueda visible."],
  ["Dato visual", "Cifra senalada sobre documento o pantalla real."],
  ["Reaccion primero", "Persona ve el resultado antes de la explicacion."],
  ["Tres pasos", "Texto breve por etapa y demostracion."],
  ["Sonido tactil", "Corte, hervor, papel o herramienta como apoyo."],
];

const RELOJ = [
  ["0–1 s", "Orientar con imagen e Insert-Titulo."],
  ["1–4 s", "Confirmar prueba o escena relevante."],
  ["4–12 s", "Explicar, comparar o demostrar."],
  ["Cierre", "Conclusion y CTA proporcional."],
];

const PROHIBIDO = [
  ["«Hola chicos, bienvenidos»", "Retrasa el valor. Primera palabra = primera idea."],
  ["Insert-Titulo letra a letra", "Consume la ventana antes de comunicar nada."],
  [
    "Insert-Titulo = transcripcion",
    "El Insert-Titulo lleva el nucleo; la voz, la frase.",
  ],
  ["Prometer mas de lo que das", "Promete exactamente lo que entregaras."],
];

const CON_JUSTIFICACION = [
  ["«Espera al final»", "Solo si el final esta insinuado y la espera es corta."],
  ["«No vas a creer»", "Nombra que paso y oculta el porque."],
  ["Corte rapido generico", "Cada corte debe revelar contraste o prueba."],
  ["Repetir hook ganador", "Repite mecanismo, no palabras."],
  ["Producto en caja", "Abre con uso, manos o problema."],
  ["Marca de agua ajena", "Reexporta limpio y readapta."],
];

const VEREDICTOS = [
  ["Ganadora", "Supera base con volumen y alcance comparable."],
  ["Prometedora", "Va arriba, pero aun falta margen o volumen."],
  ["Inconclusa", "Alcance desigual o diferencias dentro del ruido."],
  ["Descartada", "Por debajo de la linea base con volumen suficiente."],
];

const CICLO = [
  "Un concepto, cinco aperturas.",
  "Pasar por auditor y filtro de calidad.",
  "Fijar metrica y margen.",
  "Grabar cuerpo una vez, aperturas tres.",
  "Publicar en paralelo.",
  "Leer a 72 h y con volumen minimo.",
  "Registrar en el banco.",
  "Rotar antes de que fatigue.",
];

const FUENTES = [
  {
    fiabilidad: "Directa" as const,
    titulo: "TikTok for Business — Creative best practices",
    aporta:
      "Documentacion oficial sobre propuesta de valor, hook inicial y margenes de seguridad.",
  },
  {
    fiabilidad: "Directa" as const,
    titulo: "Declaraciones publicas de Instagram",
    aporta: "Senales de ranking y prioridad a contenido humano y sin pulir.",
  },
  {
    fiabilidad: "Academica" as const,
    titulo: "Teoria del vacio informativo — Loewenstein",
    aporta:
      "Base del mecanismo de curiosidad: un hueco de informacion se busca cerrar. Es lo que sostiene el territorio G.",
  },
  {
    fiabilidad: "Vendor" as const,
    titulo: "Informes de analitica creativa",
    aporta:
      "Origen de las bandas de hook y hold rate. Contienen sesgo de cartera: son el escalon mas debil de esta lista.",
  },
];

const INSIGNIAS = {
  Directa: "bg-[rgb(53_96_60/0.14)] text-[#35603c] dark-tema:text-[#8fd39b]",
  Academica: "bg-acento-tenue text-acento",
  Vendor: "bg-[rgb(90_107_118/0.16)] text-suave",
} as const;

export default async function PaginaManual() {
  await requerirCargo("redes");

  return (
    <Wrapper
      migas={MIGAS}
      kicker="01 / Manual"
      titulo="El criterio de la casa"
      descripcion="Que abre atencion, que la cierra y por que. Se lee entero una vez y se vuelve cuando hay una duda concreta: aqui no se decide nada de una pieza, se aprende como se decide."
    >
      {/* ==================== 01 FUNDAMENTO ==================== */}
      <RotuloSeccion numero="01" titulo="Fundamento">
        Un hook abre atencion cuando nombra una tension real, y gana confianza
        cuando entrega una respuesta concreta. Las dos mitades hacen falta:
        nombrar sin entregar es un titular vacio, entregar sin nombrar no llega
        a leerse.
      </RotuloSeccion>

      <section className="surge rounded-[15px] border border-borde bg-superficie px-6 py-[22px] shadow-[var(--sombra)]">
        <div className="grid gap-3.5 md:grid-cols-3">
          <TarjetaFundamento
            rotulo="Captar atencion"
            titulo="La retencion es el primer filtro."
          >
            Un hook no garantiza el exito por si mismo, pero consigue que la
            audiencia se quede el tiempo suficiente para recibir el valor del
            contenido. Sin ese tiempo, lo demas da igual.
          </TarjetaFundamento>

          <TarjetaFundamento
            rotulo="Generar compartidos"
            titulo="Compartir confirma que la pieza importa."
          >
            Retener no basta: cuando alguien piensa «esto le puede servir a otra
            persona», el contenido gana alcance sin pagar por ello.
          </TarjetaFundamento>

          <TarjetaFundamento
            rotulo="Dar contexto"
            titulo="La decision empieza antes de escuchar."
          >
            El primer plano, el Insert-Titulo y la primera linea deben dejar
            claro de inmediato que esta ocurriendo y por que vale la pena seguir
            viendo.
          </TarjetaFundamento>
        </div>

        <div className="mt-[22px] grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div>
            <p className="mb-1.5 text-[17px] font-extrabold tracking-[-0.02em]">
              Cinco principios
            </p>
            <p className="mb-3.5 text-[12.5px] leading-relaxed text-suave">
              Cada uno es una pregunta y la senal de que esta resuelta. Si no
              puedes contestar la pregunta con una frase, ese principio todavia
              no se cumple. Usalos como control, no como formula.
            </p>

            <ul className="grid gap-[11px] sm:grid-cols-2">
              {PRINCIPIOS.map((p, i) => (
                <li
                  key={p.nombre}
                  className={[
                    "rounded-xl bg-campo px-[17px] py-[15px]",
                    i === PRINCIPIOS.length - 1 ? "sm:col-span-2" : "",
                  ].join(" ")}
                >
                  <h4 className="mb-1.5 text-[13.5px] font-bold tracking-[-0.01em]">
                    {p.nombre}
                  </h4>
                  <p className="text-xs leading-relaxed text-suave">{p.pregunta}</p>
                  <span className="mt-[7px] block text-[11.5px] font-semibold text-acento">
                    Senal: {p.senal}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[13px] border border-borde bg-campo p-5">
            <p className="mb-1.5 text-[10.5px] font-bold tracking-[0.1em] text-suave uppercase">
              Las tres capas
            </p>
            <p className="mb-1.5 text-[17px] font-extrabold tracking-[-0.02em]">
              Cada una debe sostener la promesa.
            </p>
            <p className="mb-4 text-[11.5px] leading-relaxed text-suave">
              Las tres llegan a la vez, no en fila. Si una falla, las otras dos
              no la rescatan.
            </p>

            <div className="flex flex-col gap-3.5">
              {CAPAS.map(([titulo, texto]) => (
                <div key={titulo}>
                  <p className="mb-1 text-[12.5px] font-bold text-acento">{titulo}</p>
                  <p className="text-xs leading-relaxed text-suave">{texto}</p>
                </div>
              ))}
            </div>

            <div className="mt-[18px] rounded-xl border border-acento/25 bg-acento-tenue px-[15px] py-3.5">
              <p className="mb-1.5 text-[12.5px] font-bold text-acento">
                Test de las dos privaciones.
              </p>
              <p className="text-[11.5px] leading-relaxed">
                Mira la pieza sin sonido y escuchala sin mirar pantalla. Cada
                capa debe explicar de que va y dar motivo para seguir.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 02 LA VENTANA ==================== */}
      <RotuloSeccion numero="02" titulo="La ventana">
        Todo lo anterior ocurre en tres segundos. Guion, primer fotograma,
        Insert-Titulo, prueba y montaje no se turnan: trabajan a la vez, en la
        misma ventana de atencion. Estos son los cuatro hitos que la reparten.
      </RotuloSeccion>

      <MapaRetencion />

      {/* ==================== 03 OBJETIVOS ==================== */}
      <RotuloSeccion numero="03" titulo="Objetivos y territorios">
        El objetivo no es una etiqueta: decide con que intencion se escribe (el
        territorio), que evidencia hace falta y contra que numero se juzga
        despues. Elegir mal el objetivo hace que la pieza se lea con la metrica
        equivocada.
      </RotuloSeccion>

      <Tabla
        cabeceras={["Objetivo", "Territorio", "Metrica principal", "Que hay que poder ensenar"]}
        anchos={["118px", "200px", "160px", ""]}
        filas={OBJETIVOS.map((o) => [
          <b key="n">{o.nombre}</b>,
          <span key="t" className="block text-suave">
            {nombreTerritorio(o.territorios[0])}
            <br />+ {nombreTerritorio(o.territorios[1])}
          </span>,
          o.metrica,
          <span key="e" className="text-suave">
            {o.evidencia} <b className="text-texto">{o.nota}</b>
          </span>,
        ])}
      />

      {/* ==================== 04 EN PANTALLA ==================== */}
      <RotuloSeccion numero="04" titulo="En pantalla">
        La edicion hace legible la idea; no compite con ella. Estos diez
        patrones no son efectos: son formas de ensenar la prueba. El primer
        fotograma tiene que comunicar aunque el sonido este apagado.
      </RotuloSeccion>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <Tabla
          cabeceras={["Patron", "Aplicacion"]}
          anchos={["190px", ""]}
          filas={PATRONES.map(([p, a]) => [<b key="p">{p}</b>, <span key="a" className="text-suave">{a}</span>])}
        />

        <div className="flex flex-col gap-3.5">
          <Tabla
            titulo="Reloj de la apertura"
            anchos={["74px", ""]}
            filas={RELOJ.map(([m, f]) => [<b key="m">{m}</b>, <span key="f" className="text-suave">{f}</span>])}
          />

          <div className="rounded-[15px] border border-borde bg-superficie px-5 py-[18px] shadow-[var(--sombra)]">
            <p className="mb-3 text-[10.5px] font-bold tracking-[0.1em] text-suave uppercase">
              Ajuste por plataforma
            </p>
            <div className="flex flex-col gap-3">
              {PLATAFORMAS.map((p) => (
                <div key={p.slug}>
                  <p className="mb-[3px] text-[12.5px] font-bold text-acento">
                    {p.nombre}
                  </p>
                  <p className="text-[11.5px] leading-relaxed text-suave">
                    {p.ajuste}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ==================== 05 CEMENTERIO ==================== */}
      <RotuloSeccion numero="05" titulo="Cementerio">
        Lo que no se usa, y por que. La primera lista no admite excepcion y el
        auditor la comprueba sola: si aparece cualquiera de esas formulas, la
        nota queda tapada. La segunda si se puede usar, pero exige una
        justificacion escrita en la ficha.
      </RotuloSeccion>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[15px] border border-borde bg-superficie px-[22px] py-5 shadow-[var(--sombra)]">
          <p className="mb-1.5 text-[10.5px] font-bold tracking-[0.1em] text-suave uppercase">
            No admite excepcion
          </p>
          <p className="mb-4 text-[17px] font-extrabold tracking-[-0.02em]">
            Prohibido sin excepcion
          </p>

          <ul>
            {PROHIBIDO.map(([recurso, porque]) => (
              <li
                key={recurso}
                className="grid gap-1 border-b border-borde py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:gap-4"
              >
                <b className="text-[12.5px]">{recurso}</b>
                <span className="text-[12.5px] leading-relaxed text-suave">
                  {porque}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <Tabla
          rotulo="Justificacion escrita"
          titulo="Permitido solo con justificacion"
          anchos={["200px", ""]}
          filas={CON_JUSTIFICACION.map(([r, c]) => [
            <b key="r">{r}</b>,
            <span key="c" className="text-suave">{c}</span>,
          ])}
        />
      </div>

      {/* ==================== 06 PROTOCOLO ==================== */}
      <RotuloSeccion numero="06" titulo="Protocolo de prueba">
        Como se compara una apertura con otra sin enganarse. Para una idea se
        producen tres aperturas que cambian UN factor y se comparan con una
        metrica decidida antes de publicar, no despues de ver los numeros.
      </RotuloSeccion>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="rounded-[15px] border border-borde bg-superficie px-[22px] py-[18px] shadow-[var(--sombra)]">
          {[
            [
              "Fijar una metrica",
              "La misma metrica primaria para todas las variantes, definida antes de rodar. Si se elige despues, siempre gana la que mejor salio en algo.",
            ],
            [
              "Cambiar un factor",
              "Enfoque, fotograma o evidencia. El cuerpo del video se conserva igual, o la comparacion deja de significar nada.",
            ],
            [
              "Guardar el aprendizaje",
              "Ganadora, prometedora, inconclusa o descartada. El porque importa mas que el numero: es lo que sirve para la siguiente pieza.",
            ],
          ].map(([titulo, texto], i) => (
            <div
              key={titulo}
              className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-3.5 border-b border-borde py-3.5 last:border-b-0"
            >
              <span className="grid size-[30px] place-items-center rounded-[9px] bg-acento-tenue text-xs font-extrabold text-acento">
                {i + 1}
              </span>
              <div>
                <h4 className="mb-1 text-[13.5px] font-bold">{titulo}</h4>
                <p className="text-[12.5px] leading-relaxed text-suave">{texto}</p>
              </div>
            </div>
          ))}

          <div className="mt-4 border-t border-borde pt-4">
            <p className="mb-2.5 text-[10.5px] font-bold tracking-[0.1em] text-suave uppercase">
              Los cuatro veredictos
            </p>
            <Tabla
              plana
              anchos={["120px", ""]}
              filas={VEREDICTOS.map(([v, c]) => [
                <b key="v">{v}</b>,
                <span key="c" className="text-suave">{c}</span>,
              ])}
            />
          </div>
        </div>

        <Tabla
          titulo="Ciclo semanal"
          anchos={["26px", ""]}
          filas={CICLO.map((paso, i) => [
            <b key="n" className="text-acento">{i + 1}</b>,
            paso,
          ])}
        />
      </div>

      {/* ==================== 07 FUENTES ==================== */}
      <RotuloSeccion numero="07" titulo="Fuentes">
        De donde sale todo lo anterior, etiquetado por fiabilidad para que se
        sepa cuanto pesa cada cosa. Verifica cada cifra antes de usarla ante un
        cliente: los formatos, los limites y las metricas cambian con
        frecuencia.
      </RotuloSeccion>

      <Tabla
        cabeceras={["Fiabilidad", "Titulo", "Que aporta"]}
        anchos={["106px", "290px", ""]}
        filas={FUENTES.map((f) => [
          <span
            key="f"
            className={[
              "inline-flex items-center rounded-md px-2.5 py-[3px]",
              "text-[10px] font-extrabold tracking-[0.06em] uppercase",
              INSIGNIAS[f.fiabilidad],
            ].join(" ")}
          >
            {f.fiabilidad}
          </span>,
          <b key="t">{f.titulo}</b>,
          <span key="a" className="text-suave">{f.aporta}</span>,
        ])}
      />
    </Wrapper>
  );
}
