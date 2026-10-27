"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";

import { Boton, Campo, Selector, Tarjeta, useCopiar } from "@/components/ui";
import type { OpcionSelector } from "@/components/ui";
import {
  bloqueVersion,
  EXTENSIONES_RAPIDAS,
  limpiarBloque,
  limpiarExtension,
  nombreDeArchivo,
  TIPOS_ARMADOR,
} from "@/lib/nomenclatura";
import type { ProyectoParaNombrar, SiglaEmpresa } from "@/types";

/**
 * El armador de nombres de archivo: lo que el estudio tenia en un HTML suelto,
 * con los clientes y los proyectos de la app.
 *
 * Sirve para los archivos que NO se suben a una pieza (presentaciones,
 * documentos internos, editables): los que se suben se renombran solos con
 * las mismas reglas (`src/lib/nomenclatura.ts`), asi que un archivo se llama
 * igual se nombre aqui o en la app.
 *
 * Todo pasa en el navegador: no guarda nada.
 */

/** Clientes que no son una empresa de la app. */
const OTRO = "__otro";
const INTERNO = "__interno";
const SIGLA_INTERNA = "CONEJO";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const VERSIONES: OpcionSelector[] = [
  ...Array.from({ length: 20 }, (_, indice) => {
    const numero = String(indice + 1).padStart(2, "0");
    return { valor: String(indice + 1), texto: `Version ${numero}`, detalle: `v${numero}` };
  }),
  { valor: "aprobado", texto: "Aprobado por el cliente", detalle: "La version final que se entrega y se archiva" },
];

const TIPOS: OpcionSelector[] = TIPOS_ARMADOR.map((tipo) => ({
  valor: tipo.valor,
  texto: tipo.nombre,
  detalle: `${tipo.grupo} · ${tipo.valor}`,
}));

/** Un bloque del resultado: el valor, o su hueco con el nombre de lo que falta. */
function Parte({ valor, hueco }: { valor: string; hueco: string }) {
  return valor ? <>{valor}</> : <span className="text-suave">{hueco}</span>;
}

export function ArmadorNombres({
  empresas,
  proyectos,
  hoy,
}: {
  empresas: SiglaEmpresa[];
  /** Los proyectos en marcha de todas las empresas, con su nombre corto. */
  proyectos: ProyectoParaNombrar[];
  /** AAAA-MM-DD, el dia de Caracas. */
  hoy: string;
}) {
  const anioActual = Number(hoy.slice(0, 4));

  const [cliente, setCliente] = useState("");
  const [clienteOtro, setClienteOtro] = useState("");
  const [proyectoId, setProyectoId] = useState("");
  const [proyectoEscrito, setProyectoEscrito] = useState("");
  const [tipo, setTipo] = useState("");
  const [mes, setMes] = useState(hoy.slice(5, 7));
  const [anio, setAnio] = useState(String(anioActual));
  const [version, setVersion] = useState("1");
  const [extension, setExtension] = useState("");

  const { copiado, copiar } = useCopiar();

  const empresa = empresas.find((candidata) => String(candidata.id) === cliente) ?? null;
  const deLaEmpresa = useMemo(
    () => (empresa ? proyectos.filter((proyecto) => proyecto.empresaId === empresa.id) : []),
    [empresa, proyectos],
  );
  const proyecto = deLaEmpresa.find((candidato) => String(candidato.id) === proyectoId) ?? null;

  // Cada bloque, ya en la nomenclatura.
  const bloqueCliente =
    cliente === OTRO ? limpiarBloque(clienteOtro) : cliente === INTERNO ? SIGLA_INTERNA : (empresa?.sigla ?? "");
  const bloqueProyecto = proyecto ? proyecto.nombreCorto : limpiarBloque(proyectoEscrito);
  const bloqueExtension = limpiarExtension(extension);
  const fecha = anio.slice(2) + mes;
  const numeroVersion = version === "aprobado" ? "aprobado" : Number(version);

  const faltan = [
    !bloqueCliente && "el cliente",
    !bloqueProyecto && "el proyecto",
    !tipo && "el tipo",
    !bloqueExtension && "la extension",
  ].filter((falta): falta is string => Boolean(falta));

  const nombre = nombreDeArchivo({
    cliente: bloqueCliente,
    proyecto: bloqueProyecto,
    tipo,
    fecha,
    version: numeroVersion,
    extension: bloqueExtension,
  });

  const opcionesCliente: OpcionSelector[] = [
    ...empresas.map((candidata) => ({ valor: String(candidata.id), texto: candidata.nombre, detalle: candidata.sigla })),
    { valor: INTERNO, texto: "El Conejo del Sombrero", detalle: `Uso interno · ${SIGLA_INTERNA}` },
    { valor: OTRO, texto: "Otro cliente", detalle: "Escribir el nombre" },
  ];

  const opcionesProyecto: OpcionSelector[] = [
    ...deLaEmpresa.map((candidato) => ({
      valor: String(candidato.id),
      texto: candidato.nombre,
      detalle: candidato.nombreCorto,
    })),
    { valor: "", texto: "Escribir otro", detalle: "Un proyecto o campana que no esta en la app" },
  ];

  const anios: OpcionSelector[] = [anioActual - 1, anioActual, anioActual + 1].map((valor) => ({
    valor: String(valor),
    texto: String(valor),
  }));

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <Tarjeta id="titulo-datos" titulo="Los datos">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2.5">
            <Selector
              id="nombre-cliente"
              etiqueta="Cliente"
              opciones={opcionesCliente}
              marcador="Elegir cliente…"
              valor={cliente}
              onCambio={(valor) => {
                setCliente(valor);
                setProyectoId("");
              }}
              ayuda="Va con la sigla de la empresa, la misma en todos sus archivos."
            />
            {cliente === OTRO && (
              <Campo
                id="nombre-cliente-otro"
                etiqueta="Nombre del cliente"
                value={clienteOtro}
                onChange={(evento) => setClienteOtro(evento.target.value)}
                placeholder="Empresas Polar"
                maxLength={40}
                autoComplete="off"
                ayuda="Cliente nuevo: pide a un administrador que lo registre en Empresas, para que todos lo escriban igual."
              />
            )}
          </div>

          <div className="flex flex-col gap-2.5">
            {empresa && deLaEmpresa.length > 0 && (
              <Selector
                id="nombre-proyecto"
                etiqueta="Proyecto"
                opciones={opcionesProyecto}
                valor={proyectoId}
                onCambio={setProyectoId}
                ayuda="Va con su nombre corto. Si no esta, escribelo."
              />
            )}
            {!proyecto && (
              <Campo
                id="nombre-proyecto-escrito"
                etiqueta={empresa && deLaEmpresa.length > 0 ? "Otro proyecto o campana" : "Proyecto o campana"}
                value={proyectoEscrito}
                onChange={(evento) => setProyectoEscrito(evento.target.value)}
                placeholder="Lanzamiento Prado"
                maxLength={60}
                autoComplete="off"
                ayuda={`Escribelo normal: queda como ${limpiarBloque(proyectoEscrito) || "LANZAMIENTO-PRADO"}.`}
              />
            )}
          </div>

          <Selector
            id="nombre-tipo"
            etiqueta="Tipo de archivo"
            opciones={TIPOS}
            marcador="Elegir tipo…"
            valor={tipo}
            onCambio={setTipo}
          />

          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold">Fecha</legend>
            <div className="grid grid-cols-2 gap-3">
              <Selector
                id="nombre-mes"
                etiqueta="Mes"
                etiquetaOculta
                opciones={MESES.map((texto, indice) => ({ valor: String(indice + 1).padStart(2, "0"), texto }))}
                valor={mes}
                onCambio={setMes}
              />
              <Selector id="nombre-anio" etiqueta="Ano" etiquetaOculta opciones={anios} valor={anio} onCambio={setAnio} />
            </div>
            <p className="mt-1.5 text-[11.5px] text-suave">
              El mes en que se trabaja. Va como ano y mes ({fecha}) para que las carpetas se ordenen solas.
            </p>
          </fieldset>

          <Selector
            id="nombre-version"
            etiqueta="Version"
            opciones={VERSIONES}
            valor={version}
            onCambio={setVersion}
            ayuda="Cada ajuste es una version nueva. «Aprobado por el cliente» es la ultima."
          />

          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold">Extension</legend>
            <div className="flex flex-wrap gap-1.5">
              {EXTENSIONES_RAPIDAS.map((opcion) => {
                const elegida = bloqueExtension === opcion;
                return (
                  <button
                    key={opcion}
                    type="button"
                    aria-pressed={elegida}
                    onClick={() => setExtension(opcion)}
                    className={[
                      "suave rounded-lg border px-2.5 py-1.5 font-mono text-[12px] hover:-translate-y-0.5",
                      elegida
                        ? "border-acento bg-acento text-acento-contraste"
                        : "border-borde bg-campo hover:border-acento",
                    ].join(" ")}
                  >
                    .{opcion}
                  </button>
                );
              })}
            </div>
            <Campo
              id="nombre-extension"
              etiqueta="Otra extension"
              value={extension}
              onChange={(evento) => setExtension(evento.target.value)}
              placeholder="key"
              maxLength={10}
              autoComplete="off"
              className="mt-3 max-w-[220px]"
              ayuda="El editable y el exportado se llaman igual: solo cambia esto."
            />
          </fieldset>
        </div>
      </Tarjeta>

      <div className="flex flex-col gap-6 lg:sticky lg:top-6">
        <Tarjeta id="titulo-nombre" titulo="El nombre">
          <p
            aria-live="polite"
            className="rounded-xl border border-borde bg-campo px-4 py-3.5 font-mono text-[14px] leading-relaxed font-semibold break-all"
          >
            <Parte valor={bloqueCliente} hueco="CLIENTE" />_<Parte valor={bloqueProyecto} hueco="PROYECTO" />_
            <Parte valor={tipo} hueco="TIPO" />_{fecha}_{bloqueVersion(numeroVersion)}.
            <Parte valor={bloqueExtension} hueco="ext" />
          </p>

          <p className="mt-3 text-[12.5px] leading-relaxed text-suave">
            {faltan.length > 0
              ? `Falta ${faltan.join(", ")}.`
              : "Cumple la nomenclatura. Usalo tal cual en el archivo, en el adjunto y al inicio del asunto del correo."}
          </p>

          <Boton
            type="button"
            className="mt-4 w-full"
            disabled={faltan.length > 0}
            onClick={() => void copiar(nombre)}
          >
            {copiado ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copiado ? "Copiado" : "Copiar nombre"}
          </Boton>
        </Tarjeta>

        <Tarjeta id="titulo-reglas" titulo="Las reglas">
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-[12.5px] leading-relaxed text-suave marker:font-semibold marker:text-texto">
            <li>
              Estructura fija: <code className="font-mono break-all text-texto">CLIENTE_PROYECTO_TIPO_AAMM_VERSION.ext</code>
            </li>
            <li>
              <code className="font-mono text-texto">_</code> separa bloques y{" "}
              <code className="font-mono text-texto">-</code> une palabras. Nunca espacios.
            </li>
            <li>Todo en mayusculas, sin acentos ni enie: Campana, no Campaña.</li>
            <li>
              La fecha es ano y mes: <code className="font-mono text-texto">2609</code> es septiembre de 2026.
            </li>
            <li>
              La version lleva cero: <code className="font-mono text-texto">v01</code>,{" "}
              <code className="font-mono text-texto">v02</code>… La que aprueba el cliente se guarda como{" "}
              <code className="font-mono text-texto">APROBADO-CLIENTE</code>.
            </li>
            <li>Lo que se sube a una pieza en la app se renombra solo con estas reglas.</li>
          </ol>
        </Tarjeta>
      </div>
    </div>
  );
}
