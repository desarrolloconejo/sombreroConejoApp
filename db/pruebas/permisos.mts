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
import * as asignaciones from "@/models/asignaciones";
import * as comentarios from "@/models/comentariosPieza";
import * as piezas from "@/models/piezas";
import * as proyectos from "@/models/proyectos";
import * as tareas from "@/models/tareas";

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

  // ---------------------------------------- seguridad por fila: las tasas
  const tasa: Record<string, unknown> = {};

  try {
    await transaccion(async (cliente) => {
      const como = (id: number | null, rol: string, cargo = "") =>
        cliente.query(
          `SELECT set_config('app.usuario_id', $1, true),
                  set_config('app.rol', $2, true),
                  set_config('app.cargo', $3, true)`,
          [id === null ? "" : String(id), rol, cargo],
        );
      // Una moneda que el BCV no publica, para no chocar con las reales.
      const registrar = (fecha: string) =>
        cliente.query(
          `INSERT INTO finanzas.tasas_cambio (fuente, moneda, fecha_valor, valor, origen)
           VALUES ('bcv', 'XXX', $1::date, 1.5, 'automatica')`,
          [fecha],
        );
      const cuantas = async () =>
        Number(
          (
            await cliente.query<{ n: string }>(
              "SELECT count(*)::text AS n FROM finanzas.tasas_cambio WHERE moneda = 'XXX'",
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

      await como(null, "sistema");
      tasa.sistemaEscribe = await intentarDentro(() => registrar("2001-01-01"));

      await como(otro.id, "trabajador", "redes");
      tasa.cualquieraEscribe = await intentarDentro(() => registrar("2001-01-02"));
      tasa.cualquieraLee = await cuantas();

      await como(otro.id, "trabajador", "administracion");
      tasa.administracionEscribe = await intentarDentro(() => registrar("2001-01-03"));

      await como(null, "");
      tasa.sinSesionLee = await cuantas();

      await como(admin.id, "admin");
      tasa.modifica = await intentarDentro(() =>
        cliente.query("UPDATE finanzas.tasas_cambio SET valor = 2 WHERE moneda = 'XXX'"),
      );
      tasa.borra = await intentarDentro(() =>
        cliente.query("DELETE FROM finanzas.tasas_cambio WHERE moneda = 'XXX'"),
      );
      tasa.repite = await intentarDentro(() => registrar("2001-01-01"));

      throw new Deshacer();
    });
  } catch (error) {
    if (!(error instanceof Deshacer)) throw error;
  }

  comprobar(
    "La tarea programada puede registrar una tasa",
    tasa.sistemaEscribe === null,
    "identidad sistema, aceptada",
  );
  comprobar(
    "Quien no opera finanzas no puede registrar tasas, pero las lee",
    tasa.cualquieraEscribe === DENEGADO && tasa.cualquieraLee === 1,
    `escribir: ${tasa.cualquieraEscribe}; lee ${tasa.cualquieraLee}`,
  );
  comprobar(
    "El cargo de administracion si puede registrarlas",
    tasa.administracionEscribe === null,
    "aceptada",
  );
  comprobar(
    "Sin sesion declarada no se ve ninguna tasa",
    tasa.sinSesionLee === 0,
    `${tasa.sinSesionLee} filas`,
  );
  comprobar(
    "Una tasa registrada no se modifica ni se borra",
    tasa.modifica === DENEGADO && tasa.borra === DENEGADO,
    "UPDATE y DELETE denegados, tambien al administrador",
  );
  comprobar(
    "No caben dos tasas de la misma moneda y fecha valor",
    tasa.repite === "23505",
    String(tasa.repite),
  );

  await probarProyectos();

  console.log(`\n${pasan}/${pasan + fallan.length} comprobaciones correctas`);
  if (fallan.length > 0) {
    console.error(`\nFallan: ${fallan.join(", ")}`);
    process.exitCode = 1;
  }
}

/**
 * Seguridad por fila de proyectos, piezas, fases y tareas.
 *
 * Usa los modelos de verdad, con la identidad cambiada a mano dentro de una
 * transaccion que se deshace: asi se prueba a la vez lo que la base deja y lo
 * que los modelos piden.
 */
async function probarProyectos(): Promise<void> {
  const idDe = async (email: string) => {
    const fila = await consultarUno<{ id: number; empresaId: number | null }>(
      `SELECT id, empresa_id AS "empresaId" FROM vw_usuarios_completos
       WHERE lower(email) = lower($1)`,
      [email],
    );
    if (!fila) throw new Error(`Falta ${email}: ejecuta npm run seed`);
    return fila;
  };

  const admin = await idDe("juanvivas043@gmail.com");
  const cuentas = await idDe("cuentas@conejo.test");
  const produccion = await idDe("pruebas@conejo.test");
  const disenador = await idDe("diseno@conejo.test");
  const clienteDemo = await idDe("cliente@empresa.test");

  const r: Record<string, unknown> = {};

  try {
    await transaccion(async (tx) => {
      const como = (
        id: number | null,
        rol: string,
        cargo = "",
        empresa: number | null = null,
      ) =>
        tx.query(
          `SELECT set_config('app.usuario_id', $1, true),
                  set_config('app.rol', $2, true),
                  set_config('app.cargo', $3, true),
                  set_config('app.empresa_id', $4, true)`,
          [id === null ? "" : String(id), rol, cargo, empresa === null ? "" : String(empresa)],
        );
      const intentarDentro = async (accion: () => Promise<unknown>) => {
        await tx.query("SAVEPOINT intento");
        try {
          await accion();
          await tx.query("RELEASE SAVEPOINT intento");
          return null;
        } catch (error) {
          await tx.query("ROLLBACK TO SAVEPOINT intento");
          return (error as { code?: string }).code ?? "desconocido";
        }
      };
      const cuenta = async (sql: string, valores: unknown[] = []) =>
        Number((await tx.query<{ n: string }>(sql, valores)).rows[0].n);

      const empresaA = clienteDemo.empresaId as number;

      // ---- El admin arma dos proyectos, en dos empresas. Antes quita la
      // asignacion de la semilla, para partir de cero.
      await como(admin.id, "admin", "direccion");
      await tx.query("DELETE FROM portal.asignaciones WHERE usuario_id = $1", [cuentas.id]);
      const { rows: otra } = await tx.query<{ id: number }>(
        `INSERT INTO empresas (nombre, rif) VALUES ('Empresa B de permisos', 'J-99999999-9')
         RETURNING id`,
      );
      const empresaB = otra[0].id;

      const datos = (empresaId: number, nombre: string) => ({
        empresaId,
        ejecutivoId: admin.id,
        servicio: "redes_sociales",
        tipo: "redes_sociales" as const,
        nombre,
      });
      const proyectoA = await proyectos.crear(datos(empresaA, "Permisos A"), admin.id, tx);
      const proyectoB = await proyectos.crear(datos(empresaB, "Permisos B"), admin.id, tx);
      const piezaA = await piezas.crear(proyectoA, { tipo: "post", titulo: "A1" }, admin.id, tx);
      const piezaA2 = await piezas.crear(proyectoA, { tipo: "post", titulo: "A2" }, admin.id, tx);
      const piezaB = await piezas.crear(proyectoB, { tipo: "post", titulo: "B1" }, admin.id, tx);
      const tarea = await tareas.crear(
        piezaA,
        { fase: 1, titulo: "Redactar", responsableId: produccion.id },
        admin.id,
        tx,
      );
      await comentarios.crear(piezaA, admin.id, "Comentario interno", tx);
      await piezas.guardarCopy(piezaA, "Copy secreto", admin.id, tx);

      r.fasesCreadas = await cuenta(
        "SELECT count(*)::text AS n FROM portal.pieza_fases WHERE pieza_id = $1",
        [piezaA],
      );
      r.unaEnCurso = await intentarDentro(() =>
        tx.query(
          "UPDATE portal.pieza_fases SET estado = 'en_curso' WHERE pieza_id = $1 AND fase = 2",
          [piezaA],
        ),
      );
      r.tareaEnControl = await intentarDentro(() =>
        tareas.crear(piezaA, { fase: 2 as 1, titulo: "No cabe" }, admin.id, tx),
      );

      const nuestros = "SELECT count(*)::text AS n FROM portal.proyectos WHERE nombre LIKE 'Permisos %'";

      // ---- Sin sesion declarada no hay nada.
      await como(null, "");
      r.sinSesion = await cuenta(nuestros);

      // ---- Un ejecutivo sin asignaciones no ve ni crea nada.
      await como(cuentas.id, "trabajador", "cuentas");
      r.cuentasSinAsignar = await cuenta(nuestros);
      r.cuentasCreaSinAsignar = await intentarDentro(() =>
        proyectos.crear(datos(empresaA, "Permisos X"), cuentas.id, tx),
      );

      // ---- El admin le asigna la empresa A.
      await como(admin.id, "admin", "direccion");
      await asignaciones.crear(cuentas.id, empresaA, admin.id, tx);

      await como(cuentas.id, "trabajador", "cuentas");
      r.cuentasVe = await cuenta(nuestros);
      r.cuentasCreaEnA = await intentarDentro(() =>
        piezas.crear(proyectoA, { tipo: "reel", titulo: "A3" }, cuentas.id, tx),
      );
      r.cuentasCreaEnB = await intentarDentro(() =>
        piezas.crear(proyectoB, { tipo: "reel", titulo: "B2" }, cuentas.id, tx),
      );
      r.cuentasAsigna = await intentarDentro(() =>
        asignaciones.crear(cuentas.id, empresaB, cuentas.id, tx),
      );

      // ---- Quien tiene una tarea ve solo esa pieza y solo marca lo suyo.
      await como(produccion.id, "trabajador", "produccion");
      r.prodProyectos = await cuenta(nuestros);
      r.prodPiezas = (await piezas.deProyecto(proyectoA, tx)).map((p) => p.titulo);
      r.prodCopy = await piezas.leerCopy(piezaA, tx);
      r.prodMueveFase = (
        await tx.query(
          "UPDATE portal.pieza_fases SET fecha_estimada = CURRENT_DATE WHERE pieza_id = $1",
          [piezaA],
        )
      ).rowCount;
      r.prodMarca = await tareas.marcarLista(tarea, produccion.id, tx);
      r.prodSeLaPasa = await intentarDentro(() =>
        tx.query("UPDATE portal.tareas SET responsable_id = $2 WHERE id = $1", [
          tarea,
          disenador.id,
        ]),
      );
      r.prodQuita = (await tx.query("DELETE FROM portal.tareas WHERE id = $1", [tarea])).rowCount;

      // ---- Quien no tiene nada que ver no ve nada.
      await como(disenador.id, "trabajador", "diseno");
      r.ajenoVe = await cuenta(nuestros);

      // ---- El cliente ve la bateria de su empresa, nunca las tareas.
      await como(clienteDemo.id, "cliente", "", empresaA);
      r.clienteProyectos = await cuenta(nuestros);
      r.clientePiezas = (await piezas.deProyecto(proyectoA, tx)).length;
      r.clienteTareas = (await tareas.dePieza(piezaA, tx)).length;
      r.clienteComentarios = (await comentarios.dePieza(piezaA, tx)).length;
      r.clienteCopyAntes = await piezas.leerCopy(piezaA, tx);
      r.clienteMueve = (
        await tx.query("UPDATE portal.piezas SET titulo = 'Tocado' WHERE id = $1", [piezaA])
      ).rowCount;

      // El admin lleva la pieza A1 a la fase 5: entonces el cliente lee el copy.
      await como(admin.id, "admin", "direccion");
      for (const fase of [1, 2, 3, 4] as const) {
        await piezas.completarFase(piezaA, fase, 1, admin.id, tx);
      }
      await como(clienteDemo.id, "cliente", "", empresaA);
      r.clienteCopyEnFase5 = await piezas.leerCopy(piezaA, tx);
      r.clienteCopyOtraPieza = await piezas.leerCopy(piezaA2, tx);

      // Un cliente de otra empresa no ve nada de la A.
      await como(clienteDemo.id, "cliente", "", empresaB);
      r.otroClienteVe = await cuenta(
        "SELECT count(*)::text AS n FROM portal.proyectos WHERE id = $1",
        [proyectoA],
      );

      // ---- Nadie borra proyectos ni piezas.
      await como(admin.id, "admin", "direccion");
      r.borraProyecto = await intentarDentro(() =>
        tx.query("DELETE FROM portal.proyectos WHERE id = $1", [proyectoA]),
      );
      r.borraPieza = await intentarDentro(() =>
        tx.query("DELETE FROM portal.piezas WHERE id = $1", [piezaB]),
      );
      r.quitaTareaLista = await tareas.quitar(tarea, tx);
      r.comentaComoOtro = await intentarDentro(() =>
        comentarios.crear(piezaA, cuentas.id, "Suplantado", tx),
      );

      throw new Deshacer();
    });
  } catch (error) {
    if (!(error instanceof Deshacer)) throw error;
  }

  comprobar("Cada pieza nace con sus cinco fases", r.fasesCreadas === 5, `${r.fasesCreadas}`);
  comprobar(
    "Una pieza no tiene dos fases en curso",
    r.unaEnCurso === "23505",
    String(r.unaEnCurso),
  );
  comprobar(
    "Las tareas solo caben en las fases 1 y 3",
    r.tareaEnControl === "23514",
    String(r.tareaEnControl),
  );
  comprobar("Sin sesion declarada no hay proyectos", r.sinSesion === 0, `${r.sinSesion}`);
  comprobar(
    "Un ejecutivo sin empresas asignadas no ve ni crea proyectos",
    r.cuentasSinAsignar === 0 && r.cuentasCreaSinAsignar === DENEGADO,
    `ve ${r.cuentasSinAsignar}; crear: ${r.cuentasCreaSinAsignar}`,
  );
  comprobar(
    "Con la empresa asignada ve sus proyectos y solo los suyos",
    r.cuentasVe === 1 && r.cuentasCreaEnA === null && r.cuentasCreaEnB === DENEGADO,
    `ve ${r.cuentasVe}; pieza en A: ${r.cuentasCreaEnA}; en B: ${r.cuentasCreaEnB}`,
  );
  comprobar(
    "Solo el admin asigna empresas",
    r.cuentasAsigna === DENEGADO,
    String(r.cuentasAsigna),
  );
  comprobar(
    "Quien tiene una tarea ve el proyecto y solo esa pieza",
    r.prodProyectos === 1 &&
      Array.isArray(r.prodPiezas) &&
      r.prodPiezas.join() === "A1" &&
      r.prodCopy === "Copy secreto",
    `proyectos ${r.prodProyectos}; piezas ${JSON.stringify(r.prodPiezas)}`,
  );
  comprobar(
    "Quien tiene una tarea no mueve fases",
    r.prodMueveFase === 0,
    `${r.prodMueveFase} filas`,
  );
  comprobar(
    "Marca su tarea, pero no se la pasa a otro ni la quita",
    r.prodMarca === true && r.prodSeLaPasa === DENEGADO && r.prodQuita === 0,
    `marca ${r.prodMarca}; pasarla: ${r.prodSeLaPasa}`,
  );
  comprobar("Quien no tiene trabajo en el proyecto no lo ve", r.ajenoVe === 0, `${r.ajenoVe}`);
  comprobar(
    "El cliente ve los proyectos y piezas de su empresa",
    r.clienteProyectos === 1 && r.clientePiezas === 3,
    `proyectos ${r.clienteProyectos}; piezas ${r.clientePiezas}`,
  );
  comprobar(
    "El cliente nunca ve tareas ni comentarios internos",
    r.clienteTareas === 0 && r.clienteComentarios === 0,
    `tareas ${r.clienteTareas}; comentarios ${r.clienteComentarios}`,
  );
  comprobar(
    "El cliente no lee el copy hasta la fase 5",
    r.clienteCopyAntes === null &&
      r.clienteCopyEnFase5 === "Copy secreto" &&
      r.clienteCopyOtraPieza === null,
    `antes ${r.clienteCopyAntes}; en fase 5 ${r.clienteCopyEnFase5}; otra pieza ${r.clienteCopyOtraPieza}`,
  );
  comprobar("El cliente no mueve piezas", r.clienteMueve === 0, `${r.clienteMueve} filas`);
  comprobar(
    "El cliente de otra empresa no ve los proyectos de la primera",
    r.otroClienteVe === 0,
    `${r.otroClienteVe}`,
  );
  comprobar(
    "Ni el admin borra proyectos ni piezas",
    r.borraProyecto === DENEGADO && r.borraPieza === DENEGADO,
    `proyecto ${r.borraProyecto}; pieza ${r.borraPieza}`,
  );
  comprobar(
    "Una tarea lista no se quita",
    r.quitaTareaLista === false,
    String(r.quitaTareaLista),
  );
  comprobar(
    "Nadie comenta a nombre de otro",
    r.comentaComoOtro === DENEGADO,
    String(r.comentaComoOtro),
  );
}

principal()
  .catch((error: unknown) => {
    console.error("\nFallo:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await obtenerPool().end();
  });
