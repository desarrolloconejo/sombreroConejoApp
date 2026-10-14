import { dolares } from "@/lib/finanzas/documentos";
import { ZONA_HORARIA } from "@/lib/fechas";
import {
  NOMBRES_DE_ESTADO_PROFORMA,
  NOMBRES_DE_SITUACION,
  type EstadoProforma,
  type Importes,
  type Renglon,
  type SituacionPresupuesto,
} from "@/types";

/**
 * Las piezas de lectura de un presupuesto o una proforma: su estado, sus
 * renglones y sus importes. Las usan el operador y el cliente, que ven el
 * mismo documento.
 *
 * Son de servidor: solo pintan. Los importes llegan como texto decimal y se
 * formatean sin pasar por `number`.
 */

/** La tarjeta en la que va cada bloque del documento. */
export const SECCION_DOCUMENTO =
  "rounded-[15px] border border-borde bg-superficie p-4 shadow-[var(--sombra)] sm:p-5";

const FECHA_HORA = new Intl.DateTimeFormat("es-VE", {
  timeZone: ZONA_HORARIA,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * Una fecha AAAA-MM-DD, larga. En UTC a proposito: no es un instante sino un
 * dia del calendario, y pasarlo por otra zona lo correria al dia anterior.
 */
const FECHA_DIA = new Intl.DateTimeFormat("es-VE", {
  timeZone: "UTC",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** La misma fecha, corta, para columnas estrechas: «14 nov 2026». */
const FECHA_DIA_CORTA = new Intl.DateTimeFormat("es-VE", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function fechaDiaCorta(fecha: string | null): string {
  return fecha ? FECHA_DIA_CORTA.format(new Date(`${fecha}T00:00:00Z`)) : "—";
}

export function fechaHora(fecha: Date | null): string {
  return fecha ? FECHA_HORA.format(fecha) : "—";
}

export function fechaDia(fecha: string | null): string {
  return fecha ? FECHA_DIA.format(new Date(`${fecha}T00:00:00Z`)) : "—";
}

/** Cuanto pesa cada situacion: lo que pide atencion, en relleno. */
const SOLIDAS = new Set<string>(["enviado", "emitida"]);

export function EtiquetaDocumento({
  situacion,
}: {
  situacion: SituacionPresupuesto | EstadoProforma;
}) {
  const texto =
    situacion in NOMBRES_DE_SITUACION
      ? NOMBRES_DE_SITUACION[situacion as SituacionPresupuesto]
      : NOMBRES_DE_ESTADO_PROFORMA[situacion as EstadoProforma];

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1",
        "text-[10.5px] font-semibold uppercase tracking-[0.06em]",
        SOLIDAS.has(situacion)
          ? "border-transparent bg-acento text-acento-contraste"
          : situacion === "rechazado" ||
              situacion === "anulada" ||
              situacion === "vencido"
            ? "border-blackberry/40 text-blackberry dark-tema:border-gold/40 dark-tema:text-acento"
            : "border-borde text-suave",
      ].join(" ")}
    >
      {texto}
    </span>
  );
}

/**
 * Los renglones de un documento, solo lectura.
 *
 * En movil, una lista apilada: descripcion arriba y «cantidad x precio» con su
 * subtotal debajo. Una tabla de cuatro columnas no cabe en 390 px sin
 * desplazarse de lado, y el cliente lo lee sobre todo en el telefono. Desde
 * tablet, la tabla.
 */
export function TablaRenglones({ renglones }: { renglones: Renglon[] }) {
  if (renglones.length === 0) {
    return (
      <p className="text-[13px] text-suave">
        Este documento no tiene renglones.
      </p>
    );
  }

  return (
    <>
      <ul
        aria-label="Renglones del documento"
        className="flex flex-col sm:hidden"
      >
        {renglones.map((renglon) => (
          <li
            key={renglon.id}
            className="border-b border-borde/70 py-2.5 first:pt-0 last:border-0"
          >
            <p className="text-[13.5px] leading-snug">
              {renglon.descripcion}
              {renglon.exento && (
                <span className="ml-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-suave">
                  Exento
                </span>
              )}
            </p>
            <p className="mt-1 flex justify-between gap-3 text-[12.5px] tabular-nums">
              <span className="text-suave">
                {cantidadLegible(renglon.cantidad)} x{" "}
                {dolares(renglon.precioUnitario)}
              </span>
              <span className="font-semibold">{dolares(renglon.subtotal)}</span>
            </p>
          </li>
        ))}
      </ul>

      <div className="hidden sm:block">
        <table className="w-full border-collapse text-[13px]">
          <caption className="sr-only">Renglones del documento</caption>
          <thead>
            <tr className="border-b border-borde text-left text-[11px] font-bold uppercase tracking-[0.08em] text-suave">
              <th scope="col" className="py-2 pr-2 font-bold">
                Descripcion
              </th>
              <th scope="col" className="px-2 py-2 text-right font-bold">
                Cantidad
              </th>
              <th scope="col" className="px-2 py-2 text-right font-bold">
                Precio
              </th>
              <th scope="col" className="py-2 pl-2 text-right font-bold">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {renglones.map((renglon) => (
              <tr
                key={renglon.id}
                className="border-b border-borde/70 last:border-0"
              >
                <td className="py-2.5 pr-2">
                  {renglon.descripcion}
                  {renglon.exento && (
                    <span className="ml-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-suave">
                      Exento
                    </span>
                  )}
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums">
                  {cantidadLegible(renglon.cantidad)}
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums">
                  {dolares(renglon.precioUnitario)}
                </td>
                <td className="py-2.5 pl-2 text-right font-semibold tabular-nums">
                  {dolares(renglon.subtotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** 2.500 -> «2,5»; 1.000 -> «1». Sin ceros que no dicen nada. */
export function cantidadLegible(cantidad: string): string {
  const [entera, fraccion = ""] = cantidad.split(".");
  const limpia = fraccion.replace(/0+$/, "");
  return limpia ? `${entera},${limpia}` : entera;
}

/** Base, exento, IVA y total. El total, destacado. */
export function ResumenImportes({ importes }: { importes: Importes }) {
  const iva = importes.ivaPct.replace(/\.00$/, "");
  const filas = [
    { texto: "Base imponible", valor: importes.baseImponible },
    { texto: "Exento", valor: importes.montoExento },
    { texto: `IVA (${iva} %)`, valor: importes.ivaMonto },
  ];

  return (
    <dl className="ml-auto w-full max-w-[320px] text-[13px]">
      {filas.map((fila) => (
        <div key={fila.texto} className="flex justify-between gap-4 py-1">
          <dt className="text-suave">{fila.texto}</dt>
          <dd className="tabular-nums">{dolares(fila.valor)}</dd>
        </div>
      ))}
      <div className="mt-1.5 flex justify-between gap-4 border-t border-borde pt-2.5">
        <dt className="font-bold">Total</dt>
        <dd className="text-[17px] font-extrabold tabular-nums tracking-[-0.01em]">
          {dolares(importes.total)}
        </dd>
      </div>
    </dl>
  );
}
