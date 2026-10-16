import { ExternalLink, Pencil, Users } from "lucide-react";
import type { ReactNode } from "react";

import { PanelCuerpo, PanelPie, SeparadorPanel } from "@/components/listado";
import { BotonCopiar, BotonEnlace, Estado, Etiqueta } from "@/components/ui";
import { ENLACES_EMPRESA } from "@/lib/validaciones";
import type { Asignacion, Empresa, EstadoFicha, PersonaBreve } from "@/types";
import { EjecutivosEmpresa } from "./EjecutivosEmpresa";
import { ZONA_HORARIA } from "@/lib/fechas";

/**
 * La ficha de una empresa en modo lectura, dentro del panel lateral.
 *
 * Es la unica pantalla donde se ve una cuenta ENTERA: quien es, como se le
 * escribe, donde publica y cuanto trabajo lleva hecho con ella. El listado
 * muestra seis columnas y con eso no se prepara una reunion.
 */

const FORMATO = new Intl.DateTimeFormat("es-VE", { timeZone: ZONA_HORARIA, dateStyle: "long" });

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

/**
 * Un dato que puede faltar. Se dice que falta, no se deja el hueco mudo. Con
 * `que`, lleva al lado su boton de copiar.
 */
function Texto({ valor, que }: { valor: string | null; que?: string }) {
  if (!valor) {
    return <span className="text-[12.5px] text-suave italic">Sin escribir</span>;
  }

  if (!que) return <>{valor}</>;

  return (
    <span className="inline-flex max-w-full items-start gap-1.5">
      <span className="min-w-0">{valor}</span>
      <BotonCopiar texto={valor} que={que} className="-my-1" />
    </span>
  );
}

function Cifra({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="rounded-xl bg-campo px-3.5 py-3">
      <p className="text-[10.5px] font-bold tracking-[0.08em] text-suave uppercase">
        {rotulo}
      </p>
      <p className="mt-1 text-[19px] font-extrabold tracking-[-0.025em]">{valor}</p>
    </div>
  );
}

export function DetalleEmpresa({
  empresa,
  contactos,
  piezas,
  asignados,
  candidatos,
  hrefEditar,
  hrefContactos,
  hrefCerrar,
}: {
  empresa: Empresa;
  /** Los ejecutivos que la atienden. */
  asignados: Asignacion[];
  /** Los ejecutivos de cuentas que se le pueden asignar. */
  candidatos: PersonaBreve[];
  /** Personas de contacto activas de esta cuenta. */
  contactos: number;
  /** Sus piezas, repartidas por estado. */
  piezas: Record<EstadoFicha, number>;
  hrefEditar: string;
  /** El listado de usuarios, ya filtrado por esta empresa. */
  hrefContactos: string;
  hrefCerrar: string;
}) {
  const enlaces = ENLACES_EMPRESA.map(({ clave, rotulo }) => ({
    rotulo,
    url: empresa[clave],
  })).filter((enlace) => enlace.url !== null);

  const total = piezas.borrador + piezas.auditada + piezas.medida;

  return (
    <>
      <PanelCuerpo>
        <p className="flex items-start gap-1.5 text-[19px] leading-snug font-bold tracking-[-0.022em]">
          <span className="min-w-0">{empresa.nombre}</span>
          <BotonCopiar texto={empresa.nombre} que="el nombre" className="mt-0.5" />
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Estado activo={empresa.activo} />

          {empresa.sector && <Etiqueta variante="contorno">{empresa.sector}</Etiqueta>}

          <span className="text-[12px] text-suave">
            Cliente desde {FORMATO.format(empresa.creadoEn)}
          </span>
        </div>

        {!empresa.activo && (
          <p className="mt-3.5 rounded-xl border border-borde bg-campo px-4 py-3.5 text-[12.5px] leading-relaxed text-suave">
            Esta cuenta esta desactivada: no aparece al escribir hooks ni al dar
            de alta usuarios. Lo que ya existe —sus piezas y sus contactos— se
            conserva tal cual.
          </p>
        )}

        <SeparadorPanel>Quien es</SeparadorPanel>

        <dl>
          <Dato rotulo="RIF">
            <Texto valor={empresa.rif} que="el RIF" />
          </Dato>
          <Dato rotulo="Sector">
            {empresa.sector ? (
              <>
                {empresa.sector}
                <span className="block text-[11.5px] text-suave">
                  Decide que regla del auditor le aplica cuando no tiene una propia
                </span>
              </>
            ) : (
              <>
                <span className="text-[12.5px] text-suave italic">Sin escribir</span>
                <span className="block text-[11.5px] text-suave">
                  Sin sector, el auditor salta directo al estandar de la casa
                </span>
              </>
            )}
          </Dato>
          <Dato rotulo="Telefono">
            <Texto valor={empresa.telefono} que="el telefono" />
          </Dato>
          <Dato rotulo="Direccion">
            <Texto valor={empresa.direccion} que="la direccion" />
          </Dato>
        </dl>

        <SeparadorPanel>Quien la atiende</SeparadorPanel>

        <EjecutivosEmpresa
          empresaId={empresa.id}
          activa={empresa.activo}
          asignados={asignados}
          candidatos={candidatos}
        />

        <SeparadorPanel>Donde publica</SeparadorPanel>

        {enlaces.length === 0 ? (
          <p className="rounded-xl border border-borde bg-campo px-4 py-3.5 text-[12.5px] leading-relaxed text-suave">
            Todavia sin enlaces. Son utiles para mirar que esta publicando la
            cuenta antes de escribirle una pieza.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {enlaces.map(({ rotulo, url }) => (
              <li key={rotulo} className="flex items-center gap-1.5">
                {/*
                  `noreferrer noopener` porque son enlaces a sitios de fuera, y
                  `target="_blank"` para no perder la ficha que se esta mirando.
                */}
                <a
                  href={url ?? "#"}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="suave grid min-w-0 flex-1 grid-cols-[minmax(0,110px)_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-borde px-3.5 py-2.5 hover:border-acento hover:bg-acento-tenue"
                >
                  <span className="text-[11.5px] font-bold text-suave">{rotulo}</span>
                  <span className="truncate text-[12.5px] text-acento">{url}</span>
                  <ExternalLink aria-hidden="true" className="size-4 shrink-0 text-suave" />
                </a>
                {url && <BotonCopiar texto={url} que={`el enlace de ${rotulo}`} />}
              </li>
            ))}
          </ul>
        )}

        <SeparadorPanel>Cuanto se ha trabajado</SeparadorPanel>

        {total === 0 ? (
          <p className="rounded-xl border border-borde bg-campo px-4 py-3.5 text-[12.5px] leading-relaxed text-suave">
            Todavia no hay ninguna pieza escrita para esta cuenta.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            <Cifra rotulo="Borradores" valor={piezas.borrador} />
            <Cifra rotulo="Auditadas" valor={piezas.auditada} />
            <Cifra rotulo="Medidas" valor={piezas.medida} />
          </div>
        )}

        <div className="mt-3.5">
          <BotonEnlace
            href={hrefContactos}
            variante="fantasma"
            tamano="chico"
            scroll
          >
            <Users aria-hidden="true" />
            {contactos === 0
              ? "No tiene personas de contacto"
              : `Ver sus ${contactos} ${contactos === 1 ? "persona" : "personas"} de contacto`}
          </BotonEnlace>
        </div>
      </PanelCuerpo>

      <PanelPie>
        <BotonEnlace href={hrefCerrar} variante="fantasma">
          Cerrar
        </BotonEnlace>

        <BotonEnlace href={hrefEditar}>
          <Pencil aria-hidden="true" />
          Editar
        </BotonEnlace>
      </PanelPie>
    </>
  );
}
