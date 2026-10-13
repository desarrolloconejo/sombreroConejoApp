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

  // ------------------------------------------- seguridad por fila: la bandeja
  //
  // Todo dentro de UNA transaccion que se deshace: se cambia de identidad con
  // set_config, que es justo lo que hace `conSesion`, y al final no queda nada.
  const [admin] = await consultar<{ id: number }>(
    "SELECT id FROM vw_usuarios_completos WHERE rol = 'admin' ORDER BY id LIMIT 1",
  );
  const [otro] = await consultar<{ id: number }>(
    "SELECT id FROM vw_usuarios_completos WHERE rol <> 'admin' ORDER BY id LIMIT 1",
  );

  if (!admin || !otro) throw new Error("Falta el seed: ejecuta npm run seed");

  const bandeja: Record<string, unknown> = {};

  try {
    await transaccion(async (cliente) => {
      const como = (id: number | null, rol: string) =>
        cliente.query(
          "SELECT set_config('app.usuario_id', $1, true), set_config('app.rol', $2, true)",
          [id === null ? "" : String(id), rol],
        );
      const insertar = (creadoPor: number) =>
        cliente.query(
          `INSERT INTO portal.correos_salida
             (para, tipo, asunto, cuerpo, modo, estado, creado_por)
           VALUES ('prueba@permisos.test', 'bienvenida', 'Prueba', 'Cuerpo',
                   'simulado', 'simulado', $1)`,
          [creadoPor],
        );
      const cuantos = async () =>
        Number(
          (
            await cliente.query<{ n: string }>(
              "SELECT count(*)::text AS n FROM portal.correos_salida WHERE para = 'prueba@permisos.test'",
            )
          ).rows[0].n,
        );
      /** Un intento que puede fallar sin tumbar la transaccion entera. */
      const intentarDentro = async (accion: () => Promise<unknown>) => {
        await cliente.query("SAVEPOINT intento");
        try {
          await accion();
          await cliente.query("RELEASE SAVEPOINT intento");
          return null;
        } catch (error) {
          await cliente.query("ROLLBACK TO SAVEPOINT intento");
          return (error as { code?: string }).code ?? "desconocido";
        }
      };

      await como(null, "");
      bandeja.sinSesionInserta = await intentarDentro(() => insertar(admin.id));

      await como(otro.id, "trabajador");
      bandeja.suplantaInserta = await intentarDentro(() => insertar(admin.id));
      bandeja.propioInserta = await intentarDentro(() => insertar(otro.id));

      await como(admin.id, "admin");
      await insertar(admin.id);
      bandeja.adminVe = await cuantos();

      await como(otro.id, "trabajador");
      bandeja.otroVe = await cuantos();
      bandeja.otroActualiza = (
        await cliente.query(
          "UPDATE portal.correos_salida SET asunto = 'Tocado' WHERE para = 'prueba@permisos.test'",
        )
      ).rowCount;

      await como(null, "");
      bandeja.sinSesionVe = await cuantos();

      bandeja.borra = await intentarDentro(() =>
        cliente.query("DELETE FROM portal.correos_salida WHERE false"),
      );

      throw new Deshacer();
    });
  } catch (error) {
    if (!(error instanceof Deshacer)) throw error;
  }

  comprobar(
    "Sin sesion declarada no se puede escribir en la bandeja",
    bandeja.sinSesionInserta === DENEGADO,
    String(bandeja.sinSesionInserta),
  );
  comprobar(
    "Nadie deja un correo a nombre de otro",
    bandeja.suplantaInserta === DENEGADO && bandeja.propioInserta === null,
    `a nombre ajeno: ${bandeja.suplantaInserta}; al propio: aceptado`,
  );
  comprobar(
    "El administrador ve toda la bandeja",
    bandeja.adminVe === 2,
    `${bandeja.adminVe} de 2`,
  );
  comprobar(
    "Quien no es administrador solo alcanza lo que el mismo provoco",
    bandeja.otroVe === 1 && bandeja.otroActualiza === 1,
    `ve ${bandeja.otroVe}, actualiza ${bandeja.otroActualiza}`,
  );
  comprobar(
    "Sin sesion declarada la bandeja esta vacia",
    bandeja.sinSesionVe === 0,
    `${bandeja.sinSesionVe} filas`,
  );
  comprobar(
    "La aplicacion no puede borrar correos",
    bandeja.borra === DENEGADO,
    String(bandeja.borra),
  );

  // -------------------------------------- seguridad por fila: notificaciones
  const campana: Record<string, unknown> = {};

  try {
    await transaccion(async (cliente) => {
      const como = (id: number | null, rol: string) =>
        cliente.query(
          "SELECT set_config('app.usuario_id', $1, true), set_config('app.rol', $2, true)",
          [id === null ? "" : String(id), rol],
        );
      const notificar = (destinatario: number, href: string | null = "/dashboard") =>
        cliente.query(
          `INSERT INTO portal.notificaciones (usuario_id, tipo, titulo, href)
           VALUES ($1, 'prueba.permisos', 'Prueba de permisos', $2)`,
          [destinatario, href],
        );
      const cuantas = async () =>
        Number(
          (
            await cliente.query<{ n: string }>(
              "SELECT count(*)::text AS n FROM portal.notificaciones WHERE tipo = 'prueba.permisos'",
            )
          ).rows[0].n,
        );
      const intentarDentro = async (accion: () => Promise<unknown>) => {
        await cliente.query("SAVEPOINT intento");
        try {
          await accion();
          await cliente.query("RELEASE SAVEPOINT intento");
          return null;
        } catch (error) {
          await cliente.query("ROLLBACK TO SAVEPOINT intento");
          return (error as { code?: string }).code ?? "desconocido";
        }
      };

      await como(null, "");
      campana.sinSesionNotifica = await intentarDentro(() => notificar(admin.id));

      // Uno le notifica al otro, y dos veces a si mismo.
      await como(otro.id, "trabajador");
      await notificar(admin.id);
      await notificar(otro.id);
      await notificar(otro.id);
      campana.otroVe = await cuantas();
      campana.hrefExterno = await intentarDentro(() =>
        notificar(otro.id, "https://sitio.com/dashboard"),
      );
      campana.hrefFueraDelPanel = await intentarDentro(() => notificar(otro.id, "/login"));

      // Ni siquiera un administrador lee las de otra persona.
      await como(admin.id, "admin");
      campana.adminVe = await cuantas();
      campana.adminMarca = (
        await cliente.query(
          "UPDATE portal.notificaciones SET leida_en = now() WHERE tipo = 'prueba.permisos'",
        )
      ).rowCount;

      await como(otro.id, "trabajador");
      campana.otroSinLeer = Number(
        (
          await cliente.query<{ n: string }>(
            "SELECT count(*)::text AS n FROM portal.notificaciones WHERE tipo = 'prueba.permisos' AND leida_en IS NULL",
          )
        ).rows[0].n,
      );

      throw new Deshacer();
    });
  } catch (error) {
    if (!(error instanceof Deshacer)) throw error;
  }

  comprobar(
    "Sin sesion declarada no se puede notificar",
    campana.sinSesionNotifica === DENEGADO,
    String(campana.sinSesionNotifica),
  );
  comprobar(
    "Cada quien ve solo sus notificaciones",
    campana.otroVe === 2 && campana.adminVe === 1,
    `el trabajador ve ${campana.otroVe} de 3; el administrador, ${campana.adminVe}`,
  );
  comprobar(
    "Marcar como leidas no alcanza a las de otra persona",
    campana.adminMarca === 1 && campana.otroSinLeer === 2,
    `el administrador marco ${campana.adminMarca}; al otro le siguen ${campana.otroSinLeer} sin leer`,
  );
  comprobar(
    "Una notificacion no puede llevar fuera del panel",
    campana.hrefExterno === "23514" && campana.hrefFueraDelPanel === "23514",
    "enlace externo y ruta ajena al panel, rechazados",
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
