import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import {
  DatosFiscales,
  FormularioAjustes,
  FormularioNumeracion,
  MediosPago,
  TasaDolar,
} from "@/components/ajustesFinanzas";
import { SECCION_DOCUMENTO } from "@/components/finanzas";
import { Wrapper } from "@/components/layout/Wrapper";
import { Etiqueta } from "@/components/ui";
import { conSesion } from "@/lib/db";
import { quedaPocoTalonario } from "@/lib/finanzas/ajustes";
import { cuandoEs, situacionTasa } from "@/lib/finanzas/programacionTasa";
import { rutaFormatoImpresion } from "@/lib/finanzas/rutas";
import { hoyEnCaracas } from "@/lib/portal/fases";
import { requerirFinanzas } from "@/lib/sesion";
import * as ajustesModelo from "@/models/ajustesFinanzas";
import * as empresasModelo from "@/models/empresas";
import * as tasasModelo from "@/models/tasas";

export const metadata: Metadata = {
  title: "Ajustes de finanzas",
};

const MIGAS = [{ texto: "Conejo App", href: "/dashboard" }, { texto: "Ajustes de finanzas" }];

/**
 * Lo que se configura una vez para facturar: quien emite, los impuestos, la
 * numeracion del talonario, los medios de pago y los formatos de impresion.
 * Casi todo nace de ejemplo (docs/pendientes.md) y se cambia aqui.
 */

function Seccion({
  id,
  titulo,
  descripcion,
  retraso,
  children,
}: {
  id: string;
  titulo: string;
  descripcion: string;
  retraso: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="surge" style={{ "--retraso": retraso } as React.CSSProperties}>
      <h2 id={id} className="text-[19px] font-extrabold tracking-[-0.02em]">
        {titulo}
      </h2>
      <p className="mt-1 mb-3 text-[13px] text-suave">{descripcion}</p>
      <div className={SECCION_DOCUMENTO}>{children}</div>
    </section>
  );
}

export default async function PaginaAjustesFinanzas() {
  const usuario = await requerirFinanzas();

  const { ajustes, numeracion, medios, formatos, fiscales, tasas, lecturas } = await conSesion(usuario, async (tx) => ({
    ajustes: await ajustesModelo.leer(tx),
    numeracion: await ajustesModelo.numeracion(tx),
    medios: await ajustesModelo.medios(tx),
    formatos: await ajustesModelo.formatos(tx),
    fiscales: await empresasModelo.datosFiscales(tx),
    tasas: await tasasModelo.recientes("bcv", "USD", 8, tx),
    lecturas: await tasasModelo.ultimasLecturas(5, tx),
  }));

  // Lo que depende de la hora se escribe aqui, una vez: servidor y navegador
  // no tienen por que estar en el mismo minuto.
  const ahora = new Date();
  const situacion = situacionTasa(lecturas, ahora);
  const lecturasParaMostrar = lecturas.map((lectura) => ({
    id: lectura.id,
    cuando: cuandoEs(lectura.leidaEn, ahora),
    resultado: lectura.resultado,
    fechaValor: lectura.fechaValor,
    motivo: lectura.motivo,
  }));

  if (!ajustes || !numeracion) throw new Error("Faltan los ajustes de finanzas: aplica el esquema");

  return (
    <Wrapper
      migas={MIGAS}
      kicker="Finanzas"
      titulo="Ajustes de finanzas"
      descripcion="Lo que se configura una vez para facturar. Cambiarlo no toca las facturas ya emitidas: cada una guarda su copia."
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-8">
          <Seccion
            id="titulo-emisor"
            titulo="Emisor e impuestos"
            descripcion="Lo que se imprime como datos de la agencia, y como se calculan los impuestos."
            retraso="0.04s"
          >
            <FormularioAjustes ajustes={ajustes} />
          </Seccion>

          <Seccion
            id="titulo-tasa"
            titulo="Tasa del dolar"
            descripcion="La app la lee del BCV una vez al dia. Aqui se ve si ya lo hizo; si fallo, se registra a mano: sin tasa no se puede facturar."
            retraso="0.1s"
          >
            <TasaDolar
              recientes={tasas}
              hoy={hoyEnCaracas(ahora)}
              situacion={situacion}
              lecturas={lecturasParaMostrar}
            />
          </Seccion>
        </div>

        <div className="flex flex-col gap-8">
          <Seccion
            id="titulo-numeracion"
            titulo="Numeracion"
            descripcion="La serie, el proximo numero de factura y el rango de numeros de control del talonario."
            retraso="0.08s"
          >
            <FormularioNumeracion numeracion={numeracion} quedan={quedaPocoTalonario(numeracion)} />
          </Seccion>

          <Seccion
            id="titulo-formatos"
            titulo="Formatos de impresion"
            descripcion="Donde va cada dato en la hoja. El habitual es el que se usa por defecto al imprimir."
            retraso="0.12s"
          >
            <ul aria-label="Formatos de impresion" className="-my-1 flex flex-col">
              {formatos.map((formato) => (
                <li key={formato.id} className="border-b border-borde last:border-0">
                  <Link
                    href={rutaFormatoImpresion(formato.id)}
                    className="suave -mx-2 flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-acento-tenue"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-bold">{formato.nombre}</p>
                      <p className="mt-0.5 text-[12px] text-suave">
                        {formato.anchoMm} × {formato.altoMm} mm · hasta {formato.renglones.max} renglones
                      </p>
                    </div>
                    {formato.habitual && <Etiqueta variante="solida">Habitual</Etiqueta>}
                    {!formato.activo && <Etiqueta>Inactivo</Etiqueta>}
                    <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-suave" />
                  </Link>
                </li>
              ))}
            </ul>
          </Seccion>
        </div>
      </div>

      <div className="mt-8">
        <Seccion
          id="titulo-medios"
          titulo="Medios de pago"
          descripcion="Como pueden pagar los clientes. Los activos los ven al reportar un pago, con sus datos para pagar. No se borran: se desactivan."
          retraso="0.16s"
        >
          <MediosPago medios={medios} />
        </Seccion>
      </div>

      <div className="mt-8">
        <Seccion
          id="titulo-fiscales"
          titulo="Datos de facturacion de las empresas"
          descripcion="Si una empresa es agente de retencion, la factura calcula sola la retencion de IVA esperada. Sin dias de credito propios, usa los de arriba."
          retraso="0.2s"
        >
          <DatosFiscales empresas={fiscales} diasPorDefecto={ajustes.diasCredito} />
        </Seccion>
      </div>
    </Wrapper>
  );
}
