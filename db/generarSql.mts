/**
 * Vuelca el esquema y los datos iniciales a un unico archivo SQL.
 *
 *   npm run sql:produccion
 *
 * POR QUE EXISTE ESTO
 * -------------------
 * En produccion la base vive en Neon, pero la maquina de desarrollo no puede
 * alcanzarla: la VPN que hace falta para trabajar bloquea el puerto 5432 de
 * salida, y el reenvio selectivo que lo resolveria es de pago. Probado: el
 * mismo host de Neon abre en 443 y no contesta en 5432.
 *
 * El panel de Neon tiene un editor SQL que va por HTTPS, asi que si no se
 * puede llevar la base al script, se lleva el script a la base: este genera
 * `db/produccion.sql` para pegarlo ahi.
 *
 * Los hashes de contrasena se calculan AQUI, en local, con el mismo coste de
 * bcrypt que usa el seed. Nunca viaja una contrasena en claro.
 *
 * Todo va con ON CONFLICT DO NOTHING, igual que el seed: el archivo se puede
 * pegar mas de una vez sin duplicar ni pisar nada.
 *
 * El dia que se pueda conectar al 5432 —VPN de pago, o el salto a un VPS—
 * este archivo deja de hacer falta: bastara `npm run seed` con la cadena de
 * Neon en el entorno.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import { APERTURAS } from "./datos/aperturas.mts";
import {
  EMAIL_CREADORA,
  EMPRESA_DEMO,
  REFERENCIA,
  REGLAS,
  RONDAS_BCRYPT,
  ROLES,
  USUARIOS,
} from "./datos/semilla.mts";

/**
 * Escapa un literal de texto para SQL.
 *
 * Aqui NO hay parametros: se esta generando texto que otra persona pegara en
 * un editor, asi que la unica defensa es duplicar la comilla simple, que es
 * como PostgreSQL escapa dentro de un literal. La barra invertida no es
 * especial mientras `standard_conforming_strings` este en on, que es el valor
 * por defecto desde hace anos y el que usa Neon.
 *
 * Los datos de este archivo los escribimos nosotros, no llegan de fuera, pero
 * la comilla de "Distribuidora Ejemplo, C.A." o de cualquier redaccion futura
 * romperia el archivo entero sin esto.
 */
function txt(valor: string | null): string {
  if (valor === null) return "NULL";
  return `'${valor.replace(/'/g, "''")}'`;
}

/** Un array de texto de PostgreSQL: ARRAY['a','b']::text[] */
function arr(valores: readonly string[]): string {
  if (valores.length === 0) return "ARRAY[]::text[]";
  return `ARRAY[${valores.map(txt).join(",")}]::text[]`;
}

function encabezado(titulo: string): string {
  const raya = "-".repeat(74);
  return `\n-- ${raya}\n-- ${titulo}\n-- ${raya}\n`;
}

async function principal(): Promise<void> {
  const partes: string[] = [];

  partes.push(`--
-- ARCHIVO GENERADO. No se edita a mano: sale de \`npm run sql:produccion\`.
--
-- Para aplicarlo: panel de Neon -> SQL Editor -> pegar y ejecutar.
--
-- Es idempotente. Se puede pegar cuantas veces haga falta: las tablas se
-- crean con IF NOT EXISTS y las inserciones no duplican ni pisan nada.
--
-- Al terminar, comprobar:
--   SELECT count(*) FROM usuarios;        -- ${USUARIOS.length}
--   SELECT count(*) FROM aperturas_hook;  -- ${APERTURAS.length}
--
`);

  // -- Esquema --------------------------------------------------------------
  //
  // Se pega tal cual. Va primero y entero porque lleva dentro su propia
  // secuencia: la vista vw_usuarios_completos se elimina al principio y se
  // recrea al final, para que las migraciones puedan alterar las columnas de
  // las que depende. Partirlo dejaria la vista caida a mitad.
  const esquema = await readFile(join(import.meta.dirname, "schema.sql"), "utf8");
  partes.push(encabezado("ESQUEMA"), esquema);

  // -- Roles ----------------------------------------------------------------
  partes.push(encabezado("ROLES"));
  for (const rol of ROLES) {
    partes.push(
      `INSERT INTO roles (nombre, descripcion)\n` +
        `VALUES (${txt(rol.nombre)}, ${txt(rol.descripcion)})\n` +
        `ON CONFLICT (nombre) DO NOTHING;\n`,
    );
  }

  // -- Empresa de ejemplo ---------------------------------------------------
  partes.push(encabezado("EMPRESA DE EJEMPLO"));
  partes.push(
    `INSERT INTO empresas (nombre, rif, telefono, direccion, sector)\n` +
      `VALUES (${txt(EMPRESA_DEMO.nombre)}, ${txt(EMPRESA_DEMO.rif)}, ` +
      `${txt(EMPRESA_DEMO.telefono)}, ${txt(EMPRESA_DEMO.direccion)}, ` +
      `${txt(EMPRESA_DEMO.sector)})\n` +
      `ON CONFLICT (rif) DO UPDATE SET sector = EXCLUDED.sector;\n`,
  );

  // -- Usuarios -------------------------------------------------------------
  //
  // Los identificadores no se conocen al generar el archivo, asi que las
  // filas de trabajadores y clientes se enganchan con subconsultas por correo
  // en lugar de con un numero. Asi el archivo funciona sobre una base vacia y
  // sobre una que ya tenga usuarios.
  partes.push(encabezado("USUARIOS"));

  for (const usuario of USUARIOS) {
    const hash = await bcrypt.hash(usuario.password, RONDAS_BCRYPT);

    partes.push(
      `INSERT INTO usuarios (nombre, apellido, email, password_hash, telefono)\n` +
        `VALUES (${txt(usuario.nombre)}, ${txt(usuario.apellido)}, ` +
        `${txt(usuario.email)}, ${txt(hash)}, ${txt(usuario.telefono)})\n` +
        `ON CONFLICT (lower(email)) DO NOTHING;\n`,
    );

    const buscaUsuario = `(SELECT id FROM usuarios WHERE lower(email) = lower(${txt(usuario.email)}))`;

    if (usuario.perfil.tipo === "trabajador") {
      // DO UPDATE, no DO NOTHING: si cambia el rol o el cargo de alguien,
      // volver a pegar el archivo debe corregirlo.
      partes.push(
        `INSERT INTO trabajadores (usuario_id, rol_id, cargo_id, fecha_ingreso)\n` +
          `VALUES (\n` +
          `  ${buscaUsuario},\n` +
          `  (SELECT id FROM roles  WHERE nombre = ${txt(usuario.perfil.rol)}),\n` +
          `  (SELECT id FROM cargos WHERE slug   = ${txt(usuario.perfil.cargo)}),\n` +
          `  CURRENT_DATE\n` +
          `)\n` +
          `ON CONFLICT (usuario_id) DO UPDATE\n` +
          `  SET rol_id = EXCLUDED.rol_id, cargo_id = EXCLUDED.cargo_id;\n`,
      );
    } else {
      partes.push(
        `INSERT INTO clientes (usuario_id, empresa_id, cargo)\n` +
          `VALUES (\n` +
          `  ${buscaUsuario},\n` +
          `  (SELECT id FROM empresas WHERE rif = ${txt(EMPRESA_DEMO.rif)}),\n` +
          `  ${txt(usuario.perfil.cargo)}\n` +
          `)\n` +
          `ON CONFLICT (usuario_id) DO NOTHING;\n`,
      );
    }
  }

  // -- Aperturas ------------------------------------------------------------
  partes.push(encabezado(`APERTURAS (${APERTURAS.length})`));
  for (const a of APERTURAS) {
    partes.push(
      `INSERT INTO aperturas_hook (numero, territorio, mecanismos, plantilla, ` +
        `ejemplo, insert_titulo, direccion_edicion, usala_cuando)\n` +
        `VALUES (${a.numero}, ${txt(a.territorio)}, ${arr(a.mecanismos)}, ` +
        `${txt(a.plantilla)}, ${txt(a.ejemplo)}, ${txt(a.insertTitulo)}, ` +
        `${txt(a.direccionEdicion)}, ${txt(a.usalaCuando)})\n` +
        `ON CONFLICT (numero) DO NOTHING;\n`,
    );
  }

  // -- Reglas y referencia --------------------------------------------------
  const creadora = `(SELECT id FROM usuarios WHERE lower(email) = lower(${txt(EMAIL_CREADORA)}))`;
  const empresa = `(SELECT id FROM empresas WHERE rif = ${txt(EMPRESA_DEMO.rif)})`;

  partes.push(encabezado("REGLAS DE EJEMPLO"));
  for (const r of REGLAS) {
    partes.push(
      `INSERT INTO reglas_hook (etiqueta, empresa_id, sector, max_palabras_voz, ` +
        `max_palabras_insert, exigir_prueba, preambulos, formulas_gastadas, ` +
        `terminos_tension, creado_por)\n` +
        `SELECT ${txt(r.etiqueta)}, ${r.empresaId === null ? "NULL" : empresa}, ` +
        `${txt(r.sector)}, ${r.maxVoz}, ${r.maxInsert}, ${r.exigirPrueba}, ` +
        `'', '', '', ${creadora}\n` +
        `WHERE NOT EXISTS (SELECT 1 FROM reglas_hook WHERE etiqueta = ${txt(r.etiqueta)});\n`,
    );
  }

  partes.push(encabezado("REFERENCIA DE EJEMPLO"));
  partes.push(
    `INSERT INTO referencias_hook (hablado, insert_titulo, plataforma, ` +
      `territorio, url_fuente, lectura, etiquetas, creado_por)\n` +
      `SELECT ${txt(REFERENCIA.hablado)}, ${txt(REFERENCIA.insertTitulo)}, ` +
      `${txt(REFERENCIA.plataforma)}, ${txt(REFERENCIA.territorio)}, ` +
      `${txt(REFERENCIA.urlFuente)}, ${txt(REFERENCIA.lectura)}, ` +
      `${txt(REFERENCIA.etiquetas)}, ${creadora}\n` +
      `WHERE NOT EXISTS (SELECT 1 FROM referencias_hook ` +
      `WHERE hablado = ${txt(REFERENCIA.hablado)});\n`,
  );

  const destino = join(import.meta.dirname, "produccion.sql");
  const contenido = partes.join("\n");
  await writeFile(destino, contenido, "utf8");

  const kb = (Buffer.byteLength(contenido, "utf8") / 1024).toFixed(1);
  console.log(`Escrito db/produccion.sql (${kb} kB)`);
  console.log(`  ${ROLES.length} roles, ${USUARIOS.length} usuarios, ` +
    `${APERTURAS.length} aperturas, ${REGLAS.length} reglas, 1 referencia`);
  console.log("\nPegalo en el editor SQL del panel de Neon y ejecutalo.");
}

principal().catch((error: unknown) => {
  console.error(
    "\nNo se pudo generar el SQL:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
