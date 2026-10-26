import type { Ejecutor } from "@/lib/db";
import { numeroDe } from "@/lib/finanzas/documentos";
import { rutaMiPresupuesto, rutaPresupuesto } from "@/lib/finanzas/rutas";
import { notificarA, notificarAEjecutivosDe } from "@/lib/notificaciones";
import { rutaBrief } from "@/lib/portal/rutas";
import * as clientes from "@/models/clientes";
import * as usuarios from "@/models/usuarios";
import type { Presupuesto } from "@/types";

/**
 * Quien se entera de la respuesta a un presupuesto, la de el cliente o la que
 * registra administracion a su nombre:
 *
 * - administracion, que si se aprobo tiene que generar la proforma;
 * - los ejecutivos de la empresa; si nace de un brief y se aprobo, ya pueden
 *   aceptarlo y abrir el proyecto, y el aviso los lleva a el;
 * - si la registro administracion, el cliente, para que sepa que quedo dicho.
 *
 * Quien la da no se avisa a si mismo: lo descarta la base.
 */
export async function avisarRespuestaPresupuesto(
  tx: Ejecutor,
  presupuesto: Pick<Presupuesto, "id" | "numero" | "titulo" | "empresaId" | "empresaNombre" | "briefId" | "briefCodigo">,
  respuesta: { aprobado: boolean; motivo: string | null; aNombreDelCliente: boolean },
): Promise<void> {
  const numero = numeroDe("presupuesto", presupuesto.numero);
  const { aprobado, motivo } = respuesta;
  const verbo = aprobado ? "aprobo" : "rechazo";

  await notificarA(tx, await usuarios.operadoresDeFinanzas(tx), {
    tipo: "presupuesto.resuelto",
    titulo: `${presupuesto.empresaNombre} ${verbo} ${numero}`,
    cuerpo: aprobado ? `«${presupuesto.titulo}». Ya puedes generar la proforma.` : motivo,
    href: rutaPresupuesto(presupuesto.id),
    empresaId: presupuesto.empresaId,
  });

  const delBrief = presupuesto.briefId !== null;
  await notificarAEjecutivosDe(tx, presupuesto.empresaId, {
    tipo: "presupuesto.resuelto",
    titulo:
      delBrief && aprobado
        ? `${presupuesto.empresaNombre} aprobo el presupuesto del brief ${presupuesto.briefCodigo}: ya puedes aceptarlo`
        : `${presupuesto.empresaNombre} ${verbo} ${numero}`,
    cuerpo: aprobado ? `«${presupuesto.titulo}».` : motivo,
    href: delBrief ? rutaBrief(presupuesto.briefId as number) : null,
    empresaId: presupuesto.empresaId,
  });

  if (respuesta.aNombreDelCliente) {
    const personas = await clientes.conFinanzasDe(presupuesto.empresaId, tx);
    await notificarA(
      tx,
      personas.map((persona) => persona.id),
      {
        tipo: "presupuesto.resuelto",
        titulo: `Registramos que ${aprobado ? "apruebas" : "rechazas"} ${numero}`,
        cuerpo: `«${presupuesto.titulo}». Lo anoto administracion con tu respuesta.`,
        href: rutaMiPresupuesto(presupuesto.id),
        empresaId: presupuesto.empresaId,
      },
    );
  }
}
