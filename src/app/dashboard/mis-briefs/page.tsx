import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FilePlus2 } from "lucide-react";

import { diaBrief, EtiquetaBrief } from "@/components/briefs";
import { ElegirFormatoBrief } from "@/components/briefs/AccionesMisBriefs";
import { Wrapper } from "@/components/layout/Wrapper";
import { Listado } from "@/components/listado";
import { ModalConfirmacion } from "@/components/listado/ModalConfirmacion";
import { conSesion } from "@/lib/db";
import { leerEstadoListado } from "@/lib/parametros";
import { formatoPor, formatosVigentes } from "@/lib/portal/briefs";
import { rutaMiBrief } from "@/lib/portal/rutas";
import { requerirEmpresa } from "@/lib/sesion";
import { conPanel } from "@/lib/urlListado";
import * as briefsModelo from "@/models/briefs";
import {
  NOMBRES_DE_ESTADO_BRIEF,
  type Brief,
  type Columna,
  type DefinicionFiltro,
  type EstadoBrief,
} from "@/types";

export const metadata: Metadata = {
  title: "Mis briefs",
};

const RUTA = "/dashboard/mis-briefs";

const MIGAS = [{ texto: "Conejo App", href: "/dashboard" }, { texto: "Mis briefs" }];

const ESTADOS = Object.keys(NOMBRES_DE_ESTADO_BRIEF) as EstadoBrief[];

const ORDEN_PERMITIDO = ["movimiento", "creado"] as const;

/** Solo para ordenar: el listado se pinta en filas propias. */
const COLUMNAS: Columna<Brief>[] = [
  { clave: "movimiento", titulo: "Ultimo movimiento", ordenable: true, render: () => null },
  { clave: "creado", titulo: "Creado", ordenable: true, render: () => null },
];

const FILTROS: DefinicionFiltro[] = [
  {
    clave: "estado",
    titulo: "Estado",
    opciones: ESTADOS.map((estado) => ({ valor: estado, texto: NOMBRES_DE_ESTADO_BRIEF[estado] })),
  },
];

/** Una fila: el codigo, el tipo de trabajo, su fecha y en que punto esta. */
function FilaMiBrief({ brief }: { brief: Brief }) {
  return (
    <Link
      href={rutaMiBrief(brief.id)}
      className="suave group -mx-2 flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-acento-tenue"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] font-semibold tabular-nums text-suave">
          {brief.codigo ?? "Sin enviar"}
          {brief.versionActual > 1 ? ` · version ${brief.versionActual}` : ""}
        </p>
        <p className="truncate text-[14px] font-semibold">
          {formatoPor(brief.formato, brief.formatoVersion)?.nombre ?? brief.formato}
        </p>
        <p className="mt-0.5 text-[12px] text-suave">
          {brief.fechaPropuesta
            ? `Te proponemos el ${diaBrief(brief.fechaPropuesta)}`
            : brief.fechaAspirada
              ? `Aspiras al ${diaBrief(brief.fechaAspirada)}`
              : "Borrador: aun no tiene fecha"}
        </p>
      </div>
      <EtiquetaBrief estado={brief.estado} />
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-suave" />
    </Link>
  );
}

/**
 * Lo que la empresa le pide a la agencia por escrito. Cualquier persona de la
 * empresa empieza un brief, lo llena —entre varias si hace falta— y lo
 * envia; aqui ve en que punto esta cada uno, en el listado estandar. Un brief
 * nuevo se empieza desde «Nuevo brief», que abre la ventana para elegir el
 * formato y confirmar (`?panel=nuevo`).
 */
export default async function PaginaMisBriefs(props: PageProps<"/dashboard/mis-briefs">) {
  const { usuario } = await requerirEmpresa();
  const estado = leerEstadoListado(await props.searchParams, {
    ordenPermitido: ORDEN_PERMITIDO,
    ordenPorDefecto: "movimiento",
    direccionPorDefecto: "desc",
    filtrosPermitidos: ["estado"],
  });

  // Los de una empresa son pocos: se buscan, filtran y ordenan aqui.
  const lista = await conSesion(usuario, (tx) => briefsModelo.listar({}, tx));
  const termino = estado.busqueda.toLowerCase();
  const estados = (estado.filtros.estado ?? []).filter((v): v is EstadoBrief => (ESTADOS as string[]).includes(v));
  const signo = estado.direccion === "asc" ? 1 : -1;
  const filtrados = lista
    .filter((brief) => {
      const nombre = formatoPor(brief.formato, brief.formatoVersion)?.nombre ?? brief.formato;
      return !termino || `${brief.codigo ?? ""} ${nombre}`.toLowerCase().includes(termino);
    })
    .filter((brief) => estados.length === 0 || estados.includes(brief.estado))
    .sort((a, b) => {
      const x = (estado.orden === "creado" ? a.creadoEn : a.actualizadoEn).getTime();
      const y = (estado.orden === "creado" ? b.creadoEn : b.actualizadoEn).getTime();
      return (x - y) * signo;
    });
  const visibles = filtrados.slice((estado.pagina - 1) * estado.porPagina, estado.pagina * estado.porPagina);

  const formatos = formatosVigentes().map((f) => ({
    clave: f.clave,
    nombre: f.nombre,
    lema: f.lema ?? null,
    minutos: f.tiempoEstimadoMinutos,
  }));
  const hrefCerrar = conPanel(RUTA, estado, null);

  return (
    <Wrapper
      migas={MIGAS}
      kicker={usuario.empresaNombre ?? "Tu empresa"}
      titulo="Mis briefs"
      descripcion="Cuentanos que necesitas. Lo recibe tu ejecutivo y te responde con el siguiente paso."
    >
      <Listado
        ruta={RUTA}
        estado={estado}
        columnas={COLUMNAS}
        filas={visibles}
        total={filtrados.length}
        totalPaginas={Math.max(1, Math.ceil(filtrados.length / estado.porPagina))}
        filtros={FILTROS}
        accion={{ texto: "Nuevo brief", href: conPanel(RUTA, estado, "nuevo"), icono: <FilePlus2 aria-hidden="true" /> }}
        marcadorBusqueda="Codigo o tipo de trabajo"
        etiquetaBusqueda="Buscar briefs"
        claveFila={(brief) => brief.id}
        titulo="Tus briefs"
        lista={(brief) => <FilaMiBrief brief={brief} />}
        vacio={
          <p className="px-5 py-8 text-center text-[13px] text-suave">
            Todavia no hay briefs. Empieza uno con «Nuevo brief».
          </p>
        }
      />

      {estado.panel === "nuevo" && (
        <ModalConfirmacion
          hrefCerrar={hrefCerrar}
          kicker={usuario.empresaNombre ?? "Tu empresa"}
          titulo="Nuevo brief"
          ancho="amplio"
        >
          <ElegirFormatoBrief formatos={formatos} hrefCerrar={hrefCerrar} />
        </ModalConfirmacion>
      )}
    </Wrapper>
  );
}
