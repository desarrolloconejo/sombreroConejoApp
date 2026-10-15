"use server";

import { revalidatePath } from "next/cache";

import { anotar } from "@/lib/auditoria";
import { conSesion, esErrorPostgres } from "@/lib/db";
import { subirArchivo } from "@/lib/externos/archivos";
import { leerMonto, leerPago, leerTasa, type PagoLeido } from "@/lib/finanzas/pagos";
import { numeroFactura } from "@/lib/finanzas/documentos";
import { RUTA_COBRANZA, RUTA_FACTURACION, RUTA_FACTURAS, rutaFactura, rutaMiFactura } from "@/lib/finanzas/rutas";
import { leerMotivo } from "@/lib/finanzas/validar";
import { notificarA } from "@/lib/notificaciones";
import { TAMANO_MAXIMO, tipoPorFirma } from "@/lib/portal/archivos";
import { hoyEnCaracas } from "@/lib/portal/fases";
import { requerirFinanzas, requerirFinanzasDeEmpresa } from "@/lib/sesion";
import { comoIdentificador } from "@/lib/validaciones";
import * as ajustes from "@/models/ajustesFinanzas";
import * as facturas from "@/models/facturas";
import * as pagos from "@/models/pagos";
import * as usuarios from "@/models/usuarios";
import { NOMBRES_DE_TIPO_PAGO, type EstadoFormulario, type UsuarioCompleto } from "@/types";

/**
 * Pagos y retenciones de una factura.
 *
 * El cliente con permiso de finanzas reporta lo que pago, con su comprobante:
 * queda por confirmar y no baja el saldo. Quien opera finanzas lo confirma
 * fijando el monto que se aplica en bolivares (con la tasa si pagaron en
 * dolares) o lo rechaza con motivo; tambien puede registrar uno a nombre del
 * cliente. Lo reportado no cambia nunca: lo impide la base.
 */

function revalidar(facturaId: number): void {
  revalidatePath(RUTA_FACTURAS);
  revalidatePath(rutaFactura(facturaId));
  revalidatePath(RUTA_COBRANZA);
  revalidatePath(RUTA_FACTURACION);
  revalidatePath(rutaMiFactura(facturaId));
}

/** El comprobante, si llego: solo imagenes o PDF de hasta 4 MB. */
async function leerComprobante(
  datos: FormData,
): Promise<{ bytes: Uint8Array; mime: string; extension: string } | { error: string } | null> {
  const archivo = datos.get("comprobante");
  if (!(archivo instanceof File) || archivo.size === 0) return null;
  if (archivo.size > TAMANO_MAXIMO) return { error: "Como mucho 4 MB" };

  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const tipo = tipoPorFirma(bytes);
  if (!tipo) return { error: "Solo imagenes (PNG, JPG, GIF, WEBP) o PDF" };
  return { bytes, mime: tipo.mime, extension: tipo.extension };
}

/**
 * Lo comun a reportar (cliente) y registrar (operador): comprobar que la
 * factura se ve y esta emitida, subir el comprobante FUERA de la transaccion
 * y escribir la fila con su auditoria y sus avisos.
 */
async function guardarPago(
  usuario: UsuarioCompleto,
  facturaId: number,
  datos: FormData,
  aNombreDelCliente: boolean,
): Promise<EstadoFormulario> {
  const previo = await conSesion(usuario, async (tx) => ({
    factura: await facturas.buscarPorId(facturaId, tx),
    medios: (await ajustes.medios(tx)).filter((m) => m.activo),
  }));
  if (!previo.factura) return { ok: false, mensaje: "No se encontro la factura" };
  if (previo.factura.estado !== "emitida") return { ok: false, mensaje: "La factura esta anulada" };

  const { pago, errores } = leerPago(datos, previo.medios, hoyEnCaracas());
  const comprobante = await leerComprobante(datos);
  if (comprobante && "error" in comprobante) errores.comprobante = comprobante.error;
  if (!aNombreDelCliente && !comprobante) errores.comprobante = "Adjunta el comprobante";
  if (Object.keys(errores).length > 0) return { ok: false, errores, mensaje: "Revisa los datos del pago" };

  const factura = previo.factura;
  const numero = numeroFactura(factura.serie, factura.numero);

  let archivo: string | null = null;
  if (comprobante && !("error" in comprobante)) {
    try {
      archivo = await subirArchivo({
        nombre: `${pago.tipo === "pago" ? "pago" : "retencion"}-${numero}-${pago.fechaPago}.${comprobante.extension}`,
        mime: comprobante.mime,
        bytes: comprobante.bytes,
        carpeta: "comprobantes",
      });
    } catch (error) {
      console.error("[pagos] no se pudo guardar el comprobante:", error);
      return { ok: false, mensaje: "No se pudo guardar el comprobante. Intentalo de nuevo" };
    }
  }

  try {
    await conSesion(usuario, async (tx) => {
      const id = await pagos.reportar(
        {
          facturaId,
          ...(pago satisfies PagoLeido),
          comprobanteArchivo: archivo,
          comprobanteMime: comprobante && !("error" in comprobante) ? comprobante.mime : null,
          aNombreDelCliente,
        },
        usuario.id,
        tx,
      );

      await anotar(tx, usuario, "pago.reportado", {
        entidadId: id,
        empresaId: factura.empresaId,
        despues: {
          factura: numero,
          tipo: pago.tipo,
          monto: pago.monto,
          moneda: pago.moneda,
          aNombreDelCliente,
        },
      });

      // Quien lo reporta no se avisa a si mismo.
      const operadores = (await usuarios.operadoresDeFinanzas(tx)).filter((idOperador) => idOperador !== usuario.id);
      await notificarA(tx, operadores, {
        tipo: "pago.reportado",
        titulo: `${NOMBRES_DE_TIPO_PAGO[pago.tipo]} por confirmar: ${factura.empresaNombre}`,
        cuerpo: `${numero} · ${pago.moneda === "USD" ? "$" : "Bs. "}${pago.monto}`,
        href: rutaFactura(facturaId),
        empresaId: factura.empresaId,
      });
    });
  } catch (error) {
    if (esErrorPostgres(error, "23514")) {
      return { ok: false, mensaje: "La base no acepto el pago: revisa el medio, la moneda y el monto" };
    }
    if (esErrorPostgres(error, "42501")) return { ok: false, mensaje: "No puedes reportar pagos de esta factura" };
    throw error;
  }

  revalidar(facturaId);
  return {
    ok: true,
    mensaje: aNombreDelCliente
      ? "Pago registrado: falta confirmarlo"
      : "Recibido. Administracion lo revisa y te avisa al confirmarlo",
  };
}

/** El cliente reporta un pago o una retencion de una factura suya. */
export async function reportarPago(_estadoPrevio: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const { usuario } = await requerirFinanzasDeEmpresa();

  const facturaId = comoIdentificador(datos.get("facturaId"));
  if (facturaId === null) return { ok: false, mensaje: "No se encontro la factura" };

  return guardarPago(usuario, facturaId, datos, false);
}

/** El operador registra un pago a nombre del cliente. Queda por confirmar. */
export async function registrarPago(_estadoPrevio: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const usuario = await requerirFinanzas();

  const facturaId = comoIdentificador(datos.get("facturaId"));
  if (facturaId === null) return { ok: false, mensaje: "No se encontro la factura" };

  return guardarPago(usuario, facturaId, datos, true);
}

/**
 * Confirma un pago con el monto que se aplica a la factura, en bolivares. Si
 * se pago en dolares, con la tasa que se uso.
 */
export async function confirmarPago(_estadoPrevio: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const usuario = await requerirFinanzas();

  const id = comoIdentificador(datos.get("id"));
  if (id === null) return { ok: false, mensaje: "No se encontro el pago" };

  const montoAplicado = leerMonto(datos.get("montoAplicado"));
  const textoTasa = String(datos.get("tasaAplicada") ?? "").trim();
  const tasaAplicada = textoTasa ? leerTasa(textoTasa) : null;

  const resultado = await conSesion(usuario, async (tx) => {
    const pago = await pagos.buscarPorId(id, tx);
    if (!pago) return { error: "No se encontro el pago" };

    const errores: Record<string, string> = {};
    if (!montoAplicado) errores.montoAplicado = "Escribe cuanto se aplica a la factura";
    if (pago.moneda === "USD" && !tasaAplicada) errores.tasaAplicada = "Pagaron en dolares: indica la tasa";
    if (Object.keys(errores).length > 0) return { errores };

    if (!(await pagos.confirmar(id, { montoAplicado: montoAplicado as string, tasaAplicada }, usuario.id, tx))) {
      return { error: "Ese pago ya estaba resuelto" };
    }

    await anotar(tx, usuario, "pago.confirmado", {
      entidadId: id,
      despues: { factura: pago.facturaNumero, montoAplicado, tasaAplicada },
    });
    await notificarA(tx, [await pagos.reportadoPor(id, tx)].filter((x): x is number => x !== null), {
      tipo: "pago.resuelto",
      titulo: `${NOMBRES_DE_TIPO_PAGO[pago.tipo]} confirmado: ${pago.facturaNumero}`,
      href: rutaMiFactura(pago.facturaId),
    });
    return { facturaId: pago.facturaId };
  });

  if ("errores" in resultado) return { ok: false, errores: resultado.errores };
  if ("error" in resultado) return { ok: false, mensaje: resultado.error };

  revalidar(resultado.facturaId);
  return { ok: true, mensaje: "Pago confirmado" };
}

/** Rechaza un pago con su motivo, que ve el cliente. */
export async function rechazarPago(_estadoPrevio: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const usuario = await requerirFinanzas();

  const id = comoIdentificador(datos.get("id"));
  if (id === null) return { ok: false, mensaje: "No se encontro el pago" };

  const motivo = leerMotivo(datos);
  if (!motivo) return { ok: false, errores: { motivo: "Escribe por que se rechaza: el cliente lo vera" } };

  const resultado = await conSesion(usuario, async (tx) => {
    const pago = await pagos.buscarPorId(id, tx);
    if (!pago || !(await pagos.rechazar(id, motivo, usuario.id, tx))) return null;

    await anotar(tx, usuario, "pago.rechazado", {
      entidadId: id,
      despues: { factura: pago.facturaNumero, motivo },
    });
    await notificarA(tx, [await pagos.reportadoPor(id, tx)].filter((x): x is number => x !== null), {
      tipo: "pago.resuelto",
      titulo: `${NOMBRES_DE_TIPO_PAGO[pago.tipo]} rechazado: ${pago.facturaNumero}`,
      cuerpo: motivo.slice(0, 140),
      href: rutaMiFactura(pago.facturaId),
    });
    return pago.facturaId;
  });

  if (resultado === null) return { ok: false, mensaje: "Ese pago ya estaba resuelto" };

  revalidar(resultado);
  return { ok: true, mensaje: "Pago rechazado" };
}
