import type { ReactNode } from "react";

import type { Miga } from "@/components/layout/Breadcrumb";
import { Wrapper } from "@/components/layout/Wrapper";
import type { UsuarioCompleto } from "@/types";

import { EstadoCuenta } from "./EstadoCuenta";

/**
 * El envoltorio del home del panel.
 *
 * Es de servidor: recibe de la page lo que necesita y solo reparte.
 *
 * El home no lista los modulos ni repite los datos de la persona. Lo primero
 * ya lo hace la barra lateral y lo segundo vive en Mi perfil; tener cualquiera
 * de las dos cosas por duplicado obliga a mantenerlas en dos sitios. Lo que si
 * aporta son tres cifras que resumen el estado de la cuenta de un vistazo.
 */

// "Conejo App" se queda sin enlace a proposito: esta page YA es /dashboard, y
// una miga que lleva a donde ya estas no es navegacion, es ruido.
const MIGAS: Miga[] = [{ texto: "Conejo App" }, { texto: "Inicio" }];

export function InicioWrapper({
  usuario,
  saludo,
  usuariosActivos,
  destacado,
}: {
  usuario: UsuarioCompleto;
  saludo: string;
  usuariosActivos: number | null;

  /**
   * Lo que va antes de las cifras, si hay algo. Para un cliente: lo que
   * espera su revision y sus proyectos en curso.
   */
  destacado?: ReactNode;
}) {
  return (
    <Wrapper
      migas={MIGAS}
      kicker={`${saludo}, ${usuario.nombre}`}
      titulo="Tu espacio de trabajo"
      descripcion="Desde aqui se centralizan los procesos del dia a dia de la agencia."
    >
      {destacado && <div className="mb-8 flex flex-col gap-6">{destacado}</div>}
      <EstadoCuenta usuario={usuario} usuariosActivos={usuariosActivos} />
    </Wrapper>
  );
}
