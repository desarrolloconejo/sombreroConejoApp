import { Pencil } from "lucide-react";
import type { ReactNode } from "react";

import { PanelCuerpo, PanelPie } from "@/components/listado";

import { RetirarDosPasos } from "./RetirarDosPasos";
import { Avatar, BotonCopiar, BotonEnlace, Estado, Etiqueta } from "@/components/ui";
import type { NombreRol, UsuarioCompleto } from "@/types";
import { ZONA_HORARIA } from "@/lib/fechas";

/**
 * La ficha de una cuenta, dentro del panel lateral.
 *
 * De servidor entero: aqui no se toca nada, solo se lee. La fecha se formatea
 * en el servidor a proposito, para que el idioma del navegador no produzca un
 * texto distinto del que se pinto y React marque un desajuste al hidratar.
 *
 * Existe porque la tabla no puede con todo: en el listado caben cinco columnas
 * y esta cuenta tiene el doble de datos. Antes que apretar la tabla, la fila
 * resume y la ficha desarrolla.
 */

const FORMATO = new Intl.DateTimeFormat("es-VE", {
  timeZone: ZONA_HORARIA,
  dateStyle: "long",
  timeStyle: "short",
});

const FORMATO_CORTO = new Intl.DateTimeFormat("es-VE", { timeZone: ZONA_HORARIA, dateStyle: "long" });

const NOMBRE_ROL: Record<NombreRol, string> = {
  admin: "Admin",
  trabajador: "Trabajador",
  cliente: "Cliente",
};

/** Una fila de la ficha. El guion largo dice "esto esta vacio", no "cero". */
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

export function DetalleUsuario({
  usuario,
  dosPasos,
  hrefEditar,
  hrefCerrar,
}: {
  usuario: UsuarioCompleto;

  /** Si esta persona tiene activada la verificacion en dos pasos. */
  dosPasos: boolean;
  hrefEditar: string;
  hrefCerrar: string;
}) {
  const esTrabajador = usuario.tipo === "trabajador";

  return (
    <>
      <PanelCuerpo>
        <div className="flex items-center gap-3.5 rounded-[13px] border border-borde bg-campo px-4 py-3.5">
          <Avatar
            nombre={usuario.nombre}
            apellido={usuario.apellido}
            fotoUrl={usuario.fotoUrl}
            tamano="normal"
          />

          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold">
              {usuario.nombre} {usuario.apellido}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-[12px] text-suave">
              <span className="min-w-0 truncate">{usuario.email}</span>
              <BotonCopiar texto={usuario.email} que="el correo" className="-my-1" />
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Etiqueta variante={usuario.rol === "admin" ? "solida" : "contorno"}>
                {NOMBRE_ROL[usuario.rol]}
              </Etiqueta>
              <Estado activo={usuario.activo} />
            </div>
          </div>
        </div>

        <dl className="mt-[18px]">
          <Dato rotulo="Tipo">
            {esTrabajador ? "Trabajador de la agencia" : "Cliente"}
          </Dato>

          {esTrabajador ? (
            <Dato rotulo="Area">{usuario.cargo}</Dato>
          ) : (
            <>
              <Dato rotulo="Empresa">
                {usuario.empresaNombre}
                {/*
                  Que la empresa este desactivada explica cosas raras, como que
                  esta persona no vea nada. Vale la pena decirlo aqui.
                */}
                {usuario.empresaNombre && usuario.empresaActiva === false && (
                  <span className="mt-1 block text-[11.5px] text-blackberry dark-tema:text-[#e9a9cd]">
                    La empresa esta desactivada
                  </span>
                )}
              </Dato>
              <Dato rotulo="Cargo">{usuario.cargo}</Dato>
              <Dato rotulo="Revision">
                {usuario.puedeAprobar
                  ? "Puede aprobar piezas o pedir correcciones"
                  : "Ve el avance, pero no decide"}
              </Dato>
              <Dato rotulo="Finanzas">
                {usuario.puedeVerFinanzas
                  ? "Ve presupuestos y proformas, y aprueba presupuestos"
                  : "No ve importes"}
              </Dato>
            </>
          )}

          <Dato rotulo="Telefono">
            {usuario.telefono && (
              <span className="inline-flex items-start gap-1.5">
                {usuario.telefono}
                <BotonCopiar texto={usuario.telefono} que="el telefono" className="-my-1" />
              </span>
            )}
          </Dato>

          {esTrabajador && usuario.fechaIngreso && (
            <Dato rotulo="Ingreso">
              {FORMATO_CORTO.format(new Date(usuario.fechaIngreso))}
            </Dato>
          )}

          <Dato rotulo="Ultimo acceso">
            {usuario.ultimoAcceso
              ? FORMATO.format(new Date(usuario.ultimoAcceso))
              : "Todavia no ha entrado"}
          </Dato>

          <Dato rotulo="Creada">
            {FORMATO.format(new Date(usuario.creadoEn))}
          </Dato>
        </dl>
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-[13px] border border-borde bg-campo px-4 py-3.5">
          <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed">
            <b className="font-semibold">Verificacion en dos pasos:</b>{" "}
            {dosPasos ? "activada" : "sin activar"}.
            {dosPasos && (
              <span className="block text-suave">
                Si perdio el telefono y sus codigos de respaldo, retirasela para
                que pueda entrar. Se le pedira configurarla de nuevo.
              </span>
            )}
          </p>

          {dosPasos && <RetirarDosPasos id={usuario.id} nombre={usuario.nombre} />}
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
