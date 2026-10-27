import type { Metadata } from "next";

import { Wrapper } from "@/components/layout/Wrapper";
import { ArmadorNombres } from "@/components/nombresArchivo";
import { conSesion } from "@/lib/db";
import { hoyEnCaracas } from "@/lib/fechas";
import { requerirRol } from "@/lib/sesion";
import * as empresasModelo from "@/models/empresas";
import * as proyectosModelo from "@/models/proyectos";

/**
 * Nombres de archivo: el armador de la nomenclatura de la agencia
 * (CLIENTE_PROYECTO_TIPO_AAMM_VERSION.ext), para todo el equipo.
 *
 * Los clientes salen de Empresas, con su sigla, y los proyectos de los que
 * quien mira alcanza, con su nombre corto: los mismos bloques con que la app
 * renombra lo que se sube a una pieza.
 */

export const metadata: Metadata = {
  title: "Nombres de archivo",
};

const MIGAS = [{ texto: "Conejo App", href: "/dashboard" }, { texto: "Nombres de archivo" }];

export default async function PaginaNombresArchivo() {
  const usuario = await requerirRol("admin", "trabajador");

  const [empresas, proyectos] = await Promise.all([
    empresasModelo.siglas(),
    conSesion(usuario, (tx) => proyectosModelo.paraNombrar(tx)),
  ]);

  return (
    <Wrapper
      migas={MIGAS}
      kicker="Herramientas"
      titulo="Nombres de archivo"
      descripcion="Arma el nombre correcto para cada archivo que no se sube a la app: presentaciones, documentos, editables. Lo que se sube a una pieza se renombra solo con las mismas reglas."
    >
      <ArmadorNombres empresas={empresas} proyectos={proyectos} hoy={hoyEnCaracas()} />
    </Wrapper>
  );
}
