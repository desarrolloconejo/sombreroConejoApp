import { Pencil } from "lucide-react";
import type { ReactNode } from "react";

import { PanelCuerpo, PanelPie, SeparadorPanel } from "@/components/listado";
import { BotonEnlace, Etiqueta } from "@/components/ui";
import { ESTANDAR_INSERT, ESTANDAR_VOZ } from "@/lib/hooks/listas";
import type { Empresa, ReglaHook } from "@/types";
import { ZONA_HORARIA } from "@/lib/fechas";

/**
 * Ficha detallada de una regla (modo "Ver más"), dentro del panel lateral.
 *
 * Muestra todos los límites, preámbulos vetados, fórmulas gastadas y términos
 * de tensión configurados para una cuenta o sector, permitiendo pasar a
 * edición mediante el botón del pie.
 */

const FORMATO = new Intl.DateTimeFormat("es-VE", {
  timeZone: ZONA_HORARIA,
  dateStyle: "long",
  timeStyle: "short",
});

function Dato({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,120px)_minmax(0,1fr)] items-baseline gap-4 border-b border-borde py-[11px] last:border-b-0">
      <dt className="text-[10.5px] font-bold tracking-[0.08em] text-suave uppercase">
        {rotulo}
      </dt>
      <dd className="min-w-0 text-[13px] break-words">{children ?? "—"}</dd>
    </div>
  );
}

function ListaTerminos({ items, vacio }: { items: string[]; vacio: string }) {
  if (items.length === 0) {
    return <span className="text-[12.5px] text-suave italic">{vacio}</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {items.map((item, idx) => (
        <span
          key={idx}
          className="rounded-lg border border-borde bg-campo px-2.5 py-1 text-[12px] font-medium text-texto"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export function DetalleRegla({
  regla,
  empresas,
  hrefEditar,
  hrefCerrar,
}: {
  regla: ReglaHook;
  empresas: Empresa[];
  hrefEditar: string;
  hrefCerrar: string;
}) {
  const ampliada =
    regla.maxPalabrasVoz > ESTANDAR_VOZ ||
    regla.maxPalabrasInsert > ESTANDAR_INSERT;

  const empresa = regla.empresaId
    ? empresas.find((e) => e.id === regla.empresaId)
    : null;

  return (
    <>
      <PanelCuerpo>
        <div className="rounded-[13px] border border-borde bg-campo p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[16px] font-bold">{regla.etiqueta}</p>
              <p className="mt-0.5 text-[12px] text-suave">
                {regla.empresaId ? "Regla personalizada de cliente" : "Regla por sector"}
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Etiqueta variante={regla.empresaId ? "solida" : "contorno"}>
                {regla.empresaId ? "Cliente" : "Sector"}
              </Etiqueta>
              {ampliada && (
                <span className="rounded-md bg-acento px-2 py-0.5 text-[10px] font-extrabold tracking-[0.06em] text-acento-contraste uppercase">
                  Ampliado
                </span>
              )}
            </div>
          </div>
        </div>

        <SeparadorPanel>Ámbito y aplicación</SeparadorPanel>

        <dl className="mt-1">
          <Dato rotulo="Tipo de regla">
            {regla.empresaId ? "Específica para un cliente" : "General por sector"}
          </Dato>

          {regla.empresaId ? (
            <Dato rotulo="Cliente">{empresa?.nombre ?? `Empresa #${regla.empresaId}`}</Dato>
          ) : (
            <Dato rotulo="Sector">{regla.sector ?? "—"}</Dato>
          )}

          <Dato rotulo="Prioridad">
            {regla.empresaId ? "1. Gana sobre el sector y la casa" : "2. Gana sobre el estándar de la casa"}
          </Dato>
        </dl>

        <SeparadorPanel>Límites de auditoría</SeparadorPanel>

        <dl className="mt-1">
          <Dato rotulo="Máx. voz">
            <span className="font-semibold text-texto">
              ≤ {regla.maxPalabrasVoz} palabras
            </span>
            {regla.maxPalabrasVoz > ESTANDAR_VOZ && (
              <span className="ml-2 text-[11.5px] text-acento">
                (Estándar agencia: ≤ {ESTANDAR_VOZ})
              </span>
            )}
          </Dato>

          <Dato rotulo="Máx. insert">
            <span className="font-semibold text-texto">
              ≤ {regla.maxPalabrasInsert} palabras
            </span>
            {regla.maxPalabrasInsert > ESTANDAR_INSERT && (
              <span className="ml-2 text-[11.5px] text-acento">
                (Estándar agencia: ≤ {ESTANDAR_INSERT})
              </span>
            )}
          </Dato>

          <Dato rotulo="Prueba visible">
            {regla.exigirPrueba ? (
              <span className="font-semibold text-acento">
                Requerida · exige plano o recurso visual
              </span>
            ) : (
              <span className="text-suave">Opcional</span>
            )}
          </Dato>
        </dl>

        <SeparadorPanel>Vocabulario y vetos propios</SeparadorPanel>

        <div className="space-y-3.5 pt-1">
          <div>
            <p className="mb-1.5 text-[11px] font-bold tracking-[0.06em] text-suave uppercase">
              Preámbulos vetados adicionales
            </p>
            <ListaTerminos
              items={regla.preambulos}
              vacio="Ninguno propio (aplica la lista estándar de la casa)"
            />
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-bold tracking-[0.06em] text-suave uppercase">
              Fórmulas gastadas vetadas
            </p>
            <ListaTerminos
              items={regla.formulasGastadas}
              vacio="Ninguna propia (aplica la lista estándar de la casa)"
            />
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-bold tracking-[0.06em] text-suave uppercase">
              Términos de tensión autorizados
            </p>
            <ListaTerminos
              items={regla.terminosTension}
              vacio="Ninguno adicional (aplica el banco general de tensión)"
            />
          </div>
        </div>

        <SeparadorPanel>Registro</SeparadorPanel>

        <dl className="mt-1">
          <Dato rotulo="Creada">{FORMATO.format(new Date(regla.creadoEn))}</Dato>
          {regla.actualizadoEn && (
            <Dato rotulo="Actualizada">
              {FORMATO.format(new Date(regla.actualizadoEn))}
            </Dato>
          )}
        </dl>
      </PanelCuerpo>

      <PanelPie>
        <BotonEnlace href={hrefCerrar} variante="fantasma">
          Cerrar
        </BotonEnlace>

        <BotonEnlace href={hrefEditar}>
          <Pencil aria-hidden="true" />
          Editar regla
        </BotonEnlace>
      </PanelPie>
    </>
  );
}
