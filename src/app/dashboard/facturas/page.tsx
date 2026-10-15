import type { Metadata } from "next";
import Link from "next/link";
import { ReceiptText } from "lucide-react";

import { columnasFacturas, EmitirFactura, filtrosFacturas } from "@/components/facturas";
import { fechaDia, SECCION_DOCUMENTO } from "@/components/finanzas";
import { Wrapper } from "@/components/layout/Wrapper";
import { Listado, ListadoVacio } from "@/components/listado";
import { conSesion } from "@/lib/db";
import { dolares, numeroDe } from "@/lib/finanzas/documentos";
import { RUTA_FACTURAS, rutaFactura, rutaProforma } from "@/lib/finanzas/rutas";
import { leerEstadoListado } from "@/lib/parametros";
import { requerirFinanzas } from "@/lib/sesion";
import { comoIdentificador } from "@/lib/validaciones";
import * as empresasModelo from "@/models/empresas";
import * as facturasModelo from "@/models/facturas";
import * as proformasModelo from "@/models/proformas";
import type { EstadoCobro } from "@/types";

/**
 * Las facturas emitidas, con su estado de cobro. Arriba, las proformas
 * emitidas que aun no tienen factura: nada se factura solo.
 */

export const metadata: Metadata = {
  title: "Facturas",
};

const ORDEN_PERMITIDO = ["numero", "fechaEmision", "total"] as const;
const COBROS: readonly EstadoCobro[] = ["pendiente", "parcial", "pagada", "anulada"];
const MIGAS = [{ texto: "Conejo App", href: "/dashboard" }, { texto: "Facturas" }];

function soloDe<T extends string>(valores: string[] | undefined, permitidos: readonly T[]) {
  const validos = (valores ?? []).filter((v): v is T => (permitidos as readonly string[]).includes(v));
  return validos.length > 0 ? validos : undefined;
}

export default async function PaginaFacturas(props: PageProps<"/dashboard/facturas">) {
  const usuario = await requerirFinanzas();

  const estado = leerEstadoListado(await props.searchParams, {
    ordenPermitido: ORDEN_PERMITIDO,
    ordenPorDefecto: "numero",
    direccionPorDefecto: "desc",
    filtrosPermitidos: ["cobro", "empresa"],
  });

  const nombres = await empresasModelo.nombres();

  const { pagina, porFacturar } = await conSesion(usuario, async (tx) => {
    const empresaIds = (estado.filtros.empresa ?? [])
      .map(comoIdentificador)
      .filter((id): id is number => id !== null);

    return {
      pagina: await facturasModelo.listar(
        {
          busqueda: estado.busqueda || undefined,
          cobro: soloDe(estado.filtros.cobro, COBROS),
          empresaId: empresaIds.length > 0 ? empresaIds : undefined,
          orden: estado.orden as (typeof ORDEN_PERMITIDO)[number],
          direccion: estado.direccion,
          pagina: estado.pagina,
          porPagina: estado.porPagina,
        },
        tx,
      ),
      porFacturar: await proformasModelo.porFacturar(tx),
    };
  });

  return (
    <Wrapper
      migas={MIGAS}
      kicker="Finanzas"
      titulo="Facturas"
      descripcion="Lo facturado, en bolivares a la tasa del dia, y cuanto falta por cobrar de cada una."
    >
      {porFacturar.length > 0 && (
        <section aria-labelledby="titulo-por-facturar" className={`surge mb-6 ${SECCION_DOCUMENTO}`}>
          <h2 id="titulo-por-facturar" className="flex items-center gap-2 text-[15px] font-bold [&>svg]:size-4">
            <ReceiptText aria-hidden="true" className="text-acento" />
            Proformas por facturar
          </h2>
          <p className="mt-1 text-[12.5px] text-suave">
            Emitidas y sin factura. Al facturar se toma el siguiente numero, la tasa del dia y una copia de los datos
            del cliente.
          </p>
          <ul className="mt-3 flex flex-col">
            {porFacturar.map((proforma) => (
              <li
                key={proforma.id}
                className="flex flex-wrap items-center justify-between gap-3 border-t border-borde py-3"
              >
                <div className="min-w-0">
                  <Link href={rutaProforma(proforma.id)} className="text-[13.5px] font-semibold hover:underline">
                    {proforma.empresaNombre} · {proforma.titulo}
                  </Link>
                  <p className="text-[12px] text-suave">
                    {numeroDe("proforma", proforma.numero)} · {dolares(proforma.total)} · emitida el{" "}
                    {fechaDia(proforma.emitidaEn ? proforma.emitidaEn.toISOString().slice(0, 10) : null)}
                  </p>
                </div>
                <EmitirFactura
                  proformaId={proforma.id}
                  etiqueta={`Emitir la factura de ${numeroDe("proforma", proforma.numero)}`}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <Listado
        ruta={RUTA_FACTURAS}
        estado={estado}
        columnas={columnasFacturas(rutaFactura)}
        filtros={filtrosFacturas(nombres)}
        filas={pagina.filas}
        total={pagina.total}
        totalPaginas={pagina.totalPaginas}
        claveFila={(factura) => factura.id}
        titulo="Facturas"
        etiquetaBusqueda="Buscar facturas"
        marcadorBusqueda="Buscar por empresa, numero o control"
        vacio={
          <ListadoVacio
            titulo="Todavia no hay facturas"
            descripcion="Una factura sale de una proforma emitida: aparecen arriba, en «Proformas por facturar»."
          />
        }
      />
    </Wrapper>
  );
}
