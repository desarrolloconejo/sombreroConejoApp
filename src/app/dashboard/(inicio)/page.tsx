import type { Metadata } from "next";

import { InicioWrapper } from "@/components/inicio";
import { requerirUsuario } from "@/lib/sesion";
import * as usuarios from "@/models/usuarios";

export const metadata: Metadata = {
  title: "Inicio",
};

/**
 * El saludo de la cabecera, segun la hora del servidor.
 *
 * Se calcula aqui y no en el componente porque el contrato del proyecto es que
 * la page resuelve los datos y los inyecta ya listos. Depende de la zona
 * horaria del contenedor: si algun dia se despliega fuera de la zona de la
 * agencia, se corrige con la variable TZ del servicio, no tocando este codigo.
 */
function saludoSegunLaHora(): string {
  const hora = new Date().getHours();

  if (hora < 12) return "Buenos dias";
  if (hora < 20) return "Buenas tardes";

  return "Buenas noches";
}

/**
 * El home del panel.
 *
 * `requerirUsuario` es la barrera real de esta page y ademas la fuente de los
 * datos: lee a la persona FRESCA de la base, no del token, que es lo correcto
 * cuando lo que se pinta son sus propios datos. Si un administrador acaba de
 * cambiarle el cargo, la ficha lo muestra sin esperar a que caduque la sesion.
 */
export default async function PaginaInicio() {
  const usuario = await requerirUsuario();

  // La tercera cifra del panel solo existe para un administrador, asi que la
  // consulta tampoco se hace para el resto: quien no la va a ver no paga por
  // ella. Se pide una sola fila porque lo unico que interesa es el total.
  const usuariosActivos =
    usuario.rol === "admin"
      ? (await usuarios.listar({ activo: true, porPagina: 1 })).total
      : null;

  return (
    <InicioWrapper
      usuario={usuario}
      saludo={saludoSegunLaHora()}
      usuariosActivos={usuariosActivos}
    />
  );
}
