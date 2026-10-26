import type { Metadata } from "next";

import { AvisoPresupuestos } from "@/components/facturacion";
import { InicioWrapper } from "@/components/inicio";
import { AvisoRevision, TarjetaProyectoCliente } from "@/components/misProyectos";
import { conSesion } from "@/lib/db";
import * as piezas from "@/models/piezas";
import * as presupuestos from "@/models/presupuestos";
import * as proyectos from "@/models/proyectos";
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
      ? (await usuarios.listar({ activo: [true], porPagina: 1 })).total
      : null;

  // El inicio de un cliente: lo que espera su revision y sus proyectos.
  const delCliente =
    usuario.tipo === "cliente" && usuario.empresaId
      ? await conSesion(usuario, async (tx) => ({
          enCurso: await proyectos.enCurso(tx),
          esperando: await piezas.esperandoCliente(tx),
        }))
      : null;
  const enCurso = delCliente?.enCurso ?? null;

  // Y, si ve las finanzas de su empresa, lo que espera su aprobacion.
  const presupuestosPendientes =
    usuario.tipo === "cliente" && usuario.puedeVerFinanzas
      ? await conSesion(usuario, (tx) => presupuestos.porAprobar(tx))
      : [];

  const destacado = enCurso && (
    <>
      <AvisoPresupuestos presupuestos={presupuestosPendientes} />
      <AvisoRevision piezas={delCliente?.esperando ?? []} />
      {enCurso.length > 0 && (
        <section aria-label="Tus proyectos en curso">
          <h2 className="mb-3 text-[19px] font-extrabold tracking-[-0.02em]">Tus proyectos</h2>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {enCurso.map((proyecto) => (
              <li key={proyecto.id}>
                <TarjetaProyectoCliente proyecto={proyecto} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );

  return (
    <InicioWrapper
      usuario={usuario}
      saludo={saludoSegunLaHora()}
      usuariosActivos={usuariosActivos}
      destacado={destacado}
    />
  );
}
