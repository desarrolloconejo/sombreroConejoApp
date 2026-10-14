import type { Metadata } from "next";

import { Wrapper } from "@/components/layout/Wrapper";
import {
  FiltrosDelTablero,
  TablaTablero,
  TarjetasAlerta,
  type FilaTablero,
  type FiltrosTablero,
} from "@/components/tablero";
import { conSesion } from "@/lib/db";
import { hoyEnCaracas } from "@/lib/portal/fases";
import { requerirCargo } from "@/lib/sesion";
import { comoIdentificador } from "@/lib/validaciones";
import * as proyectosModelo from "@/models/proyectos";
import type { AlertaPieza } from "@/types";

/**
 * El tablero de control: lo que esta en curso y que mirar primero.
 *
 * Lo ven el admin, con todos los proyectos, y cada ejecutivo de cuentas, con
 * los de sus empresas: la base devuelve solo lo que toca. Las cuatro alertas
 * cuentan piezas, no proyectos, y filtran la tabla al pulsarlas.
 */

export const metadata: Metadata = {
  title: "Tablero",
};

const RUTA = "/dashboard/tablero";

const MIGAS = [{ texto: "Conejo App", href: "/dashboard" }, { texto: "Tablero" }];

const ALERTAS: readonly AlertaPieza[] = [
  "atrasada",
  "por_vencer",
  "esperando_cliente",
  "en_correccion",
];

const FECHA_LARGA = new Intl.DateTimeFormat("es-VE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function primero(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

export default async function PaginaTablero(props: PageProps<"/dashboard/tablero">) {
  const usuario = await requerirCargo("cuentas");

  const parametros = await props.searchParams;

  const { proyectos, fases } = await conSesion(usuario, async (tx) => ({
    proyectos: await proyectosModelo.enCurso(tx),
    fases: await proyectosModelo.fasesMasAtrasadas(tx),
  }));

  // Las opciones salen de lo que hay: un id de la URL que no corresponde a
  // nada visible se ignora, en lugar de dejar el tablero vacio sin explicar.
  const ejecutivos = [
    ...new Map(proyectos.map((p) => [p.ejecutivoId, { id: p.ejecutivoId, nombre: p.ejecutivoNombre }])).values(),
  ].sort((a, b) => a.nombre.localeCompare(b.nombre));
  const empresas = [
    ...new Map(proyectos.map((p) => [p.empresaId, { id: p.empresaId, nombre: p.empresaNombre }])).values(),
  ].sort((a, b) => a.nombre.localeCompare(b.nombre));

  const ejecutivo = comoIdentificador(primero(parametros.ejecutivo));
  const empresa = comoIdentificador(primero(parametros.empresa));
  const tipo = primero(parametros.tipo);
  const alerta = primero(parametros.alerta);

  const filtros: FiltrosTablero = {
    ejecutivo: ejecutivos.some((p) => p.id === ejecutivo) ? ejecutivo : null,
    empresa: empresas.some((e) => e.id === empresa) ? empresa : null,
    tipo: tipo === "redes_sociales" || tipo === "especial" ? tipo : null,
    alerta: ALERTAS.find((a) => a === alerta) ?? null,
  };

  const filtrados = proyectos.filter(
    (p) =>
      (!filtros.ejecutivo || p.ejecutivoId === filtros.ejecutivo) &&
      (!filtros.empresa || p.empresaId === filtros.empresa) &&
      (!filtros.tipo || p.tipo === filtros.tipo),
  );

  // Los totales se cuentan antes del filtro de alerta: si no, al pulsar una
  // tarjeta las otras tres se irian a cero.
  const totales = Object.fromEntries(
    ALERTAS.map((a) => [a, filtrados.reduce((suma, p) => suma + p.alertas[a], 0)]),
  ) as Record<AlertaPieza, number>;

  const filas: FilaTablero[] = filtrados
    .filter((p) => !filtros.alerta || p.alertas[filtros.alerta] > 0)
    .map((p) => ({ ...p, fase: fases.get(p.id) ?? null }));

  const hoy = FECHA_LARGA.format(new Date(`${hoyEnCaracas()}T00:00:00Z`));

  return (
    <Wrapper
      migas={MIGAS}
      kicker="Trabajo"
      titulo="Tablero de control"
      descripcion={`${hoy.charAt(0).toUpperCase()}${hoy.slice(1)}. Lo que esta en curso, y que mirar primero.`}
    >
      <TarjetasAlerta ruta={RUTA} filtros={filtros} totales={totales} />

      <div className="surge mt-6 [--retraso:0.24s]">
        <FiltrosDelTablero ruta={RUTA} filtros={filtros} ejecutivos={ejecutivos} empresas={empresas} />
      </div>

      <h2 className="surge mt-6 mb-3 text-[19px] font-extrabold tracking-[-0.02em] [--retraso:0.28s]">
        Proyectos en curso
        <span className="ml-2 text-[13px] font-semibold text-suave tabular-nums">{filas.length}</span>
      </h2>

      <div className="surge [--retraso:0.32s]">
        <TablaTablero filas={filas} />
      </div>
    </Wrapper>
  );
}
