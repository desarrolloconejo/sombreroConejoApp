/**
 * Los briefs de ejemplo de la semilla de desarrollo.
 *
 * Uno enviado por el cliente de ejemplo, con las respuestas del caso de prueba
 * del paquete (el empaque lo tiene el cliente, asi que su paso queda oculto),
 * para que la bandeja del ejecutivo arranque con algo que decidir; y un
 * borrador a medio llenar, que solo ve la empresa.
 *
 * Se escriben como lo haria el cliente: con su identidad declarada y pasando
 * por las funciones de la base, que ponen la fecha y el codigo.
 *
 * El hash se calcula aqui igual que en src/lib/portal/briefsHash.ts: ese
 * archivo importa sin extension, y el seed corre con Node, que la exige.
 *
 * Solo para desarrollo: `sql:produccion` no lo incluye.
 */
import { createHash } from "node:crypto";
import type { Client } from "pg";
import { canonico, congelar, formatoPor } from "../../src/lib/portal/briefs.ts";
import type { Respuestas } from "../../src/types/brief.ts";
import fixture from "../../tests/fixtures/brief-desarrollo-producto.json" with { type: "json" };

/** Declara al cliente en la transaccion, como hace `conSesion`. */
async function comoCliente(cliente: Client, usuarioId: number, empresaId: number) {
  await cliente.query(
    `SELECT set_config('app.usuario_id', $1, true), set_config('app.rol', 'cliente', true),
            set_config('app.empresa_id', $2, true)`,
    [String(usuarioId), String(empresaId)],
  );
}

/**
 * Siembra el ejemplo si la empresa todavia no tiene ningun brief. Devuelve
 * cuantos creo.
 */
export async function sembrarBriefs(
  cliente: Client,
  empresaId: number,
  persona: { id: number; nombre: string; empresaNombre: string },
): Promise<number> {
  const { rows: existentes } = await cliente.query(
    "SELECT 1 FROM portal.briefs WHERE empresa_id = $1 LIMIT 1",
    [empresaId],
  );
  if (existentes.length > 0) return 0;

  const formato = formatoPor("desarrollo-producto", 1);
  if (!formato) throw new Error("Falta el formato de desarrollo de producto");

  const respuestas = {
    ...(fixture.entrada.respuestas as Respuestas),
    empresa: persona.empresaNombre,
    responsableNombre: persona.nombre,
  };

  await cliente.query("BEGIN");

  try {
    await comoCliente(cliente, persona.id, empresaId);

    // Enviado, con la fecha aspirada dentro de un mes.
    const { rows: enviado } = await cliente.query<{ id: number }>(
      `INSERT INTO portal.briefs (formato, formato_version, empresa_id, creado_por, borrador)
       VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id`,
      [formato.clave, formato.version, empresaId, persona.id, JSON.stringify(respuestas)],
    );
    const contenido = congelar(formato, respuestas, persona.nombre);
    await cliente.query(
      `SELECT portal.enviar_brief($1, $2::jsonb, $3, $4::jsonb,
                                  (now() AT TIME ZONE 'America/Caracas')::date + 30, $5)`,
      [enviado[0].id, JSON.stringify(contenido), createHash("sha256").update(canonico(contenido), "utf8").digest("hex"), JSON.stringify(respuestas), persona.nombre],
    );

    // Un borrador a medio llenar.
    await cliente.query(
      `INSERT INTO portal.briefs (formato, formato_version, empresa_id, creado_por, borrador)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        formato.clave,
        formato.version,
        empresaId,
        persona.id,
        JSON.stringify({ empresa: persona.empresaNombre, productoIdea: "Linea de salsas picantes" }),
      ],
    );

    await cliente.query("COMMIT");
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  }

  return 2;
}
