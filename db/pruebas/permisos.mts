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
import * as ajustes from "@/models/ajustesFinanzas";
import * as comentarios from "@/models/comentariosPieza";
import * as correos from "@/models/correos";
import { importesDe } from "@/lib/finanzas/calculo";
import { codigoValido, congelar, formatoPor } from "@/lib/portal/briefs";
import { hashDelContenido } from "@/lib/portal/briefsHash";
import * as briefs from "@/models/briefs";
import * as enlaces from "@/models/enlacesBrief";
import * as facturas from "@/models/facturas";
import * as pagos from "@/models/pagos";
import * as piezas from "@/models/piezas";
import * as presupuestos from "@/models/presupuestos";
import * as proformas from "@/models/proformas";
import * as proyectos from "@/models/proyectos";
import * as renglones from "@/models/renglones";
import * as revisiones from "@/models/revisiones";
import * as tareas from "@/models/tareas";
import * as versiones from "@/models/versiones";
import type { RenglonNuevo, Respuestas } from "@/types";
import fixtureBrief from "../../tests/fixtures/brief-desarrollo-producto.json" with { type: "json" };

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
  await probarRevision();
  await probarFinanzas();
  await probarBriefs();
  await probarFacturas();
  await probarEstructura();

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
      r.siglaPropuesta = (
        await tx.query<{ sigla: string }>("SELECT sigla FROM empresas WHERE id = $1", [empresaB])
      ).rows[0].sigla;

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
      await comentarios.crear(piezaA, admin.id, "Comentario interno", { fase: null, tareaId: null }, tx);
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
      r.asignadoReasigna = await intentarDentro(() =>
        tx.query("UPDATE portal.proyectos SET ejecutivo_id = $2 WHERE id = $1", [proyectoA, cuentas.id]),
      );

      // ---- La excepcion por proyecto: el admin le da el proyecto B a cuentas,
      // que no tiene la empresa B. Gestiona ese proyecto y nada mas de B.
      await como(admin.id, "admin", "direccion");
      const proyectoB2 = await proyectos.crear(datos(empresaB, "Permisos B2"), admin.id, tx);
      r.adminReasigna = await intentarDentro(() =>
        tx.query("UPDATE portal.proyectos SET ejecutivo_id = $2 WHERE id = $1", [proyectoB, cuentas.id]),
      );

      await como(cuentas.id, "trabajador", "cuentas");
      r.otraCuentaVe = await cuenta(
        "SELECT count(*)::text AS n FROM portal.proyectos WHERE id = ANY($1::int[])",
        [[proyectoB, proyectoB2]],
      );
      r.otraCuentaPiezas = (await piezas.deProyecto(proyectoB, tx)).length;
      r.otraCuentaGestiona = await proyectos.gestiona(proyectoB, tx);
      r.otraCuentaCreaPieza = await intentarDentro(() =>
        piezas.crear(proyectoB, { tipo: "reel", titulo: "B3" }, cuentas.id, tx),
      );
      r.otraCuentaEmpresa = (
        await tx.query<{ gestiona: boolean }>("SELECT portal.gestiona_empresa($1) AS gestiona", [empresaB])
      ).rows[0].gestiona;
      r.otraCuentaSeLoPasa = await intentarDentro(() =>
        tx.query("UPDATE portal.proyectos SET ejecutivo_id = $2 WHERE id = $1", [proyectoB, disenador.id]),
      );

      // ---- Quien tiene una tarea ve solo esa pieza y solo marca lo suyo.
      await como(produccion.id, "trabajador", "produccion");
      r.prodProyectos = await cuenta(nuestros);
      r.prodPiezas = (await piezas.deProyecto(proyectoA, tx)).map((p) => p.titulo);
      // El orden de su pieza cuenta las dos del proyecto, aunque solo vea una;
      // de la otra no le dice nada.
      r.prodOrden = await piezas.ordenDeTipo(piezaA, tx);
      r.prodOrdenAjena = await cuenta("SELECT count(*)::text AS n FROM portal.orden_de_pieza($1)", [piezaA2]);
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
        comentarios.crear(piezaA, cuentas.id, "Suplantado", { fase: null, tareaId: null }, tx),
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
    "Solo un administrador cambia quien lleva un proyecto",
    r.asignadoReasigna === DENEGADO && r.adminReasigna === null && r.otraCuentaSeLoPasa === DENEGADO,
    `asignado: ${r.asignadoReasigna}; admin: ${r.adminReasigna}; el que lo lleva: ${r.otraCuentaSeLoPasa}`,
  );
  comprobar(
    "El ejecutivo de otra cuenta gestiona el proyecto que lleva y nada mas de esa empresa",
    r.otraCuentaVe === 1 &&
      r.otraCuentaPiezas === 1 &&
      r.otraCuentaGestiona === true &&
      r.otraCuentaCreaPieza === null &&
      r.otraCuentaEmpresa === false,
    `ve ${r.otraCuentaVe} de 2; piezas ${r.otraCuentaPiezas}; gestiona ${r.otraCuentaGestiona}; crea pieza: ${r.otraCuentaCreaPieza}; empresa: ${r.otraCuentaEmpresa}`,
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
    "El orden de una pieza entre las de su tipo cuenta todo el proyecto y solo se le da a quien la ve",
    JSON.stringify(r.prodOrden) === JSON.stringify({ numero: 1, total: 2 }) && r.prodOrdenAjena === 0,
    `su pieza ${JSON.stringify(r.prodOrden)}; la ajena: ${r.prodOrdenAjena} filas`,
  );
  comprobar(
    "Una empresa sin sigla recibe una propuesta de la base, recortada sin partir palabras",
    r.siglaPropuesta === "EMPRESA-B-DE",
    `sigla ${r.siglaPropuesta}`,
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

/**
 * La revision del cliente: que versiones ve segun la fase, quien puede
 * decidir y que la unica via del cliente sobre las fases solo haga lo que la
 * decision pide.
 */
async function probarRevision(): Promise<void> {
  const fila = async (email: string) => {
    const persona = await consultarUno<{ id: number; empresaId: number | null }>(
      `SELECT id, empresa_id AS "empresaId" FROM vw_usuarios_completos
       WHERE lower(email) = lower($1)`,
      [email],
    );
    if (!persona) throw new Error(`Falta ${email}: ejecuta npm run seed`);
    return persona;
  };

  const admin = await fila("juanvivas043@gmail.com");
  const cliente = await fila("cliente@empresa.test");
  const empresaA = cliente.empresaId as number;

  const r: Record<string, unknown> = {};

  try {
    await transaccion(async (tx) => {
      const como = (id: number, rol: string, cargo = "", empresa: number | null = null) =>
        tx.query(
          `SELECT set_config('app.usuario_id', $1, true), set_config('app.rol', $2, true),
                  set_config('app.cargo', $3, true), set_config('app.empresa_id', $4, true)`,
          [String(id), rol, cargo, empresa === null ? "" : String(empresa)],
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
      const comoAdmin = () => como(admin.id, "admin", "direccion");
      const comoCliente = (empresa = empresaA) => como(cliente.id, "cliente", "", empresa);

      // ---- Una pieza en la fase 3 con dos versiones; solo una se envia.
      await comoAdmin();
      await tx.query("UPDATE clientes SET puede_aprobar = false WHERE usuario_id = $1", [cliente.id]);
      const proyecto = await proyectos.crear(
        {
          empresaId: empresaA,
          ejecutivoId: admin.id,
          servicio: "redes_sociales",
          tipo: "redes_sociales",
          nombre: "Permisos revision",
        },
        admin.id,
        tx,
      );
      const pieza = await piezas.crear(proyecto, { tipo: "post", titulo: "R1" }, admin.id, tx);
      for (const fase of [1, 2] as const) await piezas.completarFase(pieza, fase, 1, admin.id, tx);

      const datosVersion = (nombre: string) => ({
        piezaId: pieza,
        ronda: 1,
        fase: 3 as const,
        origen: "enlace" as const,
        enlace: "https://www.figma.com/file/prueba",
        nombre,
      });
      const borrador = await versiones.crear(datosVersion("Borrador"), admin.id, tx);
      const buena = await versiones.crear(datosVersion("Buena"), admin.id, tx);
      await versiones.marcarEnviada(buena, pieza, 1, admin.id, tx);
      r.dosEnviadas = await intentarDentro(() =>
        tx.query("UPDATE portal.versiones SET enviada_en = now(), enviada_por = $2 WHERE id = $1", [
          borrador,
          admin.id,
        ]),
      );

      await comoCliente();
      r.antesDeFase5 = (await versiones.dePieza(pieza, tx)).length;
      r.clienteSube = await intentarDentro(() =>
        versiones.crear(datosVersion("Del cliente"), cliente.id, tx),
      );

      // ---- La pieza llega a la fase 5: el cliente ve solo la enviada.
      await comoAdmin();
      for (const fase of [3, 4] as const) await piezas.completarFase(pieza, fase, 1, admin.id, tx);

      await comoCliente();
      r.enFase5 = (await versiones.dePieza(pieza, tx)).map((v) => v.nombre);
      r.otraEmpresaVe = await (async () => {
        await comoCliente(empresaA + 100000);
        return (await versiones.dePieza(pieza, tx)).length;
      })();

      // ---- Sin el permiso de aprobar, no decide.
      await comoCliente();
      r.sinPermisoRevisa = await intentarDentro(() =>
        revisiones.crear(
          {
            piezaId: pieza,
            ronda: 1,
            aprobar: true,
            tipoCorreccion: null,
            comentario: null,
            fasesReabiertas: [],
            versionId: buena,
          },
          cliente.id,
          tx,
        ),
      );
      r.sinPermisoDecide = await intentarDentro(() =>
        revisiones.aplicarDecision(pieza, true, [], tx),
      );
      r.clienteMueveFases = (
        await tx.query("UPDATE portal.pieza_fases SET estado = 'completada' WHERE pieza_id = $1", [pieza])
      ).rowCount;

      // ---- Con el permiso: pide una correccion de redaccion.
      await comoAdmin();
      await tx.query("UPDATE clientes SET puede_aprobar = true WHERE usuario_id = $1", [cliente.id]);

      await comoCliente();
      r.rutaRara = await intentarDentro(() => revisiones.aplicarDecision(pieza, false, [5], tx));
      await revisiones.crear(
        {
          piezaId: pieza,
          ronda: 1,
          aprobar: false,
          tipoCorreccion: "redaccion",
          comentario: "Cambiar el copy",
          fasesReabiertas: [1, 2, 4, 5],
          versionId: buena,
        },
        cliente.id,
        tx,
      );
      r.rondaNueva = await revisiones.aplicarDecision(pieza, false, [1, 2, 4, 5], tx);

      await comoAdmin();
      const tras = await piezas.buscarPorId(pieza, tx);
      r.fasesTras = tras?.fases.map((f) => `${f.fase}:${f.estado}`).join(" ");
      r.rondaPieza = tras?.ronda;
      r.versionesTras = (await versiones.dePieza(pieza, tx)).length;

      await comoCliente();
      r.yaNoEspera = await intentarDentro(() => revisiones.aplicarDecision(pieza, true, [], tx));
      r.yaNoVe = (await versiones.dePieza(pieza, tx)).length;

      // ---- La ronda 2 llega a la fase 5: el cliente ve solo su version, no
      // la de la ronda 1, aunque tambien se le envio.
      await comoAdmin();
      for (const fase of [1, 2] as const) await piezas.completarFase(pieza, fase, 2, admin.id, tx);
      const segunda = await versiones.crear(
        { ...datosVersion("Ronda 2"), ronda: 2 },
        admin.id,
        tx,
      );
      await versiones.marcarEnviada(segunda, pieza, 2, admin.id, tx);
      await piezas.completarFase(pieza, 4, 2, admin.id, tx);

      await comoCliente();
      r.rondaDosVe = (await versiones.dePieza(pieza, tx)).map((v) => v.nombre).join(", ");

      // ---- Otra pieza llega a la fase 5 y el cliente la aprueba.
      await comoAdmin();
      const otra = await piezas.crear(proyecto, { tipo: "post", titulo: "R2" }, admin.id, tx);
      for (const fase of [1, 2, 3, 4] as const) await piezas.completarFase(otra, fase, 1, admin.id, tx);

      await comoCliente();
      await revisiones.crear(
        {
          piezaId: otra,
          ronda: 1,
          aprobar: true,
          tipoCorreccion: null,
          comentario: null,
          fasesReabiertas: [],
          versionId: null,
        },
        cliente.id,
        tx,
      );
      await revisiones.aplicarDecision(otra, true, [], tx);
      r.aprobada = (await piezas.buscarPorId(otra, tx))?.avance.aprobada;

      throw new Deshacer();
    });
  } catch (error) {
    if (!(error instanceof Deshacer)) throw error;
  }

  comprobar("Solo una version enviada por ronda", r.dosEnviadas === "23505", String(r.dosEnviadas));
  comprobar(
    "El cliente no ve versiones antes de la fase 5 ni puede subirlas",
    r.antesDeFase5 === 0 && r.clienteSube === DENEGADO,
    `ve ${r.antesDeFase5}; subir: ${r.clienteSube}`,
  );
  comprobar(
    "En la fase 5 el cliente ve solo la version enviada",
    Array.isArray(r.enFase5) && r.enFase5.join() === "Buena",
    JSON.stringify(r.enFase5),
  );
  comprobar("Un cliente de otra empresa no ve las versiones", r.otraEmpresaVe === 0, `${r.otraEmpresaVe}`);
  comprobar(
    "Sin el permiso de aprobar no se decide",
    r.sinPermisoRevisa === DENEGADO && r.sinPermisoDecide === DENEGADO,
    `revision: ${r.sinPermisoRevisa}; decision: ${r.sinPermisoDecide}`,
  );
  comprobar("El cliente no mueve fases por su cuenta", r.clienteMueveFases === 0, `${r.clienteMueveFases} filas`);
  comprobar(
    "Una ruta que se salta los controles se rechaza",
    r.rutaRara === "23514",
    String(r.rutaRara),
  );
  comprobar(
    "Corregir la redaccion reabre 1, 2, 4 y 5, conserva la 3 y sube la ronda",
    r.rondaNueva === 2 &&
      r.rondaPieza === 2 &&
      r.fasesTras === "1:en_curso 2:pendiente 3:completada 4:pendiente 5:pendiente",
    `ronda ${r.rondaNueva}; ${r.fasesTras}`,
  );
  comprobar(
    "Tras la correccion la pieza ya no espera decision y el cliente deja de ver la version",
    r.yaNoEspera === "23514" && r.yaNoVe === 0 && r.versionesTras === 2,
    `decidir: ${r.yaNoEspera}; ve ${r.yaNoVe}`,
  );
  comprobar(
    "En la ronda 2 el cliente ve solo la version de esa ronda",
    r.rondaDosVe === "Ronda 2",
    String(r.rondaDosVe),
  );
  comprobar("Aprobar completa la fase 5", r.aprobada === true, String(r.aprobada));
}

/**
 * Presupuestos y proformas (etapa 5): quien ve que, lo que el cliente no puede
 * tocar, lo que queda congelado y que la base calcula lo mismo que la vista
 * previa del editor.
 */
async function probarFinanzas(): Promise<void> {
  const fila = async (email: string) => {
    const persona = await consultarUno<{ id: number; empresaId: number | null }>(
      `SELECT id, empresa_id AS "empresaId" FROM vw_usuarios_completos
       WHERE lower(email) = lower($1)`,
      [email],
    );
    if (!persona) throw new Error(`Falta ${email}: ejecuta npm run seed`);
    return persona;
  };

  const admin = await fila("juanvivas043@gmail.com");
  const operador = await fila("finanzas@conejo.test");
  const cuentas = await fila("cuentas@conejo.test");
  const cliente = await fila("cliente@empresa.test");
  const empresaA = cliente.empresaId as number;

  const r: Record<string, unknown> = {};

  // Los casos con los que se compara la base con la vista previa.
  const CASOS: RenglonNuevo[][] = [
    [{ descripcion: "a", cantidad: "1", precioUnitario: "100", exento: false }],
    [
      { descripcion: "a", cantidad: "3", precioUnitario: "33.33", exento: false },
      { descripcion: "b", cantidad: "2.5", precioUnitario: "19.99", exento: true },
    ],
    [
      { descripcion: "a", cantidad: "1.005", precioUnitario: "1", exento: false },
      { descripcion: "b", cantidad: "0.333", precioUnitario: "0.10", exento: false },
      { descripcion: "c", cantidad: "0.125", precioUnitario: "0.20", exento: false },
    ],
    [
      { descripcion: "a", cantidad: "1", precioUnitario: "0.03", exento: false },
      { descripcion: "b", cantidad: "1", precioUnitario: "0.03", exento: false },
      { descripcion: "c", cantidad: "1", precioUnitario: "0.03", exento: false },
    ],
    [{ descripcion: "a", cantidad: "999.999", precioUnitario: "12345.67", exento: false }],
  ];

  try {
    await transaccion(async (tx) => {
      const como = (id: number, rol: string, cargo = "", empresa: number | null = null) =>
        tx.query(
          `SELECT set_config('app.usuario_id', $1, true), set_config('app.rol', $2, true),
                  set_config('app.cargo', $3, true), set_config('app.empresa_id', $4, true)`,
          [String(id), rol, cargo, empresa === null ? "" : String(empresa)],
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
      const comoAdmin = () => como(admin.id, "admin", "direccion");
      const comoOperador = () => como(operador.id, "trabajador", "administracion");
      const comoCliente = (empresa = empresaA) => como(cliente.id, "cliente", "", empresa);
      const cuantos = async () =>
        Number(
          (await tx.query<{ n: string }>("SELECT count(*)::text AS n FROM finanzas.presupuestos")).rows[0]
            .n,
        );
      const datos = (titulo: string) => ({
        empresaId: empresaA,
        proyectoId: null,
        titulo,
        validoHasta: "2099-12-31",
        notas: null,
      });

      // ---- La base calcula lo mismo que la vista previa.
      await comoOperador();
      const coincidencias: string[] = [];
      for (const [i, caso] of CASOS.entries()) {
        const id = await presupuestos.crear(datos(`Calculo ${i}`), operador.id, tx);
        await renglones.guardar("presupuesto", id, caso, tx);
        const guardado = await presupuestos.buscarPorId(id, tx);
        const previo = importesDe(caso);
        const igual =
          guardado?.baseImponible === previo.baseImponible &&
          guardado.montoExento === previo.montoExento &&
          guardado.ivaMonto === previo.ivaMonto &&
          guardado.total === previo.total;
        coincidencias.push(igual ? "si" : `NO (${guardado?.total} vs ${previo.total})`);
      }
      r.calculo = coincidencias.join(", ");

      // ---- Numeracion consecutiva.
      const uno = await presupuestos.crear(datos("Numero 1"), operador.id, tx);
      const dos = await presupuestos.crear(datos("Numero 2"), operador.id, tx);
      const n1 = (await presupuestos.buscarPorId(uno, tx))?.numero ?? 0;
      const n2 = (await presupuestos.buscarPorId(dos, tx))?.numero ?? 0;
      r.consecutivos = n2 === n1 + 1;
      r.leeSecuencias = await intentarDentro(() => tx.query("SELECT * FROM finanzas.secuencias"));

      // ---- Un borrador con renglones, que se envia.
      const enviado = await presupuestos.crear(datos("Para el cliente"), operador.id, tx);
      await renglones.guardar("presupuesto", enviado, CASOS[0], tx);
      const borrador = await presupuestos.crear(datos("Sigue en borrador"), operador.id, tx);
      await renglones.guardar("presupuesto", borrador, CASOS[0], tx);
      r.enviaSinRenglones = await presupuestos.enviar(dos, operador.id, tx);
      r.envia = await presupuestos.enviar(enviado, operador.id, tx);

      // Fuera de borrador nada cambia de importes ni de renglones.
      r.renglonesTrasEnviar = await intentarDentro(() =>
        renglones.guardar("presupuesto", enviado, CASOS[1], tx),
      );
      r.totalTrasEnviar = await intentarDentro(() =>
        tx.query("UPDATE finanzas.presupuestos SET total = total + 1 WHERE id = $1", [enviado]),
      );
      r.vuelveABorrador = await intentarDentro(() =>
        tx.query(
          "UPDATE finanzas.presupuestos SET estado = 'borrador', enviado_en = NULL, enviado_por = NULL WHERE id = $1",
          [enviado],
        ),
      );

      // Nada se borra, y los renglones solo se escriben por su funcion.
      r.borra = await intentarDentro(() =>
        tx.query("DELETE FROM finanzas.presupuestos WHERE id = $1", [borrador]),
      );
      r.escribeRenglon = await intentarDentro(() =>
        tx.query(
          `INSERT INTO finanzas.documento_items
             (presupuesto_id, orden, descripcion, cantidad, precio_unitario, subtotal)
           VALUES ($1, 9, 'x', 1, 1, 1)`,
          [borrador],
        ),
      );

      // ---- Quien ve que.
      await comoCliente();
      const conPermiso = await presupuestos.porAprobar(tx);
      r.clienteVe = conPermiso.map((p) => p.titulo).includes("Para el cliente");
      r.clienteVeBorrador = (await presupuestos.buscarPorId(borrador, tx)) !== null;
      r.clienteLeeRenglones = (await renglones.deDocumento("presupuesto", enviado, tx)).length;
      r.clienteRenglonesBorrador = (await renglones.deDocumento("presupuesto", borrador, tx)).length;

      await comoCliente(empresaA + 100000);
      r.otraEmpresaVe = await cuantos();

      await como(cuentas.id, "trabajador", "cuentas");
      r.ejecutivoVe = await cuantos();

      await comoAdmin();
      await tx.query("UPDATE clientes SET puede_ver_finanzas = false WHERE usuario_id = $1", [cliente.id]);
      await comoCliente();
      r.sinPermisoVe = await cuantos();
      r.sinPermisoResuelve = await intentarDentro(() =>
        presupuestos.resolverComoCliente(enviado, true, null, tx),
      );
      await comoAdmin();
      await tx.query("UPDATE clientes SET puede_ver_finanzas = true WHERE usuario_id = $1", [cliente.id]);

      // ---- El cliente no escribe: ni montos, ni presupuestos nuevos.
      await comoCliente();
      r.clienteCambiaMontos = (
        await tx.query("UPDATE finanzas.presupuestos SET total = 1 WHERE id = $1", [enviado])
      ).rowCount;
      r.clienteCrea = await intentarDentro(() =>
        presupuestos.crear(datos("Del cliente"), cliente.id, tx),
      );

      // Rechazar exige motivo; aprobar, una sola vez.
      r.rechazaSinMotivo = await intentarDentro(() =>
        presupuestos.resolverComoCliente(enviado, false, "  ", tx),
      );
      r.aprueba = await intentarDentro(() => presupuestos.resolverComoCliente(enviado, true, null, tx));
      r.apruebaDosVeces = await intentarDentro(() =>
        presupuestos.resolverComoCliente(enviado, true, null, tx),
      );

      // Un enviado vencido ya no se resuelve.
      await comoOperador();
      const vencido = await presupuestos.crear(datos("Vencido"), operador.id, tx);
      await renglones.guardar("presupuesto", vencido, CASOS[0], tx);
      await presupuestos.enviar(vencido, operador.id, tx);
      await tx.query(
        "UPDATE finanzas.presupuestos SET valido_hasta = finanzas.hoy() - 1 WHERE id = $1",
        [vencido],
      );
      await comoCliente();
      r.apruebaVencido = await intentarDentro(() =>
        presupuestos.resolverComoCliente(vencido, true, null, tx),
      );

      // ---- La proforma: una sola por presupuesto aprobado.
      await comoOperador();
      r.proformaDeBorrador = await intentarDentro(() => proformas.desde("presupuesto", borrador, tx));
      const proforma = await proformas.desde("presupuesto", enviado, tx);
      const copia = await proformas.buscarPorId(proforma, tx);
      r.proformaCopiaImportes = copia?.total === (await presupuestos.buscarPorId(enviado, tx))?.total;
      r.proformaDoble = await intentarDentro(() => proformas.desde("presupuesto", enviado, tx));

      // Sus proyectos, solo de su empresa. Quien opera finanzas los ve para
      // poder ligarlos, aunque no gestione ninguna empresa.
      await comoAdmin();
      const otraEmpresa = (
        await tx.query<{ id: number }>(
          "INSERT INTO empresas (nombre) VALUES ($1) RETURNING id",
          ["Permisos finanzas"],
        )
      ).rows[0].id;
      const ajeno = await proyectos.crear(
        {
          empresaId: otraEmpresa,
          ejecutivoId: admin.id,
          servicio: "redes_sociales",
          tipo: "redes_sociales",
          nombre: "Ajeno",
        },
        admin.id,
        tx,
      );
      await comoOperador();
      const propios = await proformas.proyectosLigables(empresaA, tx);
      r.operadorVeProyectos = propios.length;
      r.ligaAjeno = await intentarDentro(() => proformas.ligarProyectos(proforma, [ajeno], tx));
      if (propios.length > 0) await proformas.ligarProyectos(proforma, [propios[0].id], tx);
      r.ligados = (await proformas.proyectosDe(proforma, tx)).length;

      // El cliente no ve la proforma en borrador; emitida, si.
      await comoCliente();
      r.clienteVeProformaBorrador = (await proformas.buscarPorId(proforma, tx)) !== null;
      await comoOperador();
      r.emite = await proformas.emitir(proforma, operador.id, tx);
      await comoCliente();
      r.clienteVeProformaEmitida = (await proformas.buscarPorId(proforma, tx)) !== null;

      // Recurrente: preparar la siguiente copia y adelanta un mes.
      await comoOperador();
      await proformas.cambiarRecurrencia(proforma, true, "2026-01-15", tx);
      const siguiente = await proformas.desde("recurrente", proforma, tx);
      const tras = await proformas.buscarPorId(proforma, tx);
      const nueva = await proformas.buscarPorId(siguiente, tx);
      r.recurrente =
        tras?.proximaEmision === "2026-02-15" &&
        nueva?.estado === "borrador" &&
        nueva.origenId === proforma &&
        nueva.total === copia?.total;

      // Anular exige motivo; una anulada no vuelve.
      r.anulaSinMotivo = await intentarDentro(() => proformas.anular(siguiente, " ", operador.id, tx));
      r.anula = await proformas.anular(siguiente, "Duplicada", operador.id, tx);
      r.reactiva = await intentarDentro(() =>
        tx.query("UPDATE finanzas.proformas SET estado = 'emitida' WHERE id = $1", [siguiente]),
      );

      throw new Deshacer();
    });
  } catch (error) {
    if (!(error instanceof Deshacer)) throw error;
  }

  console.log("\nFinanzas: presupuestos y proformas\n");

  comprobar("La base calcula lo mismo que la vista previa", !String(r.calculo).includes("NO"), String(r.calculo));
  comprobar("Los numeros son consecutivos", r.consecutivos === true, String(r.consecutivos));
  comprobar("Nadie lee los contadores directamente", r.leeSecuencias === DENEGADO, String(r.leeSecuencias));
  comprobar(
    "No se envia un presupuesto sin renglones",
    r.enviaSinRenglones === false && r.envia === true,
    `sin renglones: ${r.enviaSinRenglones}; con renglones: ${r.envia}`,
  );
  comprobar(
    "Enviado, no cambian sus renglones ni sus importes",
    r.renglonesTrasEnviar === "23514" && r.totalTrasEnviar === "23514",
    `renglones: ${r.renglonesTrasEnviar}; total: ${r.totalTrasEnviar}`,
  );
  comprobar("Un enviado no vuelve a borrador", r.vuelveABorrador === "23514", String(r.vuelveABorrador));
  comprobar(
    "La aplicacion no borra presupuestos ni escribe renglones por su cuenta",
    r.borra === DENEGADO && r.escribeRenglon === DENEGADO,
    `DELETE: ${r.borra}; INSERT renglon: ${r.escribeRenglon}`,
  );
  comprobar(
    "El cliente con permiso ve lo enviado de su empresa y sus renglones",
    r.clienteVe === true && Number(r.clienteLeeRenglones) > 0,
    `ve: ${r.clienteVe}; renglones: ${r.clienteLeeRenglones}`,
  );
  comprobar(
    "El cliente no ve borradores ni sus renglones",
    r.clienteVeBorrador === false && r.clienteRenglonesBorrador === 0,
    `borrador: ${r.clienteVeBorrador}; renglones: ${r.clienteRenglonesBorrador}`,
  );
  comprobar("Un cliente de otra empresa no ve nada", r.otraEmpresaVe === 0, `${r.otraEmpresaVe}`);
  comprobar("Un ejecutivo de cuentas no ve finanzas", r.ejecutivoVe === 0, `${r.ejecutivoVe}`);
  comprobar(
    "Sin el permiso de finanzas, el cliente no ve ni decide",
    r.sinPermisoVe === 0 && r.sinPermisoResuelve === DENEGADO,
    `ve ${r.sinPermisoVe}; decide: ${r.sinPermisoResuelve}`,
  );
  comprobar(
    "El cliente no cambia montos ni crea presupuestos",
    r.clienteCambiaMontos === 0 && r.clienteCrea === DENEGADO,
    `UPDATE: ${r.clienteCambiaMontos} filas; INSERT: ${r.clienteCrea}`,
  );
  comprobar(
    "Rechazar exige motivo; aprobar va una sola vez",
    r.rechazaSinMotivo === "23514" && r.aprueba === null && r.apruebaDosVeces === "23514",
    `sin motivo: ${r.rechazaSinMotivo}; aprueba: ${r.aprueba}; otra vez: ${r.apruebaDosVeces}`,
  );
  comprobar("Un presupuesto vencido ya no se aprueba", r.apruebaVencido === "23514", String(r.apruebaVencido));
  comprobar(
    "La proforma sale solo de un aprobado, una vez, con sus importes",
    r.proformaDeBorrador === "23514" && r.proformaCopiaImportes === true && r.proformaDoble === "23505",
    `de borrador: ${r.proformaDeBorrador}; importes: ${r.proformaCopiaImportes}; doble: ${r.proformaDoble}`,
  );
  comprobar(
    "Una proforma solo se liga a proyectos de su empresa",
    Number(r.operadorVeProyectos) > 0 && r.ligaAjeno === "23514" && r.ligados === 1,
    `ve ${r.operadorVeProyectos} proyectos; ajeno: ${r.ligaAjeno}; ligados: ${r.ligados}`,
  );
  comprobar(
    "El cliente ve la proforma emitida, no la de borrador",
    r.clienteVeProformaBorrador === false && r.emite === true && r.clienteVeProformaEmitida === true,
    `borrador: ${r.clienteVeProformaBorrador}; emitida: ${r.clienteVeProformaEmitida}`,
  );
  comprobar(
    "La recurrente prepara su copia en borrador y adelanta un mes",
    r.recurrente === true,
    String(r.recurrente),
  );
  comprobar(
    "Anular exige motivo y una anulada no se reactiva",
    r.anulaSinMotivo === "23514" && r.anula === true && r.reactiva === "23514",
    `sin motivo: ${r.anulaSinMotivo}; reactiva: ${r.reactiva}`,
  );
}

/**
 * Briefs (etapa 6): quien llena, quien ve y quien decide; la version enviada
 * inmutable, el codigo que no cambia, la fecha aspirada y el prospecto
 * encerrado en su enlace.
 */
async function probarBriefs(): Promise<void> {
  const fila = async (email: string) => {
    const persona = await consultarUno<{ id: number; empresaId: number | null }>(
      `SELECT id, empresa_id AS "empresaId" FROM vw_usuarios_completos
       WHERE lower(email) = lower($1)`,
      [email],
    );
    if (!persona) throw new Error(`Falta ${email}: ejecuta npm run seed`);
    return persona;
  };

  const admin = await fila("juanvivas043@gmail.com");
  const cuentas = await fila("cuentas@conejo.test");
  const produccion = await fila("pruebas@conejo.test");
  const operador = await fila("finanzas@conejo.test");
  const cliente = await fila("cliente@empresa.test");
  const empresaA = cliente.empresaId as number;

  const r: Record<string, unknown> = {};
  const formato = formatoPor("desarrollo-producto", 1)!;
  const respuestas = fixtureBrief.entrada.respuestas as Respuestas;

  try {
    await transaccion(async (tx) => {
      const como = (id: number | null, rol: string, cargo = "", empresa: number | null = null, enlace: number | null = null) =>
        tx.query(
          `SELECT set_config('app.usuario_id', $1, true), set_config('app.rol', $2, true),
                  set_config('app.cargo', $3, true), set_config('app.empresa_id', $4, true),
                  set_config('app.enlace_id', $5, true)`,
          [id === null ? "" : String(id), rol, cargo, empresa === null ? "" : String(empresa), enlace === null ? "" : String(enlace)],
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
      const cuantos = async () =>
        Number((await tx.query<{ n: string }>("SELECT count(*)::text AS n FROM portal.briefs")).rows[0].n);
      const comoCliente = (empresa = empresaA) => como(cliente.id, "cliente", "", empresa);
      const contenido = congelar(formato, respuestas, "Maria Gomez");
      const datosEnvio = (fecha: string) => ({
        contenido,
        sha256: hashDelContenido(contenido),
        respuestas,
        fechaAspirada: fecha,
        nombre: "Maria Gomez",
      });

      // ---- El cliente abre un brief de su empresa y lo envia.
      await comoCliente();
      const id = await briefs.crear(
        {
          formato: "desarrollo-producto",
          formatoVersion: 1,
          empresaId: empresaA,
          prospectoId: null,
          enlaceId: null,
          creadoPor: cliente.id,
          respuestas: {},
        },
        tx,
      );
      await briefs.guardarBorrador(id, { respuestas, fechaAspirada: "2099-01-01", autores: {} }, tx);
      r.otraEmpresaCrea = await intentarDentro(() =>
        briefs.crear(
          { formato: "desarrollo-producto", formatoVersion: 1, empresaId: empresaA + 100000, prospectoId: null, enlaceId: null, creadoPor: cliente.id, respuestas: {} },
          tx,
        ),
      );

      // Un ejecutivo de la empresa no ve el borrador en su bandeja, pero la
      // politica si lo deja ver; produccion no ve nada.
      await como(produccion.id, "trabajador", "produccion");
      r.produccionVe = await cuantos();
      await como(operador.id, "trabajador", "administracion");
      r.operadorVeBorrador = (await briefs.buscarPorId(id, tx)) !== null;

      // Fecha aspirada en el pasado: no se envia.
      await comoCliente();
      r.fechaPasada = await intentarDentro(() => briefs.enviar(id, datosEnvio("2020-01-01"), tx));
      const envio = await briefs.enviar(id, datosEnvio("2099-01-01"), tx);
      r.codigo = envio.codigo;
      r.numero = envio.numero;
      const enviado = await briefs.buscarPorId(id, tx);
      r.estado = enviado?.estado;

      // El cliente no decide ni toca la version enviada.
      r.clienteDecide = (
        await tx.query("UPDATE portal.briefs SET estado = 'descartado', motivo_descarte = 'x' WHERE id = $1", [id])
      ).rowCount;
      r.editaVersion = await intentarDentro(() =>
        tx.query("UPDATE portal.brief_versiones SET contenido_sha256 = repeat('0', 64) WHERE brief_id = $1", [id]),
      );
      r.borraVersion = await intentarDentro(() =>
        tx.query("DELETE FROM portal.brief_versiones WHERE brief_id = $1", [id]),
      );
      r.reenviaSinAbrir = await intentarDentro(() => briefs.enviar(id, datosEnvio("2099-01-01"), tx));

      // Otra empresa no lo ve.
      await comoCliente(empresaA + 100000);
      r.otraEmpresaVe = await cuantos();

      // Quien opera finanzas lo ve una vez enviado; el ejecutivo de la
      // empresa tambien, y decide.
      await como(operador.id, "trabajador", "administracion");
      r.operadorVeEnviado = (await briefs.buscarPorId(id, tx)) !== null;
      await como(cuentas.id, "trabajador", "cuentas");
      r.ejecutivoVe = (await briefs.buscarPorId(id, tx)) !== null;
      r.descartaSinMotivo = await intentarDentro(() =>
        tx.query("UPDATE portal.briefs SET estado = 'descartado' WHERE id = $1", [id]),
      );
      r.cambiaCodigo = await intentarDentro(() =>
        tx.query("UPDATE portal.briefs SET codigo = 'ECS-20200101-AAAAAA' WHERE id = $1", [id]),
      );

      // ---- Version 2: mismo codigo, otro numero, la fecha de envio no cambia.
      await comoCliente();
      await briefs.abrirVersion(id, tx);
      const v2 = await briefs.enviar(id, datosEnvio("2099-02-01"), tx);
      const tras = await briefs.buscarPorId(id, tx);
      r.version2 =
        v2.codigo === envio.codigo &&
        v2.numero === 2 &&
        tras?.enviadoEn?.getTime() === enviado?.enviadoEn?.getTime() &&
        tras?.fechaAspirada === "2099-02-01";

      // Aclaraciones: el cliente escribe a su nombre, no como equipo.
      r.aclaraCliente = await intentarDentro(() =>
        briefs.aclarar(id, { autorId: cliente.id, autorNombre: "Maria", delEquipo: false, texto: "Hola" }, tx),
      );
      r.aclaraComoEquipo = await intentarDentro(() =>
        briefs.aclarar(id, { autorId: cliente.id, autorNombre: "Maria", delEquipo: true, texto: "Hola" }, tx),
      );

      // ---- Un prospecto: solo su brief, por su enlace.
      await como(cuentas.id, "trabajador", "cuentas");
      const prospecto = await enlaces.crearProspecto(
        { empresaNombre: "Prospecto de prueba", contactoNombre: "Pedro", email: "pedro@prospecto.test", telefono: null },
        cuentas.id,
        tx,
      );
      const hash = "a".repeat(64);
      const enlace = await enlaces.crear(
        { tokenHash: hash, prospectoId: prospecto, formato: "desarrollo-producto", formatoVersion: 1, dias: 7 },
        cuentas.id,
        tx,
      );
      await como(null, "");
      r.porToken = (await enlaces.porToken(hash, tx))?.id === enlace;
      r.porTokenFalso = await enlaces.porToken("b".repeat(64), tx);

      await como(null, "prospecto", "", null, enlace);
      const deProspecto = await briefs.crear(
        { formato: "desarrollo-producto", formatoVersion: 1, empresaId: null, prospectoId: prospecto, enlaceId: enlace, creadoPor: null, respuestas: {} },
        tx,
      );
      r.prospectoVe = await cuantos();
      r.prospectoOtroEnlace = await intentarDentro(() =>
        briefs.crear(
          { formato: "desarrollo-producto", formatoVersion: 1, empresaId: null, prospectoId: prospecto, enlaceId: enlace + 1000, creadoPor: null, respuestas: {} },
          tx,
        ),
      );
      await briefs.guardarBorrador(deProspecto, { respuestas, fechaAspirada: "2099-01-01", autores: {} }, tx);
      const envioProspecto = await briefs.enviar(deProspecto, datosEnvio("2099-01-01"), tx);
      r.prospectoEnvia = codigoValido(envioProspecto.codigo);

      // Deja su rastro sin usuario: la campana de quien lo atiende y su copia
      // por correo, que lleva su enlace y solo el puede leer y anotar.
      r.prospectoNotifica = await intentarDentro(() =>
        tx.query(
          "INSERT INTO portal.notificaciones (usuario_id, tipo, titulo) VALUES ($1, 'brief.enviado', 'Brief nuevo')",
          [cuentas.id],
        ),
      );
      const copia = await correos.registrar(
        { para: "pedro@prospecto.test", tipo: "brief_enviado", asunto: "Tu brief", cuerpo: "Copia" },
        { modo: "simulado", estado: "simulado", creadoPor: null },
        tx,
      );
      r.prospectoLeeSuCorreo = (await correos.paraEntregar(copia, tx)) !== null;
      r.prospectoCorreoAjeno = await intentarDentro(() =>
        tx.query(
          `INSERT INTO portal.correos_salida (para, tipo, asunto, cuerpo, modo, estado, enlace_id)
           VALUES ('x@y.test', 'brief_enviado', 'x', 'x', 'simulado', 'simulado', $1)`,
          [enlace + 1000],
        ),
      );
      r.prospectoNoLeeNotificaciones = Number(
        (await tx.query<{ n: string }>("SELECT count(*)::text AS n FROM portal.notificaciones")).rows[0].n,
      );
      await como(null, "prospecto", "", null, enlace + 1000);
      r.otroEnlaceLeeCorreo = await correos.paraEntregar(copia, tx);
      r.otroEnlaceVe = await cuantos();

      // Quien genero el enlace lo ve y lo convierte: nace la empresa y queda asignado.
      await como(cuentas.id, "trabajador", "cuentas");
      r.creadorVe = (await briefs.buscarPorId(deProspecto, tx)) !== null;
      const nuevaEmpresa = await briefs.convertirProspecto(deProspecto, tx);
      r.convertido =
        (await briefs.buscarPorId(deProspecto, tx))?.empresaId === nuevaEmpresa &&
        (await tx.query("SELECT 1 FROM portal.asignaciones WHERE usuario_id = $1 AND empresa_id = $2", [cuentas.id, nuevaEmpresa])).rowCount === 1;

      // Un enlace vencido ya no sirve.
      await como(admin.id, "admin", "direccion");
      await tx.query("UPDATE portal.enlaces_brief SET vence_en = now() - interval '1 minute' WHERE id = $1", [enlace]);
      await como(null, "");
      r.vencido = await enlaces.porToken(hash, tx);

      throw new Deshacer();
    });
  } catch (error) {
    if (!(error instanceof Deshacer)) throw error;
  }

  console.log("\nBriefs\n");

  comprobar(
    "El prospecto avisa y encola su copia; no lee la campana ni correos ajenos",
    r.prospectoNotifica === null &&
      r.prospectoLeeSuCorreo === true &&
      r.prospectoCorreoAjeno === DENEGADO &&
      r.prospectoNoLeeNotificaciones === 0 &&
      r.otroEnlaceLeeCorreo === null &&
      r.otroEnlaceVe === 0,
    `avisa: ${r.prospectoNotifica}; lee su correo: ${r.prospectoLeeSuCorreo}; correo ajeno: ${r.prospectoCorreoAjeno}; campana: ${r.prospectoNoLeeNotificaciones}; otro enlace: ${r.otroEnlaceLeeCorreo}/${r.otroEnlaceVe}`,
  );
  comprobar(
    "El cliente abre briefs de su empresa, no de otra",
    r.otraEmpresaCrea === DENEGADO,
    String(r.otraEmpresaCrea),
  );
  comprobar(
    "Produccion no ve briefs; finanzas no ve borradores",
    r.produccionVe === 0 && r.operadorVeBorrador === false,
    `produccion ${r.produccionVe}; finanzas ${r.operadorVeBorrador}`,
  );
  comprobar("No se envia con la fecha aspirada en el pasado", r.fechaPasada === "23514", String(r.fechaPasada));
  comprobar(
    "Al enviar, la base pone el codigo y la version 1",
    codigoValido(String(r.codigo)) && r.numero === 1 && r.estado === "enviado",
    `${r.codigo}; version ${r.numero}; ${r.estado}`,
  );
  comprobar(
    "El cliente no decide sobre su brief",
    r.clienteDecide === 0,
    `${r.clienteDecide} filas`,
  );
  comprobar(
    "Una version enviada no se modifica ni se borra",
    r.editaVersion === DENEGADO && r.borraVersion === DENEGADO,
    `UPDATE: ${r.editaVersion}; DELETE: ${r.borraVersion}`,
  );
  comprobar("No se reenvia sin abrir una version nueva", r.reenviaSinAbrir === "23514", String(r.reenviaSinAbrir));
  comprobar("Otra empresa no ve el brief", r.otraEmpresaVe === 0, `${r.otraEmpresaVe}`);
  comprobar(
    "El ejecutivo de la empresa y finanzas lo ven una vez enviado",
    r.ejecutivoVe === true && r.operadorVeEnviado === true,
    `ejecutivo ${r.ejecutivoVe}; finanzas ${r.operadorVeEnviado}`,
  );
  comprobar(
    "Descartar exige motivo y el codigo no cambia",
    r.descartaSinMotivo === "23514" && r.cambiaCodigo === "23514",
    `descartar: ${r.descartaSinMotivo}; codigo: ${r.cambiaCodigo}`,
  );
  comprobar(
    "La version 2 conserva el codigo y la fecha del primer envio",
    r.version2 === true,
    String(r.version2),
  );
  comprobar(
    "En las aclaraciones el cliente escribe a su nombre, no como equipo",
    r.aclaraCliente === null && r.aclaraComoEquipo === DENEGADO,
    `cliente: ${r.aclaraCliente}; como equipo: ${r.aclaraComoEquipo}`,
  );
  comprobar(
    "El token lleva a su enlace; uno falso, a nada",
    r.porToken === true && r.porTokenFalso === null,
    `${r.porToken}; falso: ${r.porTokenFalso}`,
  );
  comprobar(
    "El prospecto solo ve y abre el brief de su enlace",
    r.prospectoVe === 1 && r.prospectoOtroEnlace === DENEGADO,
    `ve ${r.prospectoVe}; otro enlace: ${r.prospectoOtroEnlace}`,
  );
  comprobar("El prospecto envia su brief", r.prospectoEnvia === true, String(r.prospectoEnvia));
  comprobar(
    "Quien genero el enlace lo ve y al convertirlo nace la empresa, asignada a el",
    r.creadorVe === true && r.convertido === true,
    `ve ${r.creadorVe}; convertido ${r.convertido}`,
  );
  comprobar("Un enlace vencido ya no sirve", r.vencido === null, String(r.vencido));
}

principal()
  .catch((error: unknown) => {
    console.error("\nFallo:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await obtenerPool().end();
  });

async function probarFacturas(): Promise<void> {
  const fila = async (email: string) => {
    const persona = await consultarUno<{ id: number; empresaId: number | null }>(
      `SELECT id, empresa_id AS "empresaId" FROM vw_usuarios_completos
       WHERE lower(email) = lower($1)`,
      [email],
    );
    if (!persona) throw new Error(`Falta ${email}: ejecuta npm run seed`);
    return persona;
  };

  const operador = await fila("finanzas@conejo.test");
  const cuentas = await fila("cuentas@conejo.test");
  const cliente = await fila("cliente@empresa.test");
  const empresaA = cliente.empresaId as number;

  const r: Record<string, unknown> = {};

  try {
    await transaccion(async (tx) => {
      const como = (id: number, rol: string, cargo = "", empresa: number | null = null) =>
        tx.query(
          `SELECT set_config('app.usuario_id', $1, true), set_config('app.rol', $2, true),
                  set_config('app.cargo', $3, true), set_config('app.empresa_id', $4, true)`,
          [String(id), rol, cargo, empresa === null ? "" : String(empresa)],
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
      const comoOperador = () => como(operador.id, "trabajador", "administracion");
      const comoCliente = (empresa = empresaA) => como(cliente.id, "cliente", "", empresa);
      const cuantas = async () =>
        Number((await tx.query<{ n: string }>("SELECT count(*)::text AS n FROM finanzas.facturas")).rows[0].n);

      // ---- El operador prepara: emisor, tasa del dia y una proforma emitida.
      await comoOperador();
      const proforma = (
        await tx.query<{ id: number }>(
          `SELECT p.id FROM finanzas.proformas p
           WHERE p.estado = 'emitida' AND p.empresa_id = $1
             AND EXISTS (SELECT 1 FROM finanzas.documento_items i WHERE i.proforma_id = p.id)
           ORDER BY p.id LIMIT 1`,
          [empresaA],
        )
      ).rows[0]?.id;
      if (!proforma) throw new Error("La semilla no trae una proforma emitida: ejecuta npm run seed");

      await tx.query("UPDATE finanzas.ajustes SET emisor_razon_social = NULL WHERE id = 1");
      r.sinEmisor = await intentarDentro(() => facturas.emitir(proforma, tx));
      await tx.query(
        `UPDATE finanzas.ajustes SET emisor_razon_social = 'Emisor de prueba, C.A.',
           emisor_rif = 'J-00000000-0', emisor_domicilio = 'Caracas' WHERE id = 1`,
      );
      await tx.query(
        `INSERT INTO finanzas.tasas_cambio (fuente, moneda, fecha_valor, valor, origen, registrada_por)
         VALUES ('bcv', 'USD', finanzas.hoy(), 40.5, 'manual', $1)
         ON CONFLICT (fuente, moneda, fecha_valor) DO NOTHING`,
        [operador.id],
      );

      // La numeracion solo sube.
      const antes = await ajustes.numeracion(tx);
      if (!antes) throw new Error("El operador no lee la numeracion");
      r.numeracionBaja = await intentarDentro(() =>
        ajustes.fijarNumeracion({ ...antes, proximaFactura: antes.proximaFactura - 1 }, tx),
      );
      await ajustes.fijarNumeracion({ ...antes, proximaFactura: antes.proximaFactura + 10 }, tx);

      // ---- Emitir.
      const id = await facturas.emitir(proforma, tx);
      const factura = await facturas.buscarPorId(id, tx);
      const renglones = await facturas.renglones(id, tx);
      r.numero = factura?.numero === antes.proximaFactura + 10;
      r.control = /^00-\d{6}$/.test(factura?.numeroControl ?? "");
      r.cuadra =
        factura !== null &&
        renglones.length > 0 &&
        (await tx.query<{ ok: boolean }>(
          "SELECT $1::numeric + $2::numeric + $3::numeric = $4::numeric AS ok",
          [factura.baseImponible, factura.montoExento, factura.ivaMonto, factura.total],
        )).rows[0].ok;
      r.emisorCongelado = factura?.emisor.razonSocial === "Emisor de prueba, C.A.";
      r.proformaFacturada = (
        await tx.query<{ estado: string }>("SELECT estado FROM finanzas.proformas WHERE id = $1", [proforma])
      ).rows[0].estado;
      r.dosVeces = await intentarDentro(() => facturas.emitir(proforma, tx));

      // Lo emitido no cambia, y la aplicacion no escribe facturas.
      r.cambiaTotal = await intentarDentro(() =>
        tx.query("UPDATE finanzas.facturas SET total = total + 1 WHERE id = $1", [id]),
      );
      r.cambiaRenglon = await intentarDentro(() =>
        tx.query("UPDATE finanzas.factura_items SET descripcion = 'x' WHERE factura_id = $1", [id]),
      );
      r.insertaFactura = await intentarDentro(() => tx.query("INSERT INTO finanzas.facturas (serie) VALUES ('Z')"));
      r.borraFactura = await intentarDentro(() => tx.query("DELETE FROM finanzas.facturas WHERE id = $1", [id]));
      r.marcaImpresa = await facturas.marcarImpresa(id, operador.id, tx);
      r.reimpresa = await facturas.marcarImpresa(id, operador.id, tx);

      // ---- El cliente con permiso: ve su factura, reporta, no decide.
      await comoCliente();
      r.clienteVe = (await facturas.buscarPorId(id, tx)) !== null;
      r.clienteEmite = await intentarDentro(() => facturas.emitir(proforma, tx));
      r.clienteAnula = (await tx.query("UPDATE finanzas.facturas SET estado = 'anulada' WHERE id = $1", [id])).rowCount;
      r.clienteLeeAjustes = (await tx.query("SELECT 1 FROM finanzas.ajustes")).rowCount;
      r.clienteLeeFormatos = (await tx.query("SELECT 1 FROM finanzas.formatos_impresion")).rowCount;
      const mediosCliente = await ajustes.medios(tx);
      r.clienteMediosActivos = mediosCliente.length > 0 && mediosCliente.every((m) => m.activo);

      const zelle = mediosCliente.find((m) => m.nombre === "Zelle");
      const pagoMovil = mediosCliente.find((m) => m.nombre === "Pago movil");
      if (!zelle || !pagoMovil) throw new Error("Faltan los medios de pago de ejemplo");
      const base = {
        facturaId: id,
        tipo: "pago" as const,
        referencia: "123",
        fechaPago: "2026-10-15",
        comprobanteArchivo: null,
        comprobanteMime: null,
        aNombreDelCliente: false,
      };
      const pago = await pagos.reportar({ ...base, medioId: zelle.id, monto: "10.00", moneda: "USD" }, cliente.id, tx);
      r.monedaNoAceptada = await intentarDentro(() =>
        pagos.reportar({ ...base, medioId: pagoMovil.id, monto: "10.00", moneda: "USD" }, cliente.id, tx),
      );
      r.clienteANombre = await intentarDentro(() =>
        pagos.reportar(
          { ...base, medioId: zelle.id, monto: "10.00", moneda: "USD", aNombreDelCliente: true },
          cliente.id,
          tx,
        ),
      );
      r.clienteConfirma = (
        await tx.query("UPDATE finanzas.pagos SET estado = 'rechazado', motivo_rechazo = 'x' WHERE id = $1", [pago])
      ).rowCount;

      // Otra empresa y un ejecutivo de cuentas no ven nada.
      await comoCliente(empresaA + 100000);
      r.otraEmpresaVe = await cuantas();
      await como(cuentas.id, "trabajador", "cuentas");
      r.cuentasVe = await cuantas();
      r.cuentasLeePagos = (await tx.query("SELECT 1 FROM finanzas.pagos")).rowCount;

      // ---- El operador confirma: en dolares exige la tasa.
      await comoOperador();
      r.sinTasa = await intentarDentro(() =>
        pagos.confirmar(pago, { montoAplicado: "405.00", tasaAplicada: null }, operador.id, tx),
      );
      r.confirma = await pagos.confirmar(pago, { montoAplicado: "405.00", tasaAplicada: "40.5" }, operador.id, tx);
      r.cambiaConfirmado = await intentarDentro(() =>
        tx.query("UPDATE finanzas.pagos SET monto_aplicado = 1 WHERE id = $1", [pago]),
      );
      const conPago = await facturas.buscarPorId(id, tx);
      r.cobro = conPago?.cobro;
      r.saldoBaja =
        conPago !== null &&
        (await tx.query<{ ok: boolean }>("SELECT $1::numeric = $2::numeric - 405 AS ok", [
          conPago.saldo,
          conPago.total,
        ])).rows[0].ok;
      r.anulaConPagos = await intentarDentro(() => facturas.anular(id, "Error de prueba", tx));

      throw new Deshacer();
    });
  } catch (error) {
    if (!(error instanceof Deshacer)) throw error;
  }

  console.log("\nFacturas y pagos\n");

  comprobar("Sin los datos del emisor no se emite", r.sinEmisor === "23514", String(r.sinEmisor));
  comprobar("Los proximos numeros solo suben", r.numeracionBaja === "23514", String(r.numeracionBaja));
  comprobar(
    "Emitir pone el numero fijado, el control y los importes cuadran",
    r.numero === true && r.control === true && r.cuadra === true,
    `numero ${r.numero}; control ${r.control}; cuadra ${r.cuadra}`,
  );
  comprobar(
    "La factura congela el emisor y la proforma queda facturada, una vez",
    r.emisorCongelado === true && r.proformaFacturada === "facturada" && r.dosVeces === "23514",
    `emisor ${r.emisorCongelado}; proforma ${r.proformaFacturada}; otra vez ${r.dosVeces}`,
  );
  comprobar(
    "Una factura emitida y sus renglones no cambian; la app no las escribe ni las borra",
    r.cambiaTotal === "23514" &&
      r.cambiaRenglon === DENEGADO &&
      r.insertaFactura === DENEGADO &&
      r.borraFactura === DENEGADO,
    `total ${r.cambiaTotal}; renglon ${r.cambiaRenglon}; insertar ${r.insertaFactura}; borrar ${r.borraFactura}`,
  );
  comprobar(
    "Se marca impresa una sola vez",
    r.marcaImpresa === true && r.reimpresa === false,
    `primera ${r.marcaImpresa}; segunda ${r.reimpresa}`,
  );
  comprobar(
    "El cliente ve su factura pero no emite, no anula ni lee los ajustes",
    r.clienteVe === true &&
      r.clienteEmite === DENEGADO &&
      r.clienteAnula === 0 &&
      r.clienteLeeAjustes === 0 &&
      r.clienteLeeFormatos === 0 &&
      r.clienteMediosActivos === true,
    `ve ${r.clienteVe}; emite ${r.clienteEmite}; anula ${r.clienteAnula}; ajustes ${r.clienteLeeAjustes}; formatos ${r.clienteLeeFormatos}; medios activos ${r.clienteMediosActivos}`,
  );
  comprobar(
    "El cliente reporta a su nombre, con un medio que acepte la moneda, y no confirma",
    r.monedaNoAceptada === "23514" && r.clienteANombre === DENEGADO && r.clienteConfirma === 0,
    `moneda ${r.monedaNoAceptada}; a nombre ${r.clienteANombre}; confirma ${r.clienteConfirma}`,
  );
  comprobar(
    "Otra empresa y cuentas no ven facturas ni pagos",
    r.otraEmpresaVe === 0 && r.cuentasVe === 0 && r.cuentasLeePagos === 0,
    `otra ${r.otraEmpresaVe}; cuentas ${r.cuentasVe}/${r.cuentasLeePagos}`,
  );
  comprobar(
    "Confirmar en dolares pide la tasa, y lo confirmado no cambia",
    r.sinTasa === "23514" && r.confirma === true && r.cambiaConfirmado === "23514",
    `sin tasa ${r.sinTasa}; confirma ${r.confirma}; cambia ${r.cambiaConfirmado}`,
  );
  comprobar(
    "El pago confirmado baja el saldo, y con pagos no se anula",
    r.cobro === "parcial" && r.saldoBaja === true && r.anulaConPagos === "23514",
    `${r.cobro}; saldo ${r.saldoBaja}; anular ${r.anulaConPagos}`,
  );
}

/**
 * Lo que vale para todas las tablas a la vez, para que una tabla nueva no se
 * cuele sin lo que tienen las demas: seguridad por fila en `portal` y
 * `finanzas`, ningun DELETE fuera de la lista y ninguna funcion privilegiada
 * sin su search_path fijo.
 */
async function probarEstructura(): Promise<void> {
  // La unica tabla de portal y finanzas sin seguridad por fila: el almacen del
  // modo simulado de archivos, que solo existe en desarrollo y solo lee el
  // adaptador sin sesion (src/lib/externos/archivos.ts).
  const SIN_SEGURIDAD_POR_FILA = ["portal.archivos_simulados"];

  // Lo unico que la aplicacion puede borrar: filas que se rehacen enteras y
  // no son historia (asignaciones y tareas sin empezar, codigos de respaldo,
  // el modulo de hooks, que es anterior al portal).
  const CON_DELETE = [
    "portal.asignaciones",
    "portal.tareas",
    "public.codigos_respaldo",
    "public.fichas_hook",
    "public.referencias_hook",
    "public.reglas_hook",
  ];

  const sinSeguridad = (
    await consultar<{ tabla: string }>(
      `SELECT schemaname || '.' || tablename AS tabla FROM pg_tables
       WHERE schemaname IN ('portal', 'finanzas') AND NOT rowsecurity ORDER BY 1`,
    )
  ).map((fila) => fila.tabla);

  const conDelete = (
    await consultar<{ tabla: string }>(
      `SELECT DISTINCT table_schema || '.' || table_name AS tabla
       FROM information_schema.role_table_grants
       WHERE grantee = 'conejo_app' AND privilege_type = 'DELETE' ORDER BY 1`,
    )
  ).map((fila) => fila.tabla);

  const sinSearchPath = (
    await consultar<{ funcion: string }>(
      `SELECT n.nspname || '.' || p.proname AS funcion
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE p.prosecdef AND n.nspname IN ('public', 'portal', 'finanzas')
         AND NOT coalesce(array_to_string(p.proconfig, ',') LIKE '%search_path=%', false)
       ORDER BY 1`,
    )
  ).map((fila) => fila.funcion);

  console.log("\nEstructura\n");

  comprobar(
    "Toda tabla de portal y finanzas tiene seguridad por fila",
    JSON.stringify(sinSeguridad) === JSON.stringify(SIN_SEGURIDAD_POR_FILA),
    sinSeguridad.join(", ") || "todas",
  );
  comprobar(
    "La aplicacion solo borra en las tablas de la lista",
    JSON.stringify(conDelete) === JSON.stringify(CON_DELETE),
    conDelete.join(", "),
  );
  comprobar(
    "Toda funcion SECURITY DEFINER fija su search_path",
    sinSearchPath.length === 0,
    sinSearchPath.join(", ") || "todas",
  );
}
