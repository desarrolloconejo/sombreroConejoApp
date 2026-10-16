"use client";

import { useActionState, useState } from "react";
import { FilePlus2 } from "lucide-react";

import { crearPresupuesto } from "@/actions/presupuestos";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { PanelCuerpo, PanelPie, SeparadorPanel } from "@/components/listado";
import { Boton, BotonEnlace, Campo, CampoFecha, Selector, useCampos } from "@/components/ui";
import { ESTADO_INICIAL, type NombreEmpresa, type ProyectoDeProforma } from "@/types";

/**
 * El alta de un presupuesto, en el panel lateral.
 *
 * Solo la cabecera: para quien es, que se ofrece y hasta cuando vale. Los
 * renglones se escriben despues, en su editor, al que lleva la action.
 *
 * El proyecto es opcional (P1): un presupuesto puede ir antes que el
 * proyecto, o ser de algo que no es un proyecto. Los que se ofrecen dependen
 * de la empresa elegida.
 */
export function FormularioPresupuesto({
  empresas,
  proyectos,
  validoHasta,
  hrefCancelar,
}: {
  empresas: NombreEmpresa[];
  /** Los proyectos ligables de cada empresa, por id de empresa. */
  proyectos: Record<number, ProyectoDeProforma[]>;
  /** La validez por defecto: hoy mas quince dias (F6). */
  validoHasta: string;
  hrefCancelar: string;
}) {
  const [estado, enviar, enviando] = useActionState(crearPresupuesto, ESTADO_INICIAL);
  useAvisoDeAccion(estado);

  const errores = estado.errores ?? {};

  const [empresaId, setEmpresaId] = useState(empresas.length === 1 ? String(empresas[0].id) : "");
  const { campo, fecha } = useCampos({ titulo: "", validoHasta, notas: "" });

  const deLaEmpresa = empresaId ? (proyectos[Number(empresaId)] ?? []) : [];

  return (
    <form action={enviar} noValidate className="flex min-h-0 flex-1 flex-col">
      <PanelCuerpo>
        <SeparadorPanel>Para quien</SeparadorPanel>

        <div className="flex flex-col gap-3.5">
          <Selector
            id="presupuesto-empresa"
            nombre="empresaId"
            etiqueta="Empresa"
            marcador="Elige la empresa"
            opciones={empresas.map((e) => ({ valor: String(e.id), texto: e.nombre }))}
            valorInicial={empresaId}
            onCambio={setEmpresaId}
            error={errores.empresaId}
          />

          {/* La clave rehace el selector al cambiar de empresa: un proyecto de
              otra empresa no debe quedar elegido. */}
          <Selector
            key={empresaId}
            id="presupuesto-proyecto"
            nombre="proyectoId"
            etiqueta="Proyecto (opcional)"
            marcador={deLaEmpresa.length > 0 ? "Sin proyecto" : "La empresa no tiene proyectos"}
            opciones={[
              { valor: "", texto: "Sin proyecto" },
              ...deLaEmpresa.map((p) => ({ valor: String(p.id), texto: p.nombre })),
            ]}
            valorInicial=""
            deshabilitado={deLaEmpresa.length === 0}
            error={errores.proyectoId}
          />
        </div>

        <SeparadorPanel>El presupuesto</SeparadorPanel>

        <div className="flex flex-col gap-3.5">
          <Campo
            id="presupuesto-titulo"
            etiqueta="Titulo"
            maxLength={120}
            placeholder="Parrilla de redes de noviembre"
            error={errores.titulo}
            {...campo("titulo")}
          />

          <CampoFecha
            id="presupuesto-validez"
            etiqueta="Vale hasta"
            ayuda="Quince dias por defecto. Pasada la fecha, el cliente ya no puede aprobarlo."
            error={errores.validoHasta}
            {...fecha("validoHasta")}
          />

          <Campo
            id="presupuesto-notas"
            etiqueta="Notas para el cliente"
            opcional
            maxLength={1000}
            placeholder="Condiciones, plazos, lo que conviene saber"
            {...campo("notas")}
          />
        </div>
      </PanelCuerpo>

      <PanelPie>
        <BotonEnlace href={hrefCancelar} variante="fantasma">
          Cancelar
        </BotonEnlace>
        <Boton type="submit" disabled={enviando}>
          <FilePlus2 aria-hidden="true" />
          {enviando ? "Creando..." : "Crear y anadir renglones"}
        </Boton>
      </PanelPie>
    </form>
  );
}
