import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { SECCION_DOCUMENTO } from "@/components/finanzas";
import { Wrapper } from "@/components/layout/Wrapper";
import { Listado } from "@/components/listado";
import { BotonCopiar } from "@/components/ui";
import { conSesion } from "@/lib/db";
import { aEscalado, deEscalado } from "@/lib/finanzas/calculo";
import { bolivares } from "@/lib/finanzas/documentos";
import { RUTA_COBRANZA, RUTA_FACTURAS } from "@/lib/finanzas/rutas";
import { leerEstadoListado } from "@/lib/parametros";
import { requerirFinanzas } from "@/lib/sesion";
import * as facturasModelo from "@/models/facturas";
import type { CobranzaEmpresa, Columna, DefinicionFiltro } from "@/types";

export const metadata: Metadata = {
  title: "Cobranza",
};

const MIGAS = [{ texto: "Conejo App", href: "/dashboard" }, { texto: "Cobranza" }];

/** Los tramos de antiguedad, contados desde el vencimiento de cada factura. */
const TRAMOS: { clave: keyof CobranzaEmpresa; texto: string }[] = [
  { clave: "porVencer", texto: "Por vencer" },
  { clave: "dias0a30", texto: "1 a 30 dias" },
  { clave: "dias31a60", texto: "31 a 60" },
  { clave: "dias61a90", texto: "61 a 90" },
  { clave: "mas90", texto: "Mas de 90" },
];

/** Suma importes en texto sin pasar por `number`. */
function sumar(importes: string[]): string {
  const total = importes.reduce((suma, importe) => suma + (aEscalado(importe, 2) ?? BigInt(0)), BigInt(0));
  return deEscalado(total, 2);
}

/** RIF y telefono de la empresa, cada uno con su boton de copiar. */
function ContactoCobro({ empresa }: { empresa: CobranzaEmpresa }) {
  if (!empresa.rif && !empresa.telefono) return null;
  return (
    <span className="flex flex-wrap items-center gap-x-3 text-[11.5px] text-suave">
      {empresa.rif && (
        <span className="inline-flex items-center gap-0.5 tabular-nums">
          {empresa.rif}
          <BotonCopiar texto={empresa.rif} que={`el RIF de ${empresa.empresaNombre}`} />
        </span>
      )}
      {empresa.telefono && (
        <span className="inline-flex items-center gap-0.5 tabular-nums">
          {empresa.telefono}
          <BotonCopiar texto={empresa.telefono} que={`el telefono de ${empresa.empresaNombre}`} />
        </span>
      )}
    </span>
  );
}

/** Lo vencido de una empresa: todos los tramos menos «por vencer». */
function vencidoDe(empresa: CobranzaEmpresa): string {
  return sumar([empresa.dias0a30, empresa.dias31a60, empresa.dias61a90, empresa.mas90]);
}

const ORDEN_PERMITIDO = ["total", "vencido", "mas90", "empresa"] as const;
type OrdenCobranza = (typeof ORDEN_PERMITIDO)[number];

/** Solo para ordenar: el cuerpo es la tabla de tramos de esta page. */
const COLUMNAS: Columna<CobranzaEmpresa>[] = [
  { clave: "total", titulo: "Total", ordenable: true, render: () => null },
  { clave: "vencido", titulo: "Vencido", ordenable: true, render: () => null },
  { clave: "mas90", titulo: "Mas de 90 dias", ordenable: true, render: () => null },
  { clave: "empresa", titulo: "Empresa", ordenable: true, render: () => null },
];

const SITUACIONES = ["vencido", "por_vencer", "retencion"] as const;

const FILTROS: DefinicionFiltro[] = [
  {
    clave: "situacion",
    titulo: "Situacion",
    opciones: [
      { valor: "vencido", texto: "Con deuda vencida" },
      { valor: "por_vencer", texto: "Solo por vencer" },
      { valor: "retencion", texto: "Retencion pendiente" },
    ],
  },
];

/** Para ordenar importes en texto sin pasar por `number`. */
function escalado(importe: string): bigint {
  return aEscalado(importe, 2) ?? BigInt(0);
}

function claveDeOrden(empresa: CobranzaEmpresa, orden: OrdenCobranza): bigint | string {
  if (orden === "empresa") return empresa.empresaNombre.toLowerCase();
  if (orden === "vencido") return escalado(vencidoDe(empresa));
  return escalado(String(empresa[orden]));
}

function rutaDeEmpresa(empresaId: number): string {
  return `${RUTA_FACTURAS}?empresa=${empresaId}&cobro=pendiente&cobro=parcial`;
}

/**
 * La cobranza: lo que debe cada empresa, repartido por antiguedad desde el
 * vencimiento de sus facturas. Un pago por confirmar no baja la deuda. Cada
 * empresa lleva a sus facturas abiertas.
 */
export default async function PaginaCobranza(props: PageProps<"/dashboard/cobranza">) {
  const usuario = await requerirFinanzas();
  const estado = leerEstadoListado(await props.searchParams, {
    ordenPermitido: ORDEN_PERMITIDO,
    ordenPorDefecto: "total",
    direccionPorDefecto: "desc",
    filtrosPermitidos: ["situacion"],
  });

  const empresas = await conSesion(usuario, (tx) => facturasModelo.cobranza(tx));

  // Las cifras de arriba son de todo; la tabla, de lo filtrado.
  const totales = Object.fromEntries(
    [...TRAMOS.map((t) => t.clave), "total" as const].map((clave) => [
      clave,
      sumar(empresas.map((e) => String(e[clave]))),
    ]),
  ) as Record<string, string>;
  const vencido = sumar([totales.dias0a30, totales.dias31a60, totales.dias61a90, totales.mas90]);

  // Una fila por empresa con deuda: son pocas, se buscan, filtran y ordenan
  // aqui. Lo que llega de la URL ya paso por leerEstadoListado.
  const termino = estado.busqueda.toLowerCase();
  const situaciones = (estado.filtros.situacion ?? []).filter((v) => (SITUACIONES as readonly string[]).includes(v));
  const orden = estado.orden as OrdenCobranza;
  const signo = estado.direccion === "asc" ? 1 : -1;
  const filtradas = empresas
    .filter(
      (e) =>
        !termino || e.empresaNombre.toLowerCase().includes(termino) || (e.rif ?? "").toLowerCase().includes(termino),
    )
    .filter(
      (e) =>
        situaciones.length === 0 ||
        situaciones.some((situacion) =>
          situacion === "vencido"
            ? escalado(vencidoDe(e)) > BigInt(0)
            : situacion === "por_vencer"
              ? escalado(vencidoDe(e)) === BigInt(0)
              : e.retencionesAbiertas > 0,
        ),
    )
    .sort((a, b) => {
      const x = claveDeOrden(a, orden);
      const y = claveDeOrden(b, orden);
      return x === y ? 0 : x > y ? signo : -signo;
    });
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / estado.porPagina));
  const visibles = filtradas.slice((estado.pagina - 1) * estado.porPagina, estado.pagina * estado.porPagina);
  const totalesFiltrados = Object.fromEntries(
    [...TRAMOS.map((t) => t.clave), "total" as const].map((clave) => [
      clave,
      sumar(filtradas.map((e) => String(e[clave]))),
    ]),
  ) as Record<string, string>;

  return (
    <Wrapper
      migas={MIGAS}
      kicker="Finanzas"
      titulo="Cobranza"
      descripcion="Lo que debe cada empresa, por antiguedad desde el vencimiento. Los pagos por confirmar todavia no cuentan."
    >
      <div className="surge grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { texto: "Por cobrar", valor: bolivares(totales.total) },
          { texto: "Vencido", valor: bolivares(vencido) },
          { texto: "Empresas con deuda", valor: String(empresas.length) },
        ].map((dato) => (
          <div key={dato.texto} className={SECCION_DOCUMENTO}>
            <p className="text-[12px] font-semibold text-suave">{dato.texto}</p>
            <p className="mt-1 text-[20px] font-extrabold tabular-nums tracking-[-0.02em]">{dato.valor}</p>
          </div>
        ))}
      </div>

      <Listado
        ruta={RUTA_COBRANZA}
        estado={estado}
        columnas={COLUMNAS}
        filas={visibles}
        total={filtradas.length}
        totalPaginas={totalPaginas}
        filtros={FILTROS}
        marcadorBusqueda="Empresa o RIF"
        etiquetaBusqueda="Buscar empresas"
        titulo="Por empresa"
        className="mt-6 [--retraso:0.06s]"
        vacio={<p className="px-5 py-8 text-center text-[13px] text-suave">Nadie debe nada. Las facturas con saldo apareceran aqui.</p>}
        cuerpo={(filas) => (
          <div className="px-5 py-3">
            <ul aria-label="Deuda por empresa" className="flex flex-col md:hidden">
              {filas.map((empresa) => (
                <li key={empresa.empresaId} className="border-b border-borde py-1 last:border-0">
                  <Link
                    href={rutaDeEmpresa(empresa.empresaId)}
                    className="suave -mx-2 flex items-center gap-3 rounded-xl px-2 pt-2 pb-1 hover:bg-acento-tenue"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-bold">{empresa.empresaNombre}</p>
                      <p className="text-[12px] text-suave">
                        {empresa.facturas} {empresa.facturas === 1 ? "factura" : "facturas"} · vencido{" "}
                        {bolivares(vencidoDe(empresa))}
                      </p>
                    </div>
                    <p className="text-[14px] font-bold tabular-nums">{bolivares(empresa.total)}</p>
                    <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-suave" />
                  </Link>
                  <ContactoCobro empresa={empresa} />
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[820px] border-collapse text-[13px]">
                <caption className="sr-only">Deuda por empresa y antiguedad</caption>
                <thead>
                  <tr className="border-b border-borde text-left text-[11px] font-bold uppercase tracking-[0.08em] text-suave">
                    <th scope="col" className="py-2 pr-2">
                      Empresa
                    </th>
                    {TRAMOS.map((tramo) => (
                      <th key={tramo.clave} scope="col" className="px-2 py-2 text-right">
                        {tramo.texto}
                      </th>
                    ))}
                    <th scope="col" className="py-2 pl-2 text-right">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((empresa) => (
                    <tr key={empresa.empresaId} className="border-b border-borde/70 last:border-0">
                      <td className="py-2.5 pr-2">
                        <Link
                          href={rutaDeEmpresa(empresa.empresaId)}
                          className="font-semibold text-acento hover:underline"
                        >
                          {empresa.empresaNombre}
                        </Link>
                        <ContactoCobro empresa={empresa} />
                        <span className="block text-[11.5px] text-suave">
                          {empresa.facturas} {empresa.facturas === 1 ? "factura" : "facturas"}
                          {empresa.retencionesAbiertas > 0
                            ? ` · ${empresa.retencionesAbiertas} con retencion pendiente`
                            : ""}
                        </span>
                      </td>
                      {TRAMOS.map((tramo) => {
                        const valor = String(empresa[tramo.clave]);
                        return (
                          <td
                            key={tramo.clave}
                            className={`px-2 py-2.5 text-right tabular-nums ${/^0(\.0+)?$/.test(valor) ? "text-suave" : ""}`}
                          >
                            {bolivares(valor)}
                          </td>
                        );
                      })}
                      <td className="py-2.5 pl-2 text-right font-bold tabular-nums">{bolivares(empresa.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-borde font-bold">
                    <td className="py-2.5 pr-2">Total</td>
                    {TRAMOS.map((tramo) => (
                      <td key={tramo.clave} className="px-2 py-2.5 text-right tabular-nums">
                        {bolivares(totalesFiltrados[tramo.clave])}
                      </td>
                    ))}
                    <td className="py-2.5 pl-2 text-right tabular-nums">{bolivares(totalesFiltrados.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      />
    </Wrapper>
  );
}
