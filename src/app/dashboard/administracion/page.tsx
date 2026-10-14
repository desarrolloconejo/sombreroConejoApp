import type { Metadata } from "next";

import { ListaDocumentos } from "@/components/administracion";
import { fechaDia, fechaHora, SECCION_DOCUMENTO } from "@/components/finanzas";
import { Wrapper } from "@/components/layout/Wrapper";
import { conSesion } from "@/lib/db";
import { numeroDe, situacionDe } from "@/lib/finanzas/documentos";
import { rutaMiPresupuesto, rutaMiProforma } from "@/lib/finanzas/rutas";
import { requerirFinanzasDeEmpresa } from "@/lib/sesion";
import * as presupuestosModelo from "@/models/presupuestos";
import * as proformasModelo from "@/models/proformas";

export const metadata: Metadata = {
  title: "Administracion",
};

const MIGAS = [{ texto: "Conejo App", href: "/dashboard" }, { texto: "Administracion" }];

/**
 * Las finanzas de la empresa, para quien tiene el permiso: lo que espera su
 * aprobacion primero, despues las proformas y lo ya decidido.
 *
 * Las consultas no filtran por empresa: lo hace la base, con la sesion.
 */
export default async function PaginaAdministracion() {
  const { usuario } = await requerirFinanzasDeEmpresa();

  const { porAprobar, historial, proformas } = await conSesion(usuario, async (tx) => ({
    porAprobar: await presupuestosModelo.porAprobar(tx),
    historial: await presupuestosModelo.historial(tx),
    proformas: await proformasModelo.emitidas(tx),
  }));

  return (
    <Wrapper
      migas={MIGAS}
      kicker={usuario.empresaNombre ?? "Tu empresa"}
      titulo="Administracion"
      descripcion="Los presupuestos que esperan tu aprobacion y las proformas de tu empresa."
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section aria-labelledby="titulo-por-aprobar" className="surge">
          <h2 id="titulo-por-aprobar" className="mb-3 text-[19px] font-extrabold tracking-[-0.02em]">
            Por aprobar
          </h2>
          <div className={SECCION_DOCUMENTO}>
            <ListaDocumentos
              etiqueta="Presupuestos por aprobar"
              vacio="No tienes presupuestos pendientes. Cuando te enviemos uno, aparecera aqui."
              filas={porAprobar.map((p) => ({
                id: p.id,
                href: rutaMiPresupuesto(p.id),
                numero: numeroDe("presupuesto", p.numero),
                titulo: p.titulo,
                detalle: `Vale hasta el ${fechaDia(p.validoHasta)}`,
                situacion: situacionDe(p.estado, p.vencido),
                total: p.total,
              }))}
            />
          </div>
        </section>

        <section aria-labelledby="titulo-proformas" className="surge [--retraso:0.06s]">
          <h2 id="titulo-proformas" className="mb-3 text-[19px] font-extrabold tracking-[-0.02em]">
            Proformas
          </h2>
          <div className={SECCION_DOCUMENTO}>
            <ListaDocumentos
              etiqueta="Proformas"
              vacio="Todavia no hay proformas. Salen de los presupuestos que apruebas."
              filas={proformas.map((p) => ({
                id: p.id,
                href: rutaMiProforma(p.id),
                numero: numeroDe("proforma", p.numero),
                titulo: p.titulo,
                detalle: `Emitida el ${fechaHora(p.emitidaEn)}`,
                situacion: p.estado,
                total: p.total,
              }))}
            />
          </div>
        </section>

        <section aria-labelledby="titulo-historial" className="surge [--retraso:0.1s] lg:col-span-2">
          <h2 id="titulo-historial" className="mb-3 text-[19px] font-extrabold tracking-[-0.02em]">
            Presupuestos anteriores
          </h2>
          <div className={SECCION_DOCUMENTO}>
            <ListaDocumentos
              etiqueta="Presupuestos anteriores"
              vacio="Aqui quedaran los presupuestos que apruebes o rechaces."
              filas={historial.map((p) => ({
                id: p.id,
                href: rutaMiPresupuesto(p.id),
                numero: numeroDe("presupuesto", p.numero),
                titulo: p.titulo,
                detalle: p.resueltoEn
                  ? `${p.estado === "aprobado" ? "Aprobado" : "Rechazado"} el ${fechaHora(p.resueltoEn)}`
                  : `Vencio el ${fechaDia(p.validoHasta)}`,
                situacion: situacionDe(p.estado, p.vencido),
                total: p.total,
              }))}
            />
          </div>
        </section>
      </div>
    </Wrapper>
  );
}
