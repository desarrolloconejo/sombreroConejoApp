"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { anotar } from "@/lib/auditoria";
import { conSesion, esErrorPostgres } from "@/lib/db";
import { numeroFactura } from "@/lib/finanzas/documentos";
import {
  RUTA_FACTURACION,
  RUTA_FACTURAS,
  RUTA_PROFORMAS,
  rutaFactura,
  rutaMiFactura,
  rutaProforma,
} from "@/lib/finanzas/rutas";
import { leerMotivo } from "@/lib/finanzas/validar";
import { notificarA } from "@/lib/notificaciones";
import { requerirFinanzas } from "@/lib/sesion";
import { comoIdentificador } from "@/lib/validaciones";
import * as clientes from "@/models/clientes";
import * as facturas from "@/models/facturas";
import type { EstadoFormulario } from "@/types";

/**
 * Las facturas, del lado de quien opera finanzas: emitirlas desde una
 * proforma emitida, anularlas con motivo y marcarlas impresas.
 *
 * Lo que vale lo decide la base (`finanzas.emitir_factura`): numero, control,
 * tasa del dia, importes y copias congeladas. Si algo falta (el emisor, la
 * tasa, numeros de control) devuelve el motivo, y aqui se traduce.
 */

/** Los motivos con los que la base rechaza una emision, en palabras de la pantalla. */
function motivoDeEmision(error: unknown): string | null {
  const mensaje = error instanceof Error ? error.message : "";
  if (mensaje.includes("emisor")) return "Faltan los datos del emisor: llenalos en Ajustes de finanzas";
  if (mensaje.includes("tasa")) return "No hay tasa del dolar registrada: registrala antes de facturar";
  if (mensaje.includes("rango de numeros de control")) {
    return "Se acabaron los numeros de control del talonario: carga el rango nuevo en Ajustes de finanzas";
  }
  if (mensaje.includes("renglones de los que caben")) {
    return "La proforma tiene mas renglones de los que caben en la hoja: hay que facturarla en dos";
  }
  if (mensaje.includes("no tiene renglones")) return "La proforma no tiene renglones";
  if (mensaje.includes("proforma emitida")) return "Solo se factura una proforma emitida";
  return null;
}

/** Emite la factura de una proforma emitida y lleva a ella. */
export async function emitirFactura(_estadoPrevio: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const usuario = await requerirFinanzas();

  const proformaId = comoIdentificador(datos.get("proformaId"));
  if (proformaId === null) return { ok: false, mensaje: "No se encontro la proforma" };

  let id: number;
  try {
    id = await conSesion(usuario, async (tx) => {
      const nueva = await facturas.emitir(proformaId, tx);
      const factura = await facturas.buscarPorId(nueva, tx);
      if (!factura) throw new Error("La factura recien emitida no se puede leer");

      const numero = numeroFactura(factura.serie, factura.numero);
      await anotar(tx, usuario, "factura.emitida", {
        entidadId: nueva,
        empresaId: factura.empresaId,
        despues: {
          numero,
          control: factura.numeroControl,
          proforma: proformaId,
          tasa: factura.tasa,
          total: factura.total,
        },
      });

      const destinatarios = await clientes.conFinanzasDe(factura.empresaId, tx);
      await notificarA(
        tx,
        destinatarios.map((persona) => persona.id),
        {
          tipo: "factura.emitida",
          titulo: `Tienes una factura nueva: ${numero}`,
          cuerpo: `Vence el ${factura.venceEl.split("-").reverse().join("/")}.`,
          href: rutaMiFactura(nueva),
          empresaId: factura.empresaId,
        },
      );

      return nueva;
    });
  } catch (error) {
    if (esErrorPostgres(error, "23514")) {
      return { ok: false, mensaje: motivoDeEmision(error) ?? "No se pudo emitir la factura" };
    }
    if (esErrorPostgres(error, "23505")) return { ok: false, mensaje: "Esta proforma ya tiene su factura" };
    throw error;
  }

  revalidatePath(RUTA_FACTURAS);
  revalidatePath(RUTA_PROFORMAS);
  revalidatePath(rutaProforma(proformaId));
  revalidatePath(RUTA_FACTURACION);
  redirect(rutaFactura(id));
}

/** Anula una factura con su motivo. La proforma vuelve a poder facturarse. */
export async function anularFactura(_estadoPrevio: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const usuario = await requerirFinanzas();

  const id = comoIdentificador(datos.get("id"));
  if (id === null) return { ok: false, mensaje: "No se encontro la factura" };

  const motivo = leerMotivo(datos);
  if (!motivo) return { ok: false, errores: { motivo: "Escribe el motivo de la anulacion" } };

  let proformaId: number;
  try {
    const resultado = await conSesion(usuario, async (tx) => {
      const factura = await facturas.buscarPorId(id, tx);
      if (!factura) return null;

      await facturas.anular(id, motivo, tx);
      await anotar(tx, usuario, "factura.anulada", {
        entidadId: id,
        empresaId: factura.empresaId,
        antes: { numero: numeroFactura(factura.serie, factura.numero), estado: factura.estado },
        despues: { estado: "anulada", motivo },
      });

      const personas = await clientes.conFinanzasDe(factura.empresaId, tx);
      await notificarA(
        tx,
        personas.map((persona) => persona.id),
        {
          tipo: "factura.anulada",
          titulo: `Anulamos la factura ${numeroFactura(factura.serie, factura.numero)}`,
          cuerpo: motivo,
          href: rutaMiFactura(id),
          empresaId: factura.empresaId,
        },
      );
      return factura.proformaId;
    });
    if (resultado === null) return { ok: false, mensaje: "No se encontro la factura" };
    proformaId = resultado;
  } catch (error) {
    if (esErrorPostgres(error, "23514")) {
      const mensaje = error instanceof Error && error.message.includes("pagos")
        ? "La factura tiene pagos reportados o confirmados: rechazalos antes de anularla"
        : "Esta factura ya no se puede anular";
      return { ok: false, mensaje };
    }
    throw error;
  }

  revalidatePath(RUTA_FACTURAS);
  revalidatePath(rutaFactura(id));
  revalidatePath(rutaProforma(proformaId));
  revalidatePath(RUTA_FACTURACION);
  return { ok: true, mensaje: "Factura anulada. La proforma se puede volver a facturar" };
}

/** Deja anotado que se imprimio sobre el talonario. Solo la primera vez. */
export async function marcarFacturaImpresa(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirFinanzas();

  const id = comoIdentificador(datos.get("id"));
  if (id === null) return { ok: false, mensaje: "No se encontro la factura" };

  const marcada = await conSesion(usuario, async (tx) => {
    const factura = await facturas.buscarPorId(id, tx);
    if (!factura || !(await facturas.marcarImpresa(id, usuario.id, tx))) return false;

    await anotar(tx, usuario, "factura.impresa", { entidadId: id, empresaId: factura.empresaId });
    return true;
  });

  if (!marcada) return { ok: false, mensaje: "Ya estaba marcada como impresa" };

  revalidatePath(RUTA_FACTURAS);
  revalidatePath(rutaFactura(id));
  return { ok: true, mensaje: "Marcada como impresa" };
}
