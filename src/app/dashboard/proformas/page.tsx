import type { Metadata } from "next";
import Link from "next/link";
import { Repeat } from "lucide-react";

import { fechaDia, SECCION_DOCUMENTO } from "@/components/finanzas";
import { Wrapper } from "@/components/layout/Wrapper";
import { Listado, ListadoVacio } from "@/components/listado";
import { columnasProformas, filtrosProformas, PrepararSiguiente } from "@/components/proformas";
import { BotonEnlace } from "@/components/ui";
import { conSesion } from "@/lib/db";
import { dolares, numeroDe } from "@/lib/finanzas/documentos";
import { RUTA_PRESUPUESTOS, RUTA_PROFORMAS, rutaProforma } from "@/lib/finanzas/rutas";
import { leerEstadoListado } from "@/lib/parametros";
import { requerirFinanzas } from "@/lib/sesion";
import { comoIdentificador } from "@/lib/validaciones";
import * as empresasModelo from "@/models/empresas";
import * as proformasModelo from "@/models/proformas";
import type { EstadoProforma } from "@/types";

/**
 * Las proformas: lo aprobado que se va a facturar.
 *
 * Arriba, las recurrentes a las que ya les toca la siguiente. No hay tareas
 * programadas que las preparen: se ven aqui, y un boton deja la copia lista
 * para revisar. Nada se emite solo.
 */

export const metadata: Metadata = {
  title: "Proformas",
};

const ORDEN_PERMITIDO = ["numero", "creadoEn", "total"] as const;

const MIGAS = [{ texto: "Conejo App", href: "/dashboard" }, { texto: "Proformas" }];

const ESTADOS: readonly EstadoProforma[] = ["borrador", "emitida", "facturada", "anulada"];

function soloDe<T extends string>(valores: string[] | undefined, permitidos: readonly T[]) {
  const validos = (valores ?? []).filter((v): v is T => (permitidos as readonly string[]).includes(v));
  return validos.length > 0 ? validos : undefined;
}

export default async function PaginaProformas(props: PageProps<"/dashboard/proformas">) {
  const usuario = await requerirFinanzas();

  const estado = leerEstadoListado(await props.searchParams, {
    ordenPermitido: ORDEN_PERMITIDO,
    ordenPorDefecto: "numero",
    direccionPorDefecto: "desc",
    filtrosPermitidos: ["estado", "empresa", "recurrente"],
  });

  const nombres = await empresasModelo.nombres();

  const { pagina, pendientes } = await conSesion(usuario, async (tx) => {
    const empresaIds = (estado.filtros.empresa ?? [])
      .map(comoIdentificador)
      .filter((id): id is number => id !== null);

    return {
      pagina: await proformasModelo.listar(
        {
          busqueda: estado.busqueda || undefined,
          estado: soloDe(estado.filtros.estado, ESTADOS),
          empresaId: empresaIds.length > 0 ? empresaIds : undefined,
          soloRecurrentes: (estado.filtros.recurrente ?? []).includes("si"),
          orden: estado.orden as (typeof ORDEN_PERMITIDO)[number],
          direccion: estado.direccion,
          pagina: estado.pagina,
          porPagina: estado.porPagina,
        },
        tx,
      ),
      pendientes: await proformasModelo.recurrentesPendientes(tx),
    };
  });

  return (
    <Wrapper
      migas={MIGAS}
      kicker="Finanzas"
      titulo="Proformas"
      descripcion="Lo aprobado que se va a facturar. Salen de los presupuestos aprobados, o se repiten cada mes."
    >
      {pendientes.length > 0 && (
        <section aria-labelledby="titulo-pendientes" className={`surge mb-6 ${SECCION_DOCUMENTO}`}>
          <h2 id="titulo-pendientes" className="flex items-center gap-2 text-[15px] font-bold [&>svg]:size-4">
            <Repeat aria-hidden="true" className="text-acento" />
            Toca preparar la siguiente
          </h2>
          <p className="mt-1 text-[12.5px] text-suave">
            Recurrentes con la fecha ya llegada. Preparar deja una copia en borrador para
            revisarla antes de emitirla.
          </p>
          <ul className="mt-3 flex flex-col">
            {pendientes.map((proforma) => (
              <li
                key={proforma.id}
                className="flex flex-wrap items-center justify-between gap-3 border-t border-borde py-3"
              >
                <div className="min-w-0">
                  <Link href={rutaProforma(proforma.id)} className="text-[13.5px] font-semibold hover:underline">
                    {proforma.empresaNombre} · {proforma.titulo}
                  </Link>
                  <p className="text-[12px] text-suave">
                    {numeroDe("proforma", proforma.numero)} · {dolares(proforma.total)} · tocaba el{" "}
                    {fechaDia(proforma.proximaEmision)}
                  </p>
                </div>
                <PrepararSiguiente
                  proformaId={proforma.id}
                  etiqueta={`Preparar la siguiente de ${numeroDe("proforma", proforma.numero)}`}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <Listado
        ruta={RUTA_PROFORMAS}
        estado={estado}
        columnas={columnasProformas()}
        filtros={filtrosProformas(nombres)}
        filas={pagina.filas}
        total={pagina.total}
        totalPaginas={pagina.totalPaginas}
        claveFila={(proforma) => proforma.id}
        titulo="Proformas"
        etiquetaBusqueda="Buscar proformas"
        marcadorBusqueda="Buscar por titulo, empresa o numero"
        vacio={
          <ListadoVacio
            titulo="Todavia no hay proformas"
            descripcion="Una proforma sale de un presupuesto aprobado: abrelo y pulsa «Generar la proforma»."
            accion={
              <BotonEnlace href={`${RUTA_PRESUPUESTOS}?situacion=aprobado`} tamano="chico">
                Ver los presupuestos aprobados
              </BotonEnlace>
            }
          />
        }
      />
    </Wrapper>
  );
}
