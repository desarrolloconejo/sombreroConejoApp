"use client";

import { useActionState, useState } from "react";
import { Copy, Grid3x3, Save, Star } from "lucide-react";

import { duplicarFormato, guardarFormato, marcarFormatoHabitual } from "@/actions/ajustesFinanzas";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { ASPECTO_CONTROL, Boton, Campo, Selector } from "@/components/ui";
import {
  CAMPOS_FACTURA,
  COLUMNAS_FACTURA,
  ESTADO_INICIAL,
  NOMBRES_DE_CAMPO_FACTURA,
  type CampoFactura,
  type ColumnaFactura,
  type FormatoImpresion,
} from "@/types";

/**
 * El editor de un formato de impresion: tamano de la hoja y donde va cada
 * dato, en milimetros desde la esquina superior izquierda. A la derecha, la
 * hoja a escala con cada dato recuadrado, para ver de un vistazo si algo se
 * pisa o se sale. Calibrar de verdad es imprimir la hoja de calibracion,
 * medir y ajustar.
 */

const OPCIONES_ALINEAR = [
  { valor: "izquierda", texto: "Izquierda" },
  { valor: "derecha", texto: "Derecha" },
];

type Fila = { usar: boolean; x: string; y: string; ancho: string; alinear: string };
type Columna = { x: string; ancho: string; alinear: string };

// Celdas estrechas: el alto compacto, con menos relleno lateral.
const CELDA = `${ASPECTO_CONTROL} h-10 px-2 text-[12.5px] tabular-nums`;

/** De un texto en milimetros a numero, para dibujar. Lo invalido no se dibuja. */
function mm(texto: string): number | null {
  const valor = Number(texto.replace(",", "."));
  return Number.isFinite(valor) ? valor : null;
}

function Hoja({
  ancho,
  alto,
  fuente,
  filas,
  renglones,
  columnas,
}: {
  ancho: number;
  alto: number;
  fuente: number;
  filas: Record<CampoFactura, Fila>;
  renglones: { yInicio: number; alto: number; max: number };
  columnas: Record<ColumnaFactura, Columna>;
}) {
  // Alto de una linea de texto: un punto son 0,3528 mm.
  const linea = fuente * 0.3528 * 1.25;

  return (
    <svg
      viewBox={`0 0 ${ancho} ${alto}`}
      role="img"
      aria-label={`Vista previa de la hoja de ${ancho} por ${alto} milimetros`}
      className="h-auto w-full rounded-lg border border-borde bg-superficie"
    >
      {CAMPOS_FACTURA.map((clave) => {
        const fila = filas[clave];
        const x = mm(fila.x);
        const y = mm(fila.y);
        const w = mm(fila.ancho);
        if (!fila.usar || x === null || y === null || w === null) return null;
        return (
          <g key={clave}>
            <rect x={x} y={y - linea} width={w} height={linea} className="fill-acento-tenue stroke-acento" strokeWidth={0.3} />
            <text x={x + 0.8} y={y - 0.8} fontSize={2.6} className="fill-texto">
              {NOMBRES_DE_CAMPO_FACTURA[clave]}
            </text>
          </g>
        );
      })}
      {COLUMNAS_FACTURA.map((clave) => {
        const columna = columnas[clave];
        const x = mm(columna.x);
        const w = mm(columna.ancho);
        if (x === null || w === null) return null;
        return (
          <rect
            key={clave}
            x={x}
            y={renglones.yInicio - linea}
            width={w}
            height={renglones.alto * renglones.max}
            className="fill-transparent stroke-suave"
            strokeWidth={0.3}
            strokeDasharray="1.5 1"
          />
        );
      })}
    </svg>
  );
}

export function EditorFormato({ formato }: { formato: FormatoImpresion }) {
  const [estado, enviar, enviando] = useActionState(guardarFormato, ESTADO_INICIAL);
  useAvisoDeAccion(estado);
  const errores = estado.errores ?? {};

  const [nombre, setNombre] = useState(formato.nombre);
  const [ancho, setAncho] = useState(formato.anchoMm);
  const [alto, setAlto] = useState(formato.altoMm);
  const [fuente, setFuente] = useState(formato.fuentePt);
  const [activo, setActivo] = useState(formato.activo);

  const [filas, setFilas] = useState<Record<CampoFactura, Fila>>(
    () =>
      Object.fromEntries(
        CAMPOS_FACTURA.map((clave) => {
          const p = formato.campos[clave];
          return [
            clave,
            {
              usar: Boolean(p),
              x: String(p?.x ?? 10),
              y: String(p?.y ?? 10),
              ancho: String(p?.ancho ?? 40),
              alinear: p?.alinear ?? "izquierda",
            },
          ];
        }),
      ) as Record<CampoFactura, Fila>,
  );

  const [yInicio, setYInicio] = useState(String(formato.renglones.y_inicio));
  const [altoRenglon, setAltoRenglon] = useState(String(formato.renglones.alto_mm));
  const [maximo, setMaximo] = useState(String(formato.renglones.max));
  const [columnas, setColumnas] = useState<Record<ColumnaFactura, Columna>>(
    () =>
      Object.fromEntries(
        COLUMNAS_FACTURA.map((clave) => {
          const c = formato.renglones.columnas[clave];
          return [clave, { x: String(c?.x ?? 10), ancho: String(c?.ancho ?? 30), alinear: c?.alinear ?? "izquierda" }];
        }),
      ) as Record<ColumnaFactura, Columna>,
  );

  const cambiarFila = (clave: CampoFactura, cambio: Partial<Fila>) =>
    setFilas((previas) => ({ ...previas, [clave]: { ...previas[clave], ...cambio } }));
  const cambiarColumna = (clave: ColumnaFactura, cambio: Partial<Columna>) =>
    setColumnas((previas) => ({ ...previas, [clave]: { ...previas[clave], ...cambio } }));

  return (
    <form action={enviar} noValidate className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
      <input type="hidden" name="id" value={formato.id} />

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-4">
          <Campo
            id="fmt-nombre"
            etiqueta="Nombre"
            name="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={80}
            error={errores.nombre}
            className="sm:col-span-4"
          />
          <Campo
            id="fmt-ancho"
            etiqueta="Ancho (mm)"
            name="anchoMm"
            inputMode="decimal"
            value={ancho}
            onChange={(e) => setAncho(e.target.value)}
            error={errores.anchoMm}
          />
          <Campo
            id="fmt-alto"
            etiqueta="Alto (mm)"
            name="altoMm"
            inputMode="decimal"
            value={alto}
            onChange={(e) => setAlto(e.target.value)}
            error={errores.altoMm}
          />
          <Campo
            id="fmt-fuente"
            etiqueta="Letra (pt)"
            name="fuentePt"
            inputMode="decimal"
            value={fuente}
            onChange={(e) => setFuente(e.target.value)}
            error={errores.fuentePt}
          />
          <label className="flex cursor-pointer items-end gap-2.5 pb-3 text-[13px] font-semibold">
            <input
              type="checkbox"
              name="activo"
              value="si"
              checked={activo}
              onChange={(e) => setActivo(e.target.checked)}
              className="size-4 accent-[var(--acento)]"
            />
            Activo
          </label>
        </div>

        <section aria-labelledby="titulo-campos">
          <h3 id="titulo-campos" className="mb-2 text-[14px] font-bold">
            Datos de la factura
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-suave">
                  <th className="py-2 pr-2">Dato</th>
                  <th className="w-[64px] px-1">X</th>
                  <th className="w-[64px] px-1">Y</th>
                  <th className="w-[72px] px-1">Ancho</th>
                  <th className="w-[118px] pl-1">Alinear</th>
                </tr>
              </thead>
              <tbody>
                {CAMPOS_FACTURA.map((clave) => {
                  const fila = filas[clave];
                  const etiqueta = NOMBRES_DE_CAMPO_FACTURA[clave];
                  return (
                    <tr key={clave} className="border-t border-borde">
                      <td className="py-1.5 pr-2">
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            name={`c_${clave}_usar`}
                            value="si"
                            checked={fila.usar}
                            onChange={(e) => cambiarFila(clave, { usar: e.target.checked })}
                            className="size-4 accent-[var(--acento)]"
                          />
                          <span className={fila.usar ? "font-semibold" : "text-suave"}>{etiqueta}</span>
                        </label>
                        {errores[`c_${clave}`] && (
                          <span role="alert" className="mt-0.5 block text-[11.5px] text-blackberry dark-tema:text-acento">
                            {errores[`c_${clave}`]}
                          </span>
                        )}
                      </td>
                      {(["x", "y", "ancho"] as const).map((eje) => (
                        <td key={eje} className="px-1 py-1.5">
                          <input
                            name={`c_${clave}_${eje}`}
                            inputMode="decimal"
                            aria-label={`${etiqueta}: ${eje === "ancho" ? "ancho" : eje.toUpperCase()} en milimetros`}
                            value={fila[eje]}
                            disabled={!fila.usar}
                            onChange={(e) => cambiarFila(clave, { [eje]: e.target.value })}
                            className={CELDA}
                          />
                        </td>
                      ))}
                      <td className="py-1.5 pl-1">
                        <Selector
                          id={`c_${clave}_alinear`}
                          nombre={`c_${clave}_alinear`}
                          etiqueta={`${etiqueta}: alineacion`}
                          etiquetaOculta
                          compacto
                          valor={fila.alinear}
                          deshabilitado={!fila.usar}
                          onCambio={(valor) => cambiarFila(clave, { alinear: valor })}
                          opciones={OPCIONES_ALINEAR}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="titulo-renglones" className="flex flex-col gap-3">
          <h3 id="titulo-renglones" className="text-[14px] font-bold">
            Renglones
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <Campo
              id="fmt-y-inicio"
              etiqueta="Primer renglon, Y (mm)"
              name="r_y_inicio"
              inputMode="decimal"
              value={yInicio}
              onChange={(e) => setYInicio(e.target.value)}
              error={errores.r_y_inicio}
            />
            <Campo
              id="fmt-alto-renglon"
              etiqueta="Alto de cada uno (mm)"
              name="r_alto_mm"
              inputMode="decimal"
              value={altoRenglon}
              onChange={(e) => setAltoRenglon(e.target.value)}
              error={errores.r_alto_mm}
            />
            <Campo
              id="fmt-max"
              etiqueta="Cuantos caben"
              name="r_max"
              inputMode="numeric"
              value={maximo}
              onChange={(e) => setMaximo(e.target.value)}
              error={errores.r_max}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-suave">
                  <th className="py-2 pr-2">Columna</th>
                  <th className="w-[64px] px-1">X</th>
                  <th className="w-[72px] px-1">Ancho</th>
                  <th className="w-[118px] pl-1">Alinear</th>
                </tr>
              </thead>
              <tbody>
                {COLUMNAS_FACTURA.map((clave) => {
                  const columna = columnas[clave];
                  const etiqueta = NOMBRES_DE_CAMPO_FACTURA[clave];
                  return (
                    <tr key={clave} className="border-t border-borde">
                      <td className="py-1.5 pr-2 font-semibold">
                        {etiqueta}
                        {errores[`k_${clave}`] && (
                          <span role="alert" className="mt-0.5 block text-[11.5px] font-normal text-blackberry dark-tema:text-acento">
                            {errores[`k_${clave}`]}
                          </span>
                        )}
                      </td>
                      {(["x", "ancho"] as const).map((eje) => (
                        <td key={eje} className="px-1 py-1.5">
                          <input
                            name={`k_${clave}_${eje}`}
                            inputMode="decimal"
                            aria-label={`${etiqueta}: ${eje === "ancho" ? "ancho" : "X"} en milimetros`}
                            value={columna[eje]}
                            onChange={(e) => cambiarColumna(clave, { [eje]: e.target.value })}
                            className={CELDA}
                          />
                        </td>
                      ))}
                      <td className="py-1.5 pl-1">
                        <Selector
                          id={`k_${clave}_alinear`}
                          nombre={`k_${clave}_alinear`}
                          etiqueta={`${etiqueta}: alineacion`}
                          etiquetaOculta
                          compacto
                          valor={columna.alinear}
                          onCambio={(valor) => cambiarColumna(clave, { alinear: valor })}
                          opciones={OPCIONES_ALINEAR}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex justify-end border-t border-borde pt-4">
          <Boton type="submit" disabled={enviando}>
            <Save aria-hidden="true" />
            {enviando ? "Guardando..." : "Guardar el formato"}
          </Boton>
        </div>
      </div>

      <aside aria-label="Vista previa" className="xl:sticky xl:top-6 xl:self-start">
        <p className="mb-2 text-[12px] text-suave">
          La hoja a escala. Cada recuadro es un dato; las lineas punteadas, las columnas de los renglones.
        </p>
        <Hoja
          ancho={mm(ancho) ?? 215.9}
          alto={mm(alto) ?? 279.4}
          fuente={mm(fuente) ?? 9}
          filas={filas}
          renglones={{ yInicio: mm(yInicio) ?? 0, alto: mm(altoRenglon) ?? 0, max: Number(maximo) || 0 }}
          columnas={columnas}
        />
      </aside>
    </form>
  );
}

/** Marcar como habitual y duplicar. Los dos vuelven a pintar la pagina. */
export function AccionesFormato({ id, habitual, activo }: { id: number; habitual: boolean; activo: boolean }) {
  const [estadoHabitual, marcar, marcando] = useActionState(marcarFormatoHabitual, ESTADO_INICIAL);
  const [estadoCopia, duplicar, duplicando] = useActionState(duplicarFormato, ESTADO_INICIAL);
  useAvisoDeAccion(estadoHabitual);
  useAvisoDeAccion(estadoCopia);

  return (
    <div className="flex flex-wrap gap-2.5">
      <a
        href={`/api/formatos/${id}/calibracion`}
        target="_blank"
        rel="noopener"
        className="suave inline-flex min-h-9 items-center gap-2 rounded-xl border border-borde px-3.5 text-[13px] font-semibold hover:-translate-y-0.5 hover:border-acento [&>svg]:size-4"
      >
        <Grid3x3 aria-hidden="true" />
        Hoja de calibracion
      </a>
      {!habitual && activo && (
        <form action={marcar}>
          <input type="hidden" name="id" value={id} />
          <Boton type="submit" variante="fantasma" tamano="chico" disabled={marcando}>
            <Star aria-hidden="true" />
            Usar como habitual
          </Boton>
        </form>
      )}
      <form action={duplicar}>
        <input type="hidden" name="id" value={id} />
        <Boton type="submit" variante="fantasma" tamano="chico" disabled={duplicando}>
          <Copy aria-hidden="true" />
          Duplicar
        </Boton>
      </form>
    </div>
  );
}
