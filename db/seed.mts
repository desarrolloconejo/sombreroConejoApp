/**
 * Crea el esquema e inserta los datos minimos para que la aplicacion arranque.
 *
 *   docker compose exec app-dev npm run seed
 *
 * Es idempotente: ejecutarlo varias veces no duplica ni pisa nada. Las tablas
 * se crean con IF NOT EXISTS y las inserciones usan ON CONFLICT DO NOTHING.
 *
 * No usa el pool de src/lib/db.ts a proposito: es un script suelto que abre su
 * conexion, hace su trabajo y la cierra.
 *
 * Se conecta como DUENO de la base (DATABASE_URL_ADMIN), no como la
 * aplicacion: crear tablas y dar permisos es justo lo que el rol de la
 * aplicacion no puede hacer.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";
import bcrypt from "bcryptjs";
import { APERTURAS } from "./datos/aperturas.mts";
import { sembrarBriefs } from "./datos/briefs.mts";
import { sembrarFinanzas } from "./datos/finanzas.mts";
import { PROYECTO_ESPECIAL, sembrarProyectos } from "./datos/proyectos.mts";
import {
  EMAIL_CREADORA,
  EMAIL_EJECUTIVO,
  EMPRESA_DEMO,
  REFERENCIA,
  REGLAS,
  RONDAS_BCRYPT,
  ROLES,
  USUARIOS,
} from "./datos/semilla.mts";

async function principal(): Promise<void> {
  // Con una sola cadena en el entorno (un .env antiguo, o fuera de Docker) se
  // usa esa, que es la del dueno.
  const cadenaConexion =
    process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL;

  if (!cadenaConexion) {
    throw new Error(
      "Falta DATABASE_URL_ADMIN (o DATABASE_URL) con la conexion del dueno de la base",
    );
  }

  const cliente = new Client({ connectionString: cadenaConexion });
  await cliente.connect();

  try {
    // -- Esquema ------------------------------------------------------------
    const esquema = await readFile(join(import.meta.dirname, "schema.sql"), "utf8");
    await cliente.query(esquema);
    console.log("Esquema aplicado");

    // -- Contrasena del rol de la aplicacion --------------------------------
    //
    // El esquema crea el rol sin contrasena, porque va al repositorio. Aqui se
    // le pone la de desarrollo. Un ALTER ROLE no admite parametros, asi que el
    // texto lo arma el propio servidor con format(%L), que es quien sabe
    // escapar un literal.
    const claveApp = process.env.CONEJO_APP_PASSWORD || "conejo_app_local";
    const { rows: sentencia } = await cliente.query<{ sql: string }>(
      "SELECT format('ALTER ROLE conejo_app LOGIN PASSWORD %L', $1::text) AS sql",
      [claveApp],
    );
    await cliente.query(sentencia[0].sql);
    console.log("Rol conejo_app listo");

    // -- Roles --------------------------------------------------------------
    for (const rol of ROLES) {
      await cliente.query(
        `INSERT INTO roles (nombre, descripcion)
         VALUES ($1, $2)
         ON CONFLICT (nombre) DO NOTHING`,
        [rol.nombre, rol.descripcion],
      );
    }
    console.log(`Roles listos (${ROLES.length})`);

    // -- Empresa demo -------------------------------------------------------
    await cliente.query(
      `INSERT INTO empresas (nombre, rif, telefono, direccion, sector)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (rif) DO UPDATE SET sector = EXCLUDED.sector`,
      [
        EMPRESA_DEMO.nombre,
        EMPRESA_DEMO.rif,
        EMPRESA_DEMO.telefono,
        EMPRESA_DEMO.direccion,
        EMPRESA_DEMO.sector,
      ],
    );

    const { rows: empresas } = await cliente.query<{ id: number }>(
      "SELECT id FROM empresas WHERE rif = $1",
      [EMPRESA_DEMO.rif],
    );
    const empresaId = empresas[0]?.id;

    if (!empresaId) {
      throw new Error("No se pudo obtener la empresa de ejemplo");
    }
    console.log(`Empresa de ejemplo lista (id ${empresaId})`);

    // -- Usuarios -----------------------------------------------------------
    for (const usuario of USUARIOS) {
      const hash = await bcrypt.hash(usuario.password, RONDAS_BCRYPT);

      await cliente.query(
        `INSERT INTO usuarios (nombre, apellido, email, password_hash, telefono)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (lower(email)) DO NOTHING`,
        [
          usuario.nombre,
          usuario.apellido,
          usuario.email,
          hash,
          usuario.telefono,
        ],
      );

      const { rows: encontrados } = await cliente.query<{ id: number }>(
        "SELECT id FROM usuarios WHERE lower(email) = lower($1)",
        [usuario.email],
      );
      const usuarioId = encontrados[0]?.id;

      if (!usuarioId) {
        throw new Error(`No se pudo obtener el usuario ${usuario.email}`);
      }

      // Los dos pasos se piden por defecto a toda cuenta. A las de la
      // semilla se les apunta que no los quieren, para que entrar con ellas
      // siga siendo correo y contrasena; no se toca a quien ya los activo.
      if (!usuario.pideDosPasos) {
        await cliente.query(
          `UPDATE usuarios SET dos_pasos_omitido = TRUE
           WHERE id = $1 AND totp_activado_en IS NULL`,
          [usuarioId],
        );
      }

      if (usuario.perfil.tipo === "trabajador") {
        // DO UPDATE, no DO NOTHING: si el seed cambia el rol o el cargo de
        // alguien, volver a ejecutarlo debe corregirlo.
        await cliente.query(
          `INSERT INTO trabajadores (usuario_id, rol_id, cargo_id, fecha_ingreso)
           VALUES (
             $1,
             (SELECT id FROM roles  WHERE nombre = $2),
             (SELECT id FROM cargos WHERE slug   = $3),
             CURRENT_DATE
           )
           ON CONFLICT (usuario_id) DO UPDATE
             SET rol_id   = EXCLUDED.rol_id,
                 cargo_id = EXCLUDED.cargo_id`,
          [usuarioId, usuario.perfil.rol, usuario.perfil.cargo],
        );
      } else {
        await cliente.query(
          `INSERT INTO clientes (usuario_id, empresa_id, cargo)
           VALUES ($1, $2, $3)
           ON CONFLICT (usuario_id) DO NOTHING`,
          [usuarioId, empresaId, usuario.perfil.cargo],
        );
      }

      console.log(`Usuario listo: ${usuario.email} (${usuario.perfil.tipo})`);
    }

    // -- Modulo de hooks ----------------------------------------------------
    //
    // Las 42 aperturas se siembran con DO NOTHING: una vez en la base las
    // gestiona la agencia, y volver a ejecutar el seed no debe pisar una
    // redaccion que alguien haya mejorado.
    for (const apertura of APERTURAS) {
      await cliente.query(
        `INSERT INTO aperturas_hook (
           numero, territorio, mecanismos, plantilla, ejemplo,
           insert_titulo, direccion_edicion, usala_cuando
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (numero) DO NOTHING`,
        [
          apertura.numero,
          apertura.territorio,
          apertura.mecanismos,
          apertura.plantilla,
          apertura.ejemplo,
          apertura.insertTitulo,
          apertura.direccionEdicion,
          apertura.usalaCuando,
        ],
      );
    }
    console.log(`Aperturas listas (${APERTURAS.length})`);

    // Quien firma lo que siembra el seed: la creadora de contenido.
    const { rows: creadoras } = await cliente.query<{ id: number }>(
      "SELECT id FROM usuarios WHERE lower(email) = lower($1)",
      [EMAIL_CREADORA],
    );
    const creadoraId = creadoras[0]?.id;

    if (!creadoraId) {
      throw new Error("No se encontro la creadora de contenido del seed");
    }

    // Dos reglas que ensenan la resolucion: una de sector y una de cliente.
    // La de sector amplia los limites, para que se vea el aviso en el auditor.
    for (const regla of REGLAS) {
      await cliente.query(
        `INSERT INTO reglas_hook (
           etiqueta, empresa_id, sector, max_palabras_voz, max_palabras_insert,
           exigir_prueba, preambulos, formulas_gastadas, terminos_tension, creado_por
         )
         SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
         WHERE NOT EXISTS (SELECT 1 FROM reglas_hook WHERE etiqueta = $1)`,
        [
          regla.etiqueta,
          regla.empresaId === null ? null : empresaId,
          regla.sector,
          regla.maxVoz,
          regla.maxInsert,
          regla.exigirPrueba,
          "",
          "",
          "",
          creadoraId,
        ],
      );
    }
    console.log(`Reglas listas (${REGLAS.length})`);

    // Una referencia de ejemplo, para que el banco no arranque vacio.
    await cliente.query(
      `INSERT INTO referencias_hook (
         hablado, insert_titulo, plataforma, territorio, url_fuente,
         lectura, etiquetas, creado_por
       )
       SELECT $1, $2, $3, $4, $5, $6, $7, $8
       WHERE NOT EXISTS (SELECT 1 FROM referencias_hook WHERE hablado = $1)`,
      [
        REFERENCIA.hablado,
        REFERENCIA.insertTitulo,
        REFERENCIA.plataforma,
        REFERENCIA.territorio,
        REFERENCIA.urlFuente,
        REFERENCIA.lectura,
        REFERENCIA.etiquetas,
        creadoraId,
      ],
    );
    console.log("Referencia de ejemplo lista");

    // -- Proyectos ------------------------------------------------------------
    //
    // El ejecutivo de la semilla atiende a la empresa de ejemplo, y ella tiene
    // dos proyectos: una parrilla de redes que reproduce el ejemplo A de la
    // bateria (60 %) y un proyecto especial recien empezado.
    const idDe = async (email: string): Promise<number> => {
      const { rows } = await cliente.query<{ id: number }>(
        "SELECT id FROM usuarios WHERE lower(email) = lower($1)",
        [email],
      );
      if (!rows[0]) throw new Error(`No se encontro ${email} en la semilla`);
      return rows[0].id;
    };

    const equipo = {
      ejecutivo: await idDe(EMAIL_EJECUTIVO),
      redes: creadoraId,
      diseno: await idDe("diseno@conejo.test"),
      produccion: await idDe("pruebas@conejo.test"),
      admin: await idDe(USUARIOS[0].email),
      cliente: await idDe("cliente@empresa.test"),
    };

    // La persona de la empresa de ejemplo decide en la fase 5 y ve las
    // finanzas de su empresa.
    await cliente.query(
      "UPDATE clientes SET puede_aprobar = TRUE, puede_ver_finanzas = TRUE WHERE usuario_id = $1",
      [equipo.cliente],
    );

    await cliente.query(
      `INSERT INTO portal.asignaciones (usuario_id, empresa_id, creado_por)
       VALUES ($1, $2, $3)
       ON CONFLICT (usuario_id, empresa_id) DO NOTHING`,
      [equipo.ejecutivo, empresaId, equipo.admin],
    );
    console.log(`Empresa de ejemplo asignada a ${EMAIL_EJECUTIVO}`);

    const proyectosNuevos = await sembrarProyectos(cliente, empresaId, equipo);
    console.log(`Proyectos de ejemplo listos (${proyectosNuevos} nuevos)`);

    const { rows: especial } = await cliente.query<{ id: number }>(
      "SELECT id FROM portal.proyectos WHERE empresa_id = $1 AND nombre = $2 ORDER BY id LIMIT 1",
      [empresaId, PROYECTO_ESPECIAL],
    );
    const documentos = await sembrarFinanzas(cliente, empresaId, especial[0]?.id ?? null, {
      admin: equipo.admin,
      cliente: equipo.cliente,
    });
    console.log(`Finanzas de ejemplo listas (${documentos} documentos nuevos)`);

    const { rows: personaCliente } = await cliente.query<{ nombre: string; empresa: string }>(
      `SELECT u.nombre || ' ' || u.apellido AS nombre, e.nombre AS empresa
       FROM usuarios u JOIN clientes c ON c.usuario_id = u.id JOIN empresas e ON e.id = c.empresa_id
       WHERE u.id = $1`,
      [equipo.cliente],
    );
    const briefsNuevos = await sembrarBriefs(cliente, empresaId, {
      id: equipo.cliente,
      nombre: personaCliente[0].nombre,
      empresaNombre: personaCliente[0].empresa,
    });
    console.log(`Briefs de ejemplo listos (${briefsNuevos} nuevos)`);

    // -- Resumen ------------------------------------------------------------
    const { rows: resumen } = await cliente.query<{
      email: string;
      tipo: string | null;
      rol: string | null;
      ambito: string | null;
    }>(
      `SELECT email, tipo, rol,
              COALESCE(cargo_slug, empresa_nombre) AS ambito
       FROM vw_usuarios_completos
       ORDER BY tipo, rol, email`,
    );

    console.log("\nUsuarios en la base de datos:");
    for (const fila of resumen) {
      const tipo = (fila.tipo ?? "sin tipo").padEnd(11);
      const rol = (fila.rol ?? "sin rol").padEnd(11);
      console.log(`  ${fila.email.padEnd(26)} ${tipo} ${rol} ${fila.ambito ?? "-"}`);
    }

    console.log("\nCredenciales de acceso:");
    for (const usuario of USUARIOS) {
      console.log(`  ${usuario.email}  ->  ${usuario.password}`);
    }
  } finally {
    await cliente.end();
  }
}

principal().catch((error: unknown) => {
  console.error("\nFallo el seed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
