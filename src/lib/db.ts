import { Pool, type PoolClient, type QueryResultRow } from "pg";

/**
 * Acceso a PostgreSQL. Es la unica pieza del proyecto que abre conexiones.
 *
 * SOBRE INYECCION SQL
 * -------------------
 * Todas las funciones de este modulo reciben la consulta y los valores por
 * separado. El driver los envia asi al servidor usando el protocolo extendido:
 * el texto de la consulta se prepara primero y los valores llegan despues, ya
 * tipados. Un valor nunca se interpreta como SQL, por muy retorcido que sea.
 *
 * Por eso NO hay que "escapar" ni "limpiar" los valores: hay que pasarlos como
 * parametros. Concatenarlos en el texto de la consulta es lo unico que abre la
 * puerta a una inyeccion.
 *
 *   MAL   consultar(`SELECT * FROM usuarios WHERE email = '${email}'`)
 *   BIEN  consultar("SELECT * FROM usuarios WHERE email = $1", [email])
 *
 * Los identificadores (nombres de tabla, de columna, direccion de un ORDER BY)
 * no se pueden parametrizar. Para esos casos existe `identificadorSeguro`, que
 * obliga a elegir de una lista blanca.
 */

// El pool debe sobrevivir a la recarga de modulos del servidor de desarrollo.
// Sin esto cada cambio en el codigo abriria un pool nuevo y agotaria las
// conexiones de PostgreSQL.
declare global {
  var __conejoPool: Pool | undefined;
}

/**
 * Los ajustes del pool cambian segun donde corra, y no por afinar de mas.
 *
 * En un contenedor hay UN proceso de larga vida: un pool holgado se amortiza y
 * las conexiones ociosas no molestan a nadie.
 *
 * En produccion la aplicacion vive en funciones sin estado. Cada instancia
 * tiene su propio `globalThis.__conejoPool`, asi que el limite real contra la
 * base es `max` multiplicado por el numero de instancias que la plataforma
 * decida levantar. De ahi los tres numeros de abajo:
 *
 * - `max` bajo, porque se multiplica por instancias.
 * - `idleTimeoutMillis` corto: cuando la instancia se congela, la plataforma o
 *   la propia base pueden matar el socket sin avisar. Menos tiempo ocioso,
 *   menos sockets zombis al descongelar.
 * - `maxLifetimeSeconds` como red de seguridad, porque durante el congelado
 *   los temporizadores NO corren: `idleTimeoutMillis` puede no llegar a
 *   dispararse nunca y aun asi la conexion estar muerta.
 */
const EN_PRODUCCION = process.env.NODE_ENV === "production";

/** Ninguna consulta de la aplicacion deberia acercarse a esto. */
const TIEMPO_MAXIMO_CONSULTA = 15_000;

function crearPool(): Pool {
  const cadenaConexion = process.env.DATABASE_URL;

  if (!cadenaConexion) {
    throw new Error(
      "Falta la variable de entorno DATABASE_URL. Revisa el archivo .env",
    );
  }

  const pool = new Pool({
    connectionString: cadenaConexion,
    max: EN_PRODUCCION ? 3 : 10,
    idleTimeoutMillis: EN_PRODUCCION ? 10_000 : 30_000,
    maxLifetimeSeconds: EN_PRODUCCION ? 60 : 0,
    connectionTimeoutMillis: 10_000,

    // Tope por consulta, contado en este lado. Sin el, una consulta colgada
    // retiene su conexion hasta que la plataforma mata la funcion, y en
    // produccion solo hay tres.
    query_timeout: TIEMPO_MAXIMO_CONSULTA,

    // Detecta el socket muerto antes de mandarle una consulta, en vez de
    // descubrirlo por el error que devuelve.
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,

    // Deja que un proceso corto —el seed, las baterias de pruebas— termine sin
    // quedarse colgado esperando a que se cierren conexiones ociosas.
    allowExitOnIdle: true,
  });

  // Un error en una conexion ociosa no debe tumbar el proceso.
  pool.on("error", (error) => {
    console.error("[db] error en una conexion ociosa del pool:", error.message);
  });

  return pool;
}

/**
 * Distingue "la conexion estaba muerta" de "el servidor rechazo la consulta".
 *
 * La regla es limpia: TODO error que venga del servidor trae `code`, que es su
 * SQLSTATE. Si no hay `code`, o el codigo es de la familia de errores de
 * socket, entonces la consulta **nunca llego a ejecutarse**. Eso es lo que
 * hace seguro reintentarla aunque fuera un INSERT: no puede haberse aplicado.
 *
 * Por el mismo motivo NO entran aqui `57P01` ni `57P03` (el servidor cerro la
 * sesion, el servidor esta arrancando): traen `code`, llegaron al servidor, y
 * no hay forma de saber si la escritura se aplico antes del corte.
 */
const CODIGOS_DE_SOCKET = new Set(["ECONNRESET", "EPIPE", "ETIMEDOUT", "ECONNREFUSED"]);

function esErrorDeConexionMuerta(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const codigo = (error as { code?: unknown }).code;

  if (typeof codigo === "string") return CODIGOS_DE_SOCKET.has(codigo);
  if (codigo !== undefined) return false;

  return (
    error.message.includes("Connection terminated") ||
    error.message.includes("not queryable")
  );
}

/**
 * Reintenta UNA vez, y solo cuando la consulta no llego al servidor.
 *
 * Es lo que absorbe el caso tipico de una instancia que se descongela con
 * sockets ya muertos: el pool los reemplaza, pero el primero en usarlos se
 * come el error. Sin esto, la primera visita despues de un rato de silencio
 * devuelve una pagina de error en vez de contenido.
 */
async function conReintento<T>(operacion: () => Promise<T>): Promise<T> {
  try {
    return await operacion();
  } catch (error) {
    if (!esErrorDeConexionMuerta(error)) throw error;

    console.warn("[db] conexion muerta, reintentando una vez");
    return operacion();
  }
}

/**
 * Devuelve el pool, creandolo la primera vez que hace falta.
 *
 * La creacion es perezosa a proposito. Si se hiciera al cargar el modulo, el
 * `next build` fallaria: para recolectar la configuracion de cada page las
 * importa, y en ese momento no hay base de datos ni variables de entorno de
 * ejecucion. Compilar no debe requerir una conexion.
 */
export function obtenerPool(): Pool {
  if (!globalThis.__conejoPool) {
    globalThis.__conejoPool = crearPool();
  }

  return globalThis.__conejoPool;
}

/**
 * Quita los literales de texto de una consulta, dejando el resto intacto.
 *
 * Hace falta porque un literal puede contener algo con la forma de un
 * marcador de posicion sin serlo. El caso tipico es un hash de bcrypt, que
 * empieza por `$2b$12$`: el servidor no lo interpreta como parametro, pero un
 * analisis ingenuo del texto si lo haria.
 */
function quitarLiterales(sql: string): string {
  return sql
    // Bloques con comillas dobles de dolar: $etiqueta$ ... $etiqueta$
    .replace(/\$([A-Za-z_]\w*)?\$[\s\S]*?\$\1?\$/g, " ")
    // Literales entre comillas simples, contemplando el escape por duplicado
    .replace(/'(?:[^']|'')*'/g, " ");
}

/**
 * Comprueba que la consulta no pida mas parametros de los que se le pasan.
 * Es una red de seguridad para desarrollo: detecta el olvido de un valor, que
 * de otro modo se manifestaria como un error criptico del driver.
 */
function verificarParametros(sql: string, valores: readonly unknown[]): void {
  if (process.env.NODE_ENV === "production") return;

  let mayor = 0;
  for (const coincidencia of quitarLiterales(sql).matchAll(/\$(\d+)/g)) {
    mayor = Math.max(mayor, Number(coincidencia[1]));
  }

  if (mayor > valores.length) {
    throw new Error(
      `La consulta usa $${mayor} pero solo se pasaron ${valores.length} valores.`,
    );
  }

  /*
   * Y al reves: valores que no referencia nadie.
   *
   * Parece inofensivo, pero delata el fallo contrario y mucho mas dificil de
   * ver: un marcador mal escrito. `rol = 3` en lugar de `rol = $3` es SQL
   * valido, no falla al construirse, y solo revienta en el servidor con un
   * "operator does not exist: text = integer" que no dice donde esta el error.
   *
   * Si sobran valores, algun marcador se quedo por el camino.
   */
  if (mayor < valores.length) {
    throw new Error(
      `Se pasaron ${valores.length} valores pero la consulta solo usa hasta $${mayor}. ` +
        "Suele significar que a algun marcador le falta el $.",
    );
  }
}

/**
 * Quien ejecuta la consulta. Por defecto el pool, que toma una conexion libre
 * y la devuelve al terminar. Dentro de una transaccion hay que pasar el
 * cliente que entrega `transaccion`, porque solo esa conexion esta dentro del
 * BEGIN: usar el pool ahi tomaria otra conexion y quedaria fuera.
 */
export type Ejecutor = Pool | PoolClient;

/**
 * Ejecuta una consulta y devuelve todas las filas.
 * Los valores SIEMPRE van en el segundo argumento, nunca dentro del texto.
 */
export async function consultar<T extends QueryResultRow>(
  sql: string,
  valores: readonly unknown[] = [],
  ejecutor: Ejecutor = obtenerPool(),
): Promise<T[]> {
  verificarParametros(sql, valores);

  const resultado = await ejecutarQuizaReintentando(ejecutor, () =>
    ejecutor.query<T>(sql, valores as unknown[]),
  );

  return resultado.rows;
}

/**
 * Aplica el reintento SOLO cuando el ejecutor es el pool.
 *
 * Con un `PoolClient` estamos dentro de una transaccion, con un BEGIN abierto:
 * reintentar ahi partiria la transaccion en dos y las consultas anteriores
 * quedarian en una sesion que ya no existe. Ahi el error tiene que subir para
 * que el ROLLBACK haga su trabajo.
 */
function ejecutarQuizaReintentando<T>(
  ejecutor: Ejecutor,
  operacion: () => Promise<T>,
): Promise<T> {
  return ejecutor instanceof Pool ? conReintento(operacion) : operacion();
}

/**
 * Ejecuta una consulta y devuelve la primera fila, o null si no hubo ninguna.
 */
export async function consultarUno<T extends QueryResultRow>(
  sql: string,
  valores: readonly unknown[] = [],
  ejecutor: Ejecutor = obtenerPool(),
): Promise<T | null> {
  const filas = await consultar<T>(sql, valores, ejecutor);
  return filas[0] ?? null;
}

/**
 * Ejecuta una consulta que no devuelve filas y responde cuantas afecto.
 */
export async function ejecutar(
  sql: string,
  valores: readonly unknown[] = [],
  ejecutor: Ejecutor = obtenerPool(),
): Promise<number> {
  verificarParametros(sql, valores);

  const resultado = await ejecutarQuizaReintentando(ejecutor, () =>
    ejecutor.query(sql, valores as unknown[]),
  );

  return resultado.rowCount ?? 0;
}

/**
 * Escapa los comodines de un patron LIKE / ILIKE.
 *
 * No es una defensa contra inyeccion: el valor ya viaja como parametro. Es una
 * cuestion de correccion. Sin esto, alguien que busque "100%" encontraria
 * cualquier cosa que empiece por 100, y un patron lleno de "%" puede volver la
 * consulta muy costosa.
 *
 * Las consultas que lo usen deben terminar con ESCAPE '\'.
 */
export function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (caracter) => `\\${caracter}`);
}

/**
 * Agrupa varias operaciones en una transaccion. Si la funcion lanza, se
 * deshace todo. El cliente que recibe la funcion es el unico que debe usarse
 * dentro: usar `consultar` ahi tomaria otra conexion, fuera de la transaccion.
 */
export async function transaccion<T>(
  operacion: (cliente: PoolClient) => Promise<T>,
): Promise<T> {
  const cliente = await obtenerPool().connect();

  // Si ni siquiera se pudo deshacer, la conexion no es de fiar: se destruye
  // en lugar de devolverla al pool, donde la heredaria la siguiente consulta.
  let conexionRota = false;

  try {
    await cliente.query("BEGIN");
    const resultado = await operacion(cliente);
    await cliente.query("COMMIT");
    return resultado;
  } catch (error) {
    // El ROLLBACK va en su propio try porque puede fallar por si mismo: si lo
    // que rompio la transaccion fue la conexion, deshacerla tambien lanza. Sin
    // esta proteccion ese segundo error TAPA al primero, y en los registros
    // queda "Connection terminated" en lugar de la causa real.
    try {
      await cliente.query("ROLLBACK");
    } catch (fallo) {
      conexionRota = true;
      console.error(
        "[db] no se pudo deshacer la transaccion:",
        fallo instanceof Error ? fallo.message : fallo,
      );
    }

    throw error;
  } finally {
    cliente.release(conexionRota);
  }
}

/** Quien hace la peticion, tal como se le declara a la base. */
export type ActorDeBase = {
  id: number;
  rol: string;
  cargoSlug: string | null;
  empresaId: number | null;
};

/**
 * Una transaccion que le dice a la base quien esta al otro lado.
 *
 * Declara usuario, rol, cargo y empresa como ajustes de la transaccion. Las
 * politicas de seguridad por fila los leen para decidir que filas existen
 * para esa persona, y por eso todos los modelos del portal pasan por aqui:
 * sin sesion declarada, una tabla con politicas devuelve cero filas.
 *
 * Los ajustes son locales a la transaccion (el tercer argumento de
 * set_config): al terminar desaparecen, y la conexion vuelve al pool sin
 * rastro de quien la uso. Con un SET de sesion, la siguiente peticion que
 * tomara esa conexion heredaria la identidad de la anterior.
 */
export async function conSesion<T>(
  actor: ActorDeBase,
  operacion: (cliente: PoolClient) => Promise<T>,
): Promise<T> {
  return transaccion(async (cliente) => {
    await cliente.query(
      `SELECT set_config('app.usuario_id', $1, true),
              set_config('app.rol',        $2, true),
              set_config('app.cargo',      $3, true),
              set_config('app.empresa_id', $4, true)`,
      [
        String(actor.id),
        actor.rol,
        actor.cargoSlug ?? "",
        actor.empresaId === null ? "" : String(actor.empresaId),
      ],
    );

    return operacion(cliente);
  });
}

/**
 * Devuelve un identificador SQL solo si esta en la lista blanca.
 *
 * Los nombres de columna y las direcciones de ordenamiento no se pueden pasar
 * como parametros, asi que cuando dependan de la entrada del usuario tienen
 * que validarse contra un conjunto cerrado de valores conocidos.
 *
 *   const columna = identificadorSeguro(orden, ["nombre", "email", "creado_en"]);
 *   consultar(`SELECT * FROM usuarios ORDER BY ${columna}`);
 */
export function identificadorSeguro<T extends string>(
  valor: unknown,
  permitidos: readonly T[],
): T {
  if (typeof valor === "string" && (permitidos as readonly string[]).includes(valor)) {
    return valor as T;
  }

  throw new Error(
    `Identificador no permitido. Valores validos: ${permitidos.join(", ")}`,
  );
}

/** Codigos de error de PostgreSQL que la capa de actions necesita distinguir. */
export const CODIGO_ERROR = {
  VIOLACION_UNICIDAD: "23505",
  VIOLACION_LLAVE_FORANEA: "23503",
  VIOLACION_CHECK: "23514",
} as const;

/** Comprueba si un error del driver corresponde a un codigo concreto. */
export function esErrorPostgres(error: unknown, codigo: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === codigo
  );
}
