/**
 * Lo que el rol de la aplicacion NO puede hacer, comprobado contra la base.
 *
 *   docker compose exec app-dev npm run prueba:permisos
 *
 * Al contrario que las otras baterias, esta corre con la conexion de la
 * APLICACION (`DATABASE_URL`), no con la del dueno: lo que mide es justo lo
 * que ese rol tiene prohibido. Si alguien anade un permiso de mas en
 * db/schema.sql, aqui salta.
 *
 * No deja nada escrito: cada intento va en una transaccion que se deshace.
 */
import { conSesion, consultar, consultarUno, obtenerPool, transaccion } from "@/lib/db";

let pasan = 0;
const fallan: string[] = [];

function comprobar(nombre: string, ok: boolean, detalle: string): void {
  if (ok) {
    pasan++;
    console.log(`  OK    ${nombre}  ->  ${detalle}`);
  } else {
    fallan.push(nombre);
    console.log(`  FALLA ${nombre}  ->  ${detalle}`);
  }
}

/** Marca con la que se deshace cada transaccion de prueba. */
class Deshacer extends Error {}

/**
 * Ejecuta una sentencia dentro de una transaccion que siempre se deshace.
 * Devuelve el codigo de error de PostgreSQL, o null si la base la acepto.
 */
async function intentar(sql: string, valores: unknown[] = []): Promise<string | null> {
  try {
    await transaccion(async (cliente) => {
      await cliente.query(sql, valores);
      throw new Deshacer();
    });
  } catch (error) {
    if (error instanceof Deshacer) return null;
    return (error as { code?: string }).code ?? "desconocido";
  }

  return null;
}

/** 42501 es «permiso denegado». */
const DENEGADO = "42501";

async function principal(): Promise<void> {
  const quien = await consultarUno<{
    usuario: string;
    saltaRls: boolean;
    superusuario: boolean;
  }>(
    `SELECT current_user AS usuario,
            rolbypassrls  AS "saltaRls",
            rolsuper      AS superusuario
     FROM pg_roles WHERE rolname = current_user`,
  );

  console.log(`\nPermisos del rol de la aplicacion (${quien?.usuario})\n`);

  comprobar(
    "La aplicacion se conecta como conejo_app",
    quien?.usuario === "conejo_app",
    String(quien?.usuario),
  );
  comprobar(
    "No es superusuario ni se salta la seguridad por fila",
    quien?.superusuario === false && quien.saltaRls === false,
    JSON.stringify({ superusuario: quien?.superusuario, saltaRls: quien?.saltaRls }),
  );

  // --------------------------------------------------------------- esquema
  comprobar(
    "No puede crear tablas",
    (await intentar("CREATE TABLE _no_deberia (id int)")) === DENEGADO,
    "CREATE TABLE denegado",
  );
  comprobar(
    "No puede alterar una tabla",
    (await intentar("ALTER TABLE usuarios ADD COLUMN _no_deberia int")) === DENEGADO,
    "ALTER TABLE denegado",
  );

  // ------------------------------------------------------------- auditoria
  comprobar(
    "Puede anadir una linea a la auditoria",
    (await intentar("INSERT INTO auditoria (accion) VALUES ('prueba.permisos')")) === null,
    "INSERT aceptado (y deshecho)",
  );
  comprobar(
    "No puede cambiar la auditoria",
    (await intentar("UPDATE auditoria SET accion = 'prueba.otra'")) === DENEGADO,
    "UPDATE denegado",
  );
  comprobar(
    "No puede borrar la auditoria",
    (await intentar("DELETE FROM auditoria")) === DENEGADO,
    "DELETE denegado",
  );
  comprobar(
    "No puede vaciar la auditoria",
    (await intentar("TRUNCATE auditoria")) === DENEGADO,
    "TRUNCATE denegado",
  );

  // ------------------------------------------------ lo que no se borra nunca
  for (const tabla of ["usuarios", "empresas", "trabajadores", "clientes", "sesiones"]) {
    comprobar(
      `No puede borrar de ${tabla}`,
      (await intentar(`DELETE FROM ${tabla} WHERE false`)) === DENEGADO,
      "DELETE denegado",
    );
  }

  // --------------------------------------------------------------- catalogos
  comprobar(
    "No puede crear roles ni cargos",
    (await intentar("INSERT INTO roles (nombre) VALUES ('_no_deberia')")) === DENEGADO &&
      (await intentar("INSERT INTO cargos (slug, nombre) VALUES ('_no', 'No')")) === DENEGADO,
    "INSERT denegado en los dos",
  );
  comprobar(
    "Si puede leerlos",
    (await consultar("SELECT id FROM roles")).length > 0 &&
      (await consultar("SELECT id FROM cargos")).length > 0,
    "SELECT aceptado",
  );

  // ------------------------------------------------- lo que si tiene que poder
  comprobar(
    "Puede borrar donde la aplicacion borra",
    (await intentar("DELETE FROM fichas_hook WHERE false")) === null &&
      (await intentar("DELETE FROM reglas_hook WHERE false")) === null &&
      (await intentar("DELETE FROM referencias_hook WHERE false")) === null,
    "fichas, reglas y referencias",
  );
  comprobar(
    "Puede escribir en usuarios y en sesiones",
    (await intentar("UPDATE usuarios SET ultimo_acceso = ultimo_acceso WHERE false")) === null &&
      (await intentar("UPDATE sesiones SET ultimo_uso = ultimo_uso WHERE false")) === null,
    "UPDATE aceptado",
  );

  // -------------------------------------------------------------------- vista
  const conHash = await consultar<{ columna: string }>(
    `SELECT column_name AS columna FROM information_schema.columns
     WHERE table_name = 'vw_usuarios_completos' AND column_name = 'password_hash'`,
  );
  comprobar(
    "La vista general no trae el hash de la contrasena",
    conHash.length === 0,
    "vw_usuarios_completos sin password_hash",
  );

  // ----------------------------------------------------------------- conSesion
  const dentro = await conSesion(
    { id: 7, rol: "cliente", cargoSlug: null, empresaId: 3 },
    async (cliente) => {
      const { rows } = await cliente.query<{
        usuario: string;
        rol: string;
        cargo: string;
        empresa: string;
      }>(
        `SELECT current_setting('app.usuario_id', true) AS usuario,
                current_setting('app.rol', true)        AS rol,
                current_setting('app.cargo', true)      AS cargo,
                current_setting('app.empresa_id', true) AS empresa`,
      );
      return rows[0];
    },
  );
  comprobar(
    "conSesion declara quien esta al otro lado",
    dentro?.usuario === "7" &&
      dentro.rol === "cliente" &&
      dentro.cargo === "" &&
      dentro.empresa === "3",
    JSON.stringify(dentro),
  );

  // La identidad no puede sobrevivir a la transaccion: la conexion vuelve al
  // pool, y la siguiente peticion que la tome no debe heredarla.
  const fugas: string[] = [];
  for (let intento = 0; intento < 6; intento++) {
    const fila = await consultarUno<{ usuario: string | null }>(
      "SELECT current_setting('app.usuario_id', true) AS usuario",
    );
    if (fila?.usuario) fugas.push(fila.usuario);
  }
  comprobar(
    "Al terminar, la conexion no conserva la identidad",
    fugas.length === 0,
    fugas.length === 0 ? "sin rastro en el pool" : `quedo: ${fugas.join(",")}`,
  );

  console.log(`\n${pasan}/${pasan + fallan.length} comprobaciones correctas`);
  if (fallan.length > 0) {
    console.error(`\nFallan: ${fallan.join(", ")}`);
    process.exitCode = 1;
  }
}

principal()
  .catch((error: unknown) => {
    console.error("\nFallo:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await obtenerPool().end();
  });
