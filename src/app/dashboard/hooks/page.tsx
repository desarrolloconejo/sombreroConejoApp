import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  ChartNoAxesColumn,
  Check,
  ChevronRight,
  FileText,
  History,
  Library,
  ShieldCheck,
} from "lucide-react";

import { Wrapper } from "@/components/layout/Wrapper";
import { PiezaEnCurso } from "@/components/hooks/PiezaEnCurso";
import { requerirCargo } from "@/lib/sesion";
import * as aperturasModelo from "@/models/aperturas";
import * as fichasModelo from "@/models/fichas";
import * as referenciasModelo from "@/models/referencias";
import * as reglasModelo from "@/models/reglasHook";

/**
 * La raiz del modulo: donde esta tu pieza, y el recorrido entero.
 *
 * No es un menu repetido del sidebar. Dice DONDE esta el trabajo: cuantas
 * piezas hay paradas en cada paso y cual es la que toca ahora. El sidebar
 * dice a donde se puede ir; esto dice a donde conviene ir.
 */

export const metadata: Metadata = {
  title: "Hooks",
};

const MIGAS = [{ texto: "Conejo App", href: "/dashboard" }, { texto: "Hooks" }];

export default async function PaginaHooks() {
  const usuario = await requerirCargo("redes");

  const [piezas, ultima, conteo, aperturas, reglas, referencias] = await Promise.all([
    // La portada responde "que estoy haciendo YO", asi que las tres van
    // filtradas por quien mira. El historial sigue siendo del equipo.
    fichasModelo.enCurso(usuario.id),
    fichasModelo.ultimaMedida(usuario.id),
    fichasModelo.contarPorEstado(usuario.id),
    aperturasModelo.contarActivas(),
    reglasModelo.listar(),
    referenciasModelo.contar(),
  ]);

  const total = conteo.borrador + conteo.auditada + conteo.medida;

  const pasos = [
    {
      numero: "01",
      titulo: "Manual",
      href: "/dashboard/hooks/manual",
      icono: BookOpen,
      texto: "El criterio de la casa: que abre atencion, que la cierra y por que.",
      cifra: "—",
      pie: "solo lectura",
    },
    {
      numero: "02",
      titulo: "Documentacion",
      href: "/dashboard/hooks/documentacion",
      icono: Library,
      texto:
        "Como habla esta marca y con que se puede escribir: reglas, aperturas y referencias.",
      cifra: String(aperturas),
      pie: `aperturas · ${reglas.length} ${reglas.length === 1 ? "regla" : "reglas"}`,
    },
    {
      numero: "03",
      titulo: "Hooks",
      href: "/dashboard/hooks/nuevo",
      icono: FileText,
      texto:
        "La decision completa. Sale una ficha que edicion ejecuta sin interpretar.",
      cifra: String(conteo.borrador),
      pie: conteo.borrador === 1 ? "borrador" : "borradores",
    },
    {
      numero: "04",
      titulo: "Auditor",
      href: "/dashboard/hooks/auditor",
      icono: ShieldCheck,
      texto:
        "Nueve controles antes de grabar y la lista de comprobacion. Umbral 70.",
      cifra: String(conteo.borrador),
      pie: "sin auditar",
    },
    {
      numero: "05",
      titulo: "Metricas",
      href: "/dashboard/hooks/metricas",
      icono: ChartNoAxesColumn,
      texto:
        "Lo que paso de verdad cuando se publico, y el aprendizaje de la pieza.",
      cifra: String(conteo.auditada),
      pie: "sin resultado",
    },
    {
      numero: "06",
      titulo: "Historial",
      href: "/dashboard/hooks/historial",
      icono: History,
      texto: "Todas las fichas y en que punto del recorrido esta cada una.",
      cifra: String(total),
      pie: total === 1 ? "ficha" : "fichas",
    },
  ];

  return (
    <Wrapper
      migas={MIGAS}
      kicker="Creacion de contenido"
      titulo="Hooks"
      descripcion="Decide el hook antes de grabar, auditalo antes de producir y registra lo que paso. Cada paso deja algo escrito para el siguiente."
    >
      <PiezaEnCurso piezas={piezas} ultima={ultima} />

      <div className="surge mt-5 overflow-hidden rounded-[15px] border border-borde bg-superficie shadow-[var(--sombra)] [--retraso:0.06s]">
        <div className="flex flex-wrap items-end justify-between gap-5 border-b border-borde px-5 py-4">
          <div>
            <p className="mb-1.5 text-[10.5px] font-bold tracking-[0.1em] text-suave uppercase">
              El recorrido
            </p>
            <p className="text-[18px] font-extrabold tracking-[-0.02em]">
              De saber como se habla a saber si funciono.
            </p>
          </div>
          <p className="text-[11.5px] font-medium text-suave">
            {referencias} {referencias === 1 ? "referencia" : "referencias"} en el
            banco
          </p>
        </div>

        <ul>
          {pasos.map((paso) => {
            const Icono = paso.icono;

            return (
              <li key={paso.href}>
                <Link
                  href={paso.href}
                  className="suave grid grid-cols-[36px_minmax(0,1fr)_auto_18px] items-center gap-[18px] border-b border-borde px-5 py-4 last:border-b-0 hover:bg-acento-tenue"
                >
                  <span className="grid size-9 place-items-center rounded-[11px] bg-acento-tenue text-[12.5px] font-extrabold text-acento">
                    {paso.numero}
                  </span>

                  <span className="min-w-0">
                    <span className="mb-[3px] flex items-center gap-2 text-[15px] font-bold tracking-[-0.012em]">
                      <Icono aria-hidden="true" className="size-4 shrink-0 text-suave" />
                      {paso.titulo}
                    </span>
                    <span className="block text-[12.5px] leading-relaxed text-suave">
                      {paso.texto}
                    </span>
                  </span>

                  <span className="text-right">
                    <b className="block text-[19px] font-extrabold tracking-[-0.025em]">
                      {paso.cifra}
                    </b>
                    <span className="mt-0.5 block text-[10.5px] text-suave">
                      {paso.pie}
                    </span>
                  </span>

                  <ChevronRight
                    aria-hidden="true"
                    className="size-[18px] justify-self-end text-suave"
                  />
                </Link>
              </li>
            );
          })}
        </ul>

        {/*
          El final del recorrido NO es la nota del auditor, y conviene decirlo
          donde se ve el recorrido entero: es la confusion mas facil de tener
          cuando la unica cifra grande del modulo es un score sobre 100.
        */}
        <div className="grid grid-cols-[36px_minmax(0,1fr)] items-center gap-[18px] border-t border-borde bg-acento-tenue p-5">
          <span className="grid size-9 place-items-center rounded-[11px] bg-acento text-acento-contraste">
            <Check aria-hidden="true" className="size-[19px]" strokeWidth={2.2} />
          </span>
          <div>
            <p className="mb-[3px] text-sm font-bold">
              Una pieza esta terminada cuando tiene sus metricas registradas.
            </p>
            <p className="text-[12.5px] leading-relaxed text-suave">
              La nota del auditor es un control por el camino, no la meta: un 88
              sin resultado real no ensena nada a la cuenta.
            </p>
          </div>
        </div>
      </div>
    </Wrapper>
  );
}
