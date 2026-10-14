import type { ReactNode } from "react";

import { PanelCuerpo, SeparadorPanel } from "@/components/listado";
import type { LineaAuditoria, ValoresAuditoria } from "@/types";

import { nombreDeAccion, nombreDeActor } from "./ColumnasAuditoria";
import { ZONA_HORARIA } from "@/lib/fechas";

/**
 * El detalle de una linea: quien, cuando, desde donde, y el antes y el despues
 * campo por campo.
 *
 * Es de solo lectura. La auditoria no se edita ni se borra, asi que este panel
 * no tiene acciones.
 */

const CUANDO = new Intl.DateTimeFormat("es-VE", {
  timeZone: ZONA_HORARIA,
  dateStyle: "full",
  timeStyle: "medium",
});

function Dato({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,108px)_minmax(0,1fr)] items-baseline gap-4 border-b border-borde py-[11px] last:border-b-0">
      <dt className="text-[10.5px] font-bold tracking-[0.08em] text-suave uppercase">
        {rotulo}
      </dt>
      <dd className="min-w-0 text-[13px] break-words">{children ?? "—"}</dd>
    </div>
  );
}

/** Un valor guardado, dicho para una persona. */
function comoTexto(valor: ValoresAuditoria[string] | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "vacio";
  if (valor === true) return "si";
  if (valor === false) return "no";

  return String(valor);
}

/** `sesionesCerradas` → «sesiones cerradas». */
function comoRotulo(campo: string): string {
  return campo.replace(/([A-Z])/g, " $1").toLowerCase();
}

export function DetalleAuditoria({ linea }: { linea: LineaAuditoria }) {
  const antes = linea.antes ?? {};
  const despues = linea.despues ?? {};
  const campos = [...new Set([...Object.keys(antes), ...Object.keys(despues)])];

  // Un alta trae solo «despues»: no hay valor anterior con el que comparar.
  const hayAntes = Object.keys(antes).length > 0;

  return (
    <PanelCuerpo>
      <dl>
        <Dato rotulo="Que">{nombreDeAccion(linea.accion)}</Dato>
        <Dato rotulo="Quien">
          {nombreDeActor(linea)}
          {linea.actorEmail && (
            <span className="block text-[12px] text-suave">{linea.actorEmail}</span>
          )}
        </Dato>
        <Dato rotulo="Era entonces">
          {linea.actorRol
            ? [linea.actorRol, linea.actorCargo].filter(Boolean).join(" · ")
            : null}
        </Dato>
        <Dato rotulo="Cuando">{CUANDO.format(new Date(linea.creadoEn))}</Dato>
        <Dato rotulo="Desde">{linea.ip}</Dato>
        <Dato rotulo="Empresa">{linea.empresaNombre}</Dato>
        <Dato rotulo="Sobre">
          {linea.entidad
            ? `${linea.entidad}${linea.entidadId === null ? "" : ` nº ${linea.entidadId}`}`
            : null}
        </Dato>
      </dl>

      {campos.length > 0 && (
        <>
          <SeparadorPanel>{hayAntes ? "Que cambio" : "Datos"}</SeparadorPanel>

          <ul className="flex flex-col gap-2.5">
            {campos.map((campo) => (
              <li
                key={campo}
                className="rounded-[11px] border border-borde bg-campo px-3.5 py-3"
              >
                <p className="text-[10.5px] font-bold tracking-[0.08em] text-suave uppercase">
                  {comoRotulo(campo)}
                </p>

                {hayAntes && campo in antes ? (
                  <p className="mt-1.5 text-[13px] break-words">
                    <span className="text-suave line-through">
                      {comoTexto(antes[campo])}
                    </span>
                    <span aria-hidden="true" className="mx-2 text-suave">
                      →
                    </span>
                    <span className="sr-only"> pasa a </span>
                    <span className="font-semibold">{comoTexto(despues[campo])}</span>
                  </p>
                ) : (
                  <p className="mt-1.5 text-[13px] font-semibold break-words">
                    {comoTexto(despues[campo])}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </PanelCuerpo>
  );
}
