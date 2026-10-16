import type { Metadata } from "next";

import { Wrapper } from "@/components/layout/Wrapper";
import { ListaMiTrabajo } from "@/components/miTrabajo";
import { conSesion } from "@/lib/db";
import { hoyEnCaracas } from "@/lib/portal/fases";
import { requerirCargo } from "@/lib/sesion";
import * as piezasModelo from "@/models/piezas";
import * as tareasModelo from "@/models/tareas";

/**
 * Mi trabajo: las tareas que tiene asignadas quien mira, de todos los
 * proyectos, primero lo que toca ahora.
 *
 * Es la puerta de quien hace el trabajo: desde aqui marca sus tareas, abre la
 * herramienta que cada una pide y llega a la ficha de su pieza. No ve el resto
 * del proyecto ni lo necesita.
 */

export const metadata: Metadata = {
  title: "Mi trabajo",
};

const MIGAS = [{ texto: "Conejo App", href: "/dashboard" }, { texto: "Mi trabajo" }];

/** Todos los cargos de la agencia salvo administracion, que solo ve finanzas. */
const CARGOS = ["direccion", "cuentas", "redes", "diseno", "produccion", "tecnologia"] as const;

export default async function PaginaMiTrabajo() {
  const usuario = await requerirCargo(...CARGOS);

  const { tareas, fases } = await conSesion(usuario, async (tx) => ({
    tareas: await tareasModelo.asignadasA(usuario.id, { incluirListas: true }, tx),
    fases: await piezasModelo.fasesACargoDe(usuario.id, tx),
  }));

  return (
    <Wrapper
      migas={MIGAS}
      kicker="Trabajo"
      titulo="Mi trabajo"
      descripcion="Las fases que llevas y las tareas que tienes asignadas, de todos los proyectos. Marcalas al terminarlas: el ejecutivo sabra que puede seguir."
    >
      <ListaMiTrabajo tareas={tareas} fases={fases} usuarioId={usuario.id} hoy={hoyEnCaracas()} />
    </Wrapper>
  );
}
