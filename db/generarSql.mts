/**
 * Vuelca a un unico archivo SQL lo que una base NUEVA necesita para arrancar.
 *
 *   npm run sql:produccion
 *
 * PARA QUE SIRVE
 * --------------
 * Para levantar una base vacia: el dia de la mudanza al VPS, o un entorno de
 * pruebas. Lleva el esquema entero y las filas de las que depende la logica.
 *
 * NO es la forma de migrar la base de produccion que ya existe: para eso estan
 * los archivos numerados de `db/neon/`, uno por cambio.
 *
 * QUE LLEVA Y QUE NO
 * ------------------
 * Lleva el esquema, los roles y las aperturas de hooks, que son contenido de
 * la casa. NO lleva nada de la semilla de desarrollo: ni la empresa de
 * ejemplo, ni las cuentas de prueba, ni las reglas y la referencia de muestra.
 * La base de produccion tiene datos reales, y unas cuentas con la contrasena
 * escrita en el repositorio no pueden acabar ahi.
 *
 * Por lo mismo no crea ningun usuario. El primer administrador de una base
 * nueva se da de alta a mano, con una contrasena que no pase por aqui.
 *
 * Todo va con ON CONFLICT DO NOTHING: el archivo se puede pegar mas de una vez
 * sin duplicar ni pisar nada.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { APERTURAS } from "./datos/aperturas.mts";
import { ROLES } from "./datos/semilla.mts";

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
 * la comilla de una apertura o de cualquier redaccion futura romperia el
 * archivo entero sin esto.
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
-- No crea usuarios ni datos de ejemplo. El rol conejo_app nace sin
-- contrasena: hay que ponersela aparte (ALTER ROLE conejo_app LOGIN PASSWORD '...').
--
-- Al terminar, comprobar:
--   SELECT count(*) FROM roles;           -- ${ROLES.length}
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

  const destino = join(import.meta.dirname, "produccion.sql");
  const contenido = partes.join("\n");
  await writeFile(destino, contenido, "utf8");

  const kb = (Buffer.byteLength(contenido, "utf8") / 1024).toFixed(1);
  console.log(`Escrito db/produccion.sql (${kb} kB)`);
  console.log(`  ${ROLES.length} roles y ${APERTURAS.length} aperturas. ` +
    "Sin usuarios ni datos de ejemplo.");
  console.log("\nEs para una base NUEVA. La que ya existe se migra con db/neon/.");
}

principal().catch((error: unknown) => {
  console.error(
    "\nNo se pudo generar el SQL:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
