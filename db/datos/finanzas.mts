/**
 * Los presupuestos y proformas de ejemplo de la semilla de desarrollo.
 *
 * Dejan un caso de cada cosa que hay que poder ver al abrir finanzas: un
 * presupuesto por aprobar, uno aprobado con su proforma emitida y ligada a un
 * proyecto, un borrador, y una proforma recurrente a la que ya le toca la
 * siguiente.
 *
 * Se escriben como lo haria un operador: con la sesion declarada y pasando
 * por las funciones de la base, que son las que numeran y calculan.
 *
 * Solo para desarrollo: `sql:produccion` no lo incluye.
 */
import type { Client } from "pg";

type RenglonEjemplo = {
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
  exento?: boolean;
};

const PARRILLA: RenglonEjemplo[] = [
  { descripcion: "Parrilla mensual: 12 publicaciones", cantidad: "1", precioUnitario: "480.00" },
  { descripcion: "Reels de 30 segundos", cantidad: "4", precioUnitario: "65.00" },
  { descripcion: "Pauta en redes (gestion)", cantidad: "1", precioUnitario: "120.00", exento: true },
];

const EMPAQUE: RenglonEjemplo[] = [
  { descripcion: "Diseno de empaque, tres sabores", cantidad: "3", precioUnitario: "350.00" },
  { descripcion: "Artes finales para imprenta", cantidad: "1", precioUnitario: "180.00" },
];

const MANTENIMIENTO: RenglonEjemplo[] = [
  { descripcion: "Gestion de redes, plan mensual", cantidad: "1", precioUnitario: "650.00" },
];

const BORRADOR: RenglonEjemplo[] = [
  { descripcion: "Sesion de fotos de producto", cantidad: "1", precioUnitario: "300.00" },
];

/** Las personas que firman lo que siembra. */
export type FirmasFinanzas = {
  admin: number;
  cliente: number;
};

/** Declara al operador en la transaccion, como hace `conSesion`. */
async function comoOperador(cliente: Client, adminId: number) {
  await cliente.query("SELECT set_config('app.usuario_id', $1, true)", [String(adminId)]);
  await cliente.query("SELECT set_config('app.rol', 'admin', true)");
}

async function presupuesto(
  cliente: Client,
  datos: { empresaId: number; proyectoId: number | null; titulo: string; dias: number },
  renglones: RenglonEjemplo[],
  adminId: number,
): Promise<number> {
  const { rows } = await cliente.query<{ id: number }>(
    `INSERT INTO finanzas.presupuestos
       (numero, empresa_id, proyecto_id, titulo, valido_hasta, creado_por)
     VALUES (finanzas.siguiente_numero('PRESUPUESTO'), $1, $2, $3, finanzas.hoy() + $4::int, $5)
     RETURNING id`,
    [datos.empresaId, datos.proyectoId, datos.titulo, datos.dias, adminId],
  );

  await cliente.query("SELECT finanzas.guardar_renglones('presupuesto', $1, $2::jsonb)", [
    rows[0].id,
    JSON.stringify(renglones),
  ]);

  return rows[0].id;
}

async function enviar(cliente: Client, id: number, adminId: number) {
  await cliente.query(
    "UPDATE finanzas.presupuestos SET estado = 'enviado', enviado_por = $2, enviado_en = now() WHERE id = $1",
    [id, adminId],
  );
}

async function emitir(cliente: Client, id: number, adminId: number) {
  await cliente.query(
    "UPDATE finanzas.proformas SET estado = 'emitida', emitida_por = $2, emitida_en = now() WHERE id = $1",
    [id, adminId],
  );
}

/**
 * Siembra el ejemplo si la empresa todavia no tiene ningun presupuesto.
 * Devuelve cuantos documentos creo.
 */
export async function sembrarFinanzas(
  cliente: Client,
  empresaId: number,
  proyectoEspecialId: number | null,
  firmas: FirmasFinanzas,
): Promise<number> {
  const { rows: existentes } = await cliente.query(
    "SELECT 1 FROM finanzas.presupuestos WHERE empresa_id = $1 LIMIT 1",
    [empresaId],
  );
  if (existentes.length > 0) return 0;

  await cliente.query("BEGIN");

  try {
    await comoOperador(cliente, firmas.admin);

    // Por aprobar: enviado y vigente.
    const porAprobar = await presupuesto(
      cliente,
      { empresaId, proyectoId: null, titulo: "Parrilla de redes de noviembre", dias: 15 },
      PARRILLA,
      firmas.admin,
    );
    await enviar(cliente, porAprobar, firmas.admin);

    // Aprobado por el cliente, con su proforma emitida y ligada al proyecto.
    const aprobado = await presupuesto(
      cliente,
      { empresaId, proyectoId: proyectoEspecialId, titulo: "Empaque de la linea premium", dias: 15 },
      EMPAQUE,
      firmas.admin,
    );
    await enviar(cliente, aprobado, firmas.admin);
    await cliente.query(
      `UPDATE finanzas.presupuestos
       SET estado = 'aprobado', resuelto_por = $2, resuelto_en = now()
       WHERE id = $1`,
      [aprobado, firmas.cliente],
    );
    const { rows: proforma } = await cliente.query<{ id: number }>(
      "SELECT finanzas.proforma_desde('presupuesto', $1) AS id",
      [aprobado],
    );
    await emitir(cliente, proforma[0].id, firmas.admin);

    // Un borrador, que el cliente no ve.
    await presupuesto(
      cliente,
      { empresaId, proyectoId: null, titulo: "Sesion de fotos de producto", dias: 15 },
      BORRADOR,
      firmas.admin,
    );

    // Una proforma recurrente a la que ya le toca la siguiente.
    const contrato = await presupuesto(
      cliente,
      { empresaId, proyectoId: null, titulo: "Gestion de redes, contrato mensual", dias: 15 },
      MANTENIMIENTO,
      firmas.admin,
    );
    await enviar(cliente, contrato, firmas.admin);
    await cliente.query(
      `UPDATE finanzas.presupuestos
       SET estado = 'aprobado', resuelto_por = $2, resuelto_en = now()
       WHERE id = $1`,
      [contrato, firmas.cliente],
    );
    const { rows: mensual } = await cliente.query<{ id: number }>(
      "SELECT finanzas.proforma_desde('presupuesto', $1) AS id",
      [contrato],
    );
    await emitir(cliente, mensual[0].id, firmas.admin);
    await cliente.query(
      "UPDATE finanzas.proformas SET recurrente = TRUE, proxima_emision = finanzas.hoy() - 1 WHERE id = $1",
      [mensual[0].id],
    );

    await cliente.query("COMMIT");
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  }

  return 6;
}
