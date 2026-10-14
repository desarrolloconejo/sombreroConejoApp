import {
  consultar,
  consultarUno,
  ejecutar,
  escaparLike,
  identificadorSeguro,
  type Ejecutor,
} from "@/lib/db";
import type {
  DatosNuevoUsuario,
  DatosPerfil,
  FiltrosUsuarios,
  Pagina,
  PersonaDeEquipo,
  Tema,
  Usuario,
  UsuarioCompleto,
  UsuarioConCredenciales,
} from "@/types";

/**
 * Consultas sobre la tabla usuarios y la vista vw_usuarios_completos.
 *
 * Este modulo es una de las pocas piezas que escriben SQL. Dos reglas:
 *
 * 1. Nunca `SELECT *`. Las columnas se listan siempre de forma explicita. El
 *    hash de la contrasena ni siquiera esta en vw_usuarios_completos: vive en
 *    vw_usuarios_acceso, que solo consulta `buscarPorEmailConCredenciales`.
 * 2. Los valores viajan siempre como parametros ($1, $2, ...). Lo unico que se
 *    interpola en el texto son las constantes de este archivo y los
 *    identificadores validados con `identificadorSeguro`.
 */

// Las columnas se renombran aqui a camelCase con alias entrecomillados, asi la
// fila que devuelve el driver encaja con el tipo de TypeScript sin conversion
// intermedia. Son constantes del modulo, no entrada del usuario.
const COLUMNAS_USUARIO = `
  id,
  nombre,
  apellido,
  email,
  telefono,
  foto_url       AS "fotoUrl",
  tema,
  activo,
  debe_cambiar_clave AS "debeCambiarClave",
  ultimo_acceso  AS "ultimoAcceso",
  creado_en      AS "creadoEn",
  actualizado_en AS "actualizadoEn"
`;

const COLUMNAS_COMPLETO = `
  ${COLUMNAS_USUARIO},
  tipo,
  rol,
  cargo,
  cargo_slug     AS "cargoSlug",
  cargo_id       AS "cargoId",
  fecha_ingreso  AS "fechaIngreso",
  empresa_id     AS "empresaId",
  empresa_nombre AS "empresaNombre",
  empresa_activa AS "empresaActiva"
`;

/** Columnas por las que se permite ordenar, y su nombre real en la base. */
const COLUMNAS_ORDEN = {
  nombre: "nombre",
  email: "email",
  creadoEn: "creado_en",
  ultimoAcceso: "ultimo_acceso",
} as const;

/**
 * Busca a una persona por correo e incluye su hash de contrasena.
 *
 * Es la unica funcion que expone el hash, y existe solo para que la action de
 * inicio de sesion pueda comparar la contrasena. No usarla en ningun otro sitio.
 *
 * Devuelve tambien a los usuarios desactivados: quien llama decide si les
 * permite entrar, y asi se puede distinguir "no existe" de "esta desactivado".
 */
export async function buscarPorEmailConCredenciales(
  email: string,
): Promise<UsuarioConCredenciales | null> {
  return consultarUno<UsuarioConCredenciales>(
    `SELECT ${COLUMNAS_COMPLETO},
            (SELECT a.password_hash FROM vw_usuarios_acceso a
              WHERE a.id = vw_usuarios_completos.id) AS "passwordHash",
            (SELECT a.bloqueado FROM vw_usuarios_acceso a
              WHERE a.id = vw_usuarios_completos.id) AS bloqueado,
            (SELECT a.dos_pasos FROM vw_usuarios_acceso a
              WHERE a.id = vw_usuarios_completos.id) AS "dosPasos"
     FROM vw_usuarios_completos
     WHERE lower(email) = lower($1)`,
    [email],
  );
}

/** Busca a una persona por su identificador, ya resuelto su tipo y su rol. */
export async function buscarPorId(
  id: number,
  ejecutor?: Ejecutor,
): Promise<UsuarioCompleto | null> {
  return consultarUno<UsuarioCompleto>(
    `SELECT ${COLUMNAS_COMPLETO}
     FROM vw_usuarios_completos
     WHERE id = $1`,
    [id],
    ejecutor,
  );
}

/**
 * La persona y, de paso, cuando caduca su sesion y si ya resolvio la pregunta
 * de los dos pasos (los activo, o dijo que no los quiere). Si la sesion no existe, se
 * revoco o ya caduco, esa fecha llega nula.
 *
 * Es la consulta de las guardias, y va en una sola a proposito: comprobar la
 * sesion en cada peticion es lo que permite cerrarla desde el servidor, y
 * hacerlo aqui no cuesta un viaje mas a la base.
 */
export async function buscarPorIdConSesion(
  id: number,
  sesionId: number,
): Promise<{
  usuario: UsuarioCompleto;
  sesionCaducaEn: Date | null;
  dosPasosResueltos: boolean;
} | null> {
  const fila = await consultarUno<
    UsuarioCompleto & { sesionCaducaEn: Date | null; dosPasosResueltos: boolean }
  >(
    `SELECT ${COLUMNAS_COMPLETO},
            (
              SELECT s.caduca_en FROM sesiones s
              WHERE s.id = $2
                AND s.usuario_id = vw_usuarios_completos.id
                AND s.revocada_en IS NULL
                AND s.caduca_en > now()
            ) AS "sesionCaducaEn",
            (
              SELECT u.totp_activado_en IS NOT NULL OR u.dos_pasos_omitido
              FROM usuarios u
              WHERE u.id = vw_usuarios_completos.id
            ) AS "dosPasosResueltos"
     FROM vw_usuarios_completos
     WHERE id = $1`,
    [id, sesionId],
  );

  if (!fila) return null;

  const { sesionCaducaEn, dosPasosResueltos, ...usuario } = fila;
  return { usuario, sesionCaducaEn, dosPasosResueltos };
}

/** Indica si ya hay alguien registrado con ese correo. */
export async function existeEmail(
  email: string,
  ejecutor?: Ejecutor,
): Promise<boolean> {
  const fila = await consultarUno<{ existe: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM usuarios WHERE lower(email) = lower($1)
     ) AS existe`,
    [email],
    ejecutor,
  );

  return fila?.existe ?? false;
}

/**
 * Inserta un usuario y devuelve la fila creada.
 *
 * La contrasena llega ya hasheada: este modulo no sabe nada de criptografia.
 * Acepta un ejecutor para poder participar en la transaccion que crea tambien
 * la fila de trabajador o de cliente.
 */
export async function crear(
  datos: DatosNuevoUsuario,
  ejecutor?: Ejecutor,
): Promise<Usuario> {
  const usuario = await consultarUno<Usuario>(
    `INSERT INTO usuarios
       (nombre, apellido, email, password_hash, telefono, debe_cambiar_clave)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${COLUMNAS_USUARIO}`,
    [
      datos.nombre,
      datos.apellido,
      datos.email,
      datos.passwordHash,
      datos.telefono,
      datos.debeCambiarClave,
    ],
    ejecutor,
  );

  if (!usuario) {
    throw new Error("La insercion del usuario no devolvio ninguna fila");
  }

  return usuario;
}

/** Actualiza los datos personales que cada quien puede cambiar de si mismo. */
export async function actualizarPerfil(
  id: number,
  datos: DatosPerfil,
  ejecutor?: Ejecutor,
): Promise<Usuario | null> {
  return consultarUno<Usuario>(
    `UPDATE usuarios
     SET nombre = $2, apellido = $3, telefono = $4
     WHERE id = $1
     RETURNING ${COLUMNAS_USUARIO}`,
    [id, datos.nombre, datos.apellido, datos.telefono],
    ejecutor,
  );
}

/**
 * Cambia los datos que solo un administrador puede tocar.
 *
 * Va aparte de `actualizarPerfil` porque el conjunto de campos NO es el mismo:
 * el correo es el identificador de acceso y nadie lo cambia de si mismo. Tener
 * una sola funcion con el correo dentro dejaria a un descuido de que el
 * formulario de perfil lo enviara.
 *
 * Acepta un ejecutor para poder ir en la misma transaccion que el cambio de
 * vinculo de trabajador o de cliente.
 */
export async function actualizarComoAdmin(
  id: number,
  datos: { nombre: string; apellido: string; email: string; telefono: string | null },
  ejecutor?: Ejecutor,
): Promise<Usuario | null> {
  return consultarUno<Usuario>(
    `UPDATE usuarios
     SET nombre = $2, apellido = $3, email = $4, telefono = $5
     WHERE id = $1
     RETURNING ${COLUMNAS_USUARIO}`,
    [id, datos.nombre, datos.apellido, datos.email, datos.telefono],
    ejecutor,
  );
}

/**
 * Si el correo ya lo tiene OTRA persona.
 *
 * `existeEmail` no sirve al editar: devolveria cierto por la propia fila que
 * se esta guardando, y no se podria guardar un formulario sin tocar el correo.
 */
export async function existeEmailDeOtro(
  email: string,
  id: number,
): Promise<boolean> {
  const fila = await consultarUno<{ existe: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM usuarios WHERE lower(email) = lower($1) AND id <> $2
     ) AS existe`,
    [email, id],
  );

  return fila?.existe ?? false;
}

/**
 * Reemplaza el hash de la contrasena. Recibe el hash, nunca la contrasena.
 *
 * `provisional` dice quien la eligio. Si la puso un administrador, la persona
 * tendra que cambiarla al entrar; si la eligio ella misma, ya no.
 *
 * De paso levanta el bloqueo: una contrasena nueva es justo la salida para
 * quien se quedo fuera por fallar la anterior.
 */
export async function actualizarPasswordHash(
  id: number,
  passwordHash: string,
  provisional: boolean,
  ejecutor?: Ejecutor,
): Promise<boolean> {
  const afectadas = await ejecutar(
    `UPDATE usuarios
     SET password_hash = $2,
         debe_cambiar_clave = $3,
         intentos_fallidos = 0,
         bloqueado_hasta = NULL
     WHERE id = $1`,
    [id, passwordHash, provisional],
    ejecutor,
  );

  return afectadas === 1;
}

/*
 * APAGADA junto con la subida de foto. El porque y como reactivarla estan en
 * el bloque del final de src/actions/perfil.ts, que es su unico consumidor.
 * La columna foto_url se queda en la tabla y en los tipos: quitarla obligaria
 * a migrar la vista vw_usuarios_completos y seis componentes, para volver a
 * anadirlo todo cuando la funcionalidad regrese.
 *
 * Cambia la foto de perfil y devuelve la ruta de la anterior, para que quien
 * llame pueda borrar el archivo que queda huerfano.
 *
export async function actualizarFoto(
  id: number,
  fotoUrl: string | null,
): Promise<{ fotoAnterior: string | null } | null> {
  // El alias `anterior` en el FROM se resuelve con la version de la fila
  // previa al UPDATE, que es justo la ruta que hay que borrar del disco.
  // Una subconsulta dentro del RETURNING no daria esa garantia.
  return consultarUno<{ fotoAnterior: string | null }>(
    `UPDATE usuarios AS u
     SET foto_url = $2
     FROM usuarios AS anterior
     WHERE u.id = $1 AND anterior.id = u.id
     RETURNING anterior.foto_url AS "fotoAnterior"`,
    [id, fotoUrl],
  );
}
*/

/** Guarda la preferencia de tema. */
export async function actualizarTema(id: number, tema: Tema): Promise<boolean> {
  const afectadas = await ejecutar(
    "UPDATE usuarios SET tema = $2 WHERE id = $1",
    [id, tema],
  );

  return afectadas === 1;
}

/**
 * Deja constancia de la ultima entrada y pone a cero los fallos. Se llama al
 * iniciar sesion.
 */
export async function registrarAcceso(
  id: number,
  ejecutor?: Ejecutor,
): Promise<void> {
  await ejecutar(
    `UPDATE usuarios
     SET ultimo_acceso = now(), intentos_fallidos = 0, bloqueado_hasta = NULL
     WHERE id = $1`,
    [id],
    ejecutor,
  );
}

/**
 * Apunta un intento fallido y, si es el que colma el vaso, bloquea la cuenta.
 *
 * Va en una sola sentencia para que dos intentos simultaneos no lean el mismo
 * contador y se cuenten como uno. Al bloquear, el contador vuelve a cero: el
 * bloqueo es la consecuencia, y al terminar se empieza de nuevo.
 *
 * Devuelve si la cuenta quedo bloqueada con este intento.
 */
export async function registrarFallo(
  id: number,
  limite: number,
  minutosDeBloqueo: number,
  ejecutor?: Ejecutor,
): Promise<boolean> {
  const fila = await consultarUno<{ bloqueada: boolean }>(
    `UPDATE usuarios
     SET bloqueado_hasta = CASE
           WHEN intentos_fallidos + 1 >= $2 THEN now() + make_interval(mins => $3)
           ELSE bloqueado_hasta
         END,
         intentos_fallidos = CASE
           WHEN intentos_fallidos + 1 >= $2 THEN 0
           ELSE intentos_fallidos + 1
         END
     WHERE id = $1
     RETURNING (bloqueado_hasta IS NOT NULL AND bloqueado_hasta > now()) AS bloqueada`,
    [id, limite, minutosDeBloqueo],
    ejecutor,
  );

  return fila?.bloqueada ?? false;
}

/** Activa o desactiva a una persona sin borrar su historial. */
export async function cambiarEstado(
  id: number,
  activo: boolean,
  ejecutor?: Ejecutor,
): Promise<boolean> {
  const afectadas = await ejecutar(
    "UPDATE usuarios SET activo = $2 WHERE id = $1",
    [id, activo],
    ejecutor,
  );

  return afectadas === 1;
}

/**
 * Listado paginado para el modulo de administracion.
 *
 * Las condiciones se arman como fragmentos con marcadores: cada valor entra en
 * el arreglo `valores` y el fragmento solo referencia su posicion. En el texto
 * de la consulta nunca se escribe un dato del usuario.
 *
 * El ordenamiento es la excepcion, porque no admite parametros: se resuelve
 * contra una lista blanca con `identificadorSeguro`.
 */
export async function listar(
  filtros: FiltrosUsuarios = {},
): Promise<Pagina<UsuarioCompleto>> {
  const pagina = Math.max(1, Math.trunc(filtros.pagina ?? 1));
  const porPagina = Math.min(100, Math.max(1, Math.trunc(filtros.porPagina ?? 20)));

  const condiciones: string[] = [];
  const valores: unknown[] = [];

  if (filtros.busqueda?.trim()) {
    valores.push(`%${escaparLike(filtros.busqueda.trim())}%`);
    const marcador = `$${valores.length}`;
    condiciones.push(
      `(nombre ILIKE ${marcador} ESCAPE '\\'
        OR apellido ILIKE ${marcador} ESCAPE '\\'
        OR email ILIKE ${marcador} ESCAPE '\\')`,
    );
  }

  /*
   * ANY y no IN: la lista entera viaja como UN parametro, asi que el texto de
   * la consulta no cambia con el numero de valores. Con IN habria que fabricar
   * tantos marcadores como valores, que es justo donde se cuela una
   * concatenacion.
   */
  if (filtros.tipo?.length) {
    valores.push(filtros.tipo);
    condiciones.push(`tipo = ANY($${valores.length})`);
  }

  if (filtros.rol?.length) {
    valores.push(filtros.rol);
    condiciones.push(`rol = ANY($${valores.length})`);
  }

  // Se filtra por el slug, nunca por el nombre mostrado: el slug es el
  // valor cerrado contra el que se decide el contenido.
  if (filtros.cargo?.length) {
    valores.push(filtros.cargo);
    condiciones.push(`cargo_slug = ANY($${valores.length})`);
  }

  if (filtros.empresaId?.length) {
    valores.push(filtros.empresaId);
    condiciones.push(`empresa_id = ANY($${valores.length})`);
  }

  if (filtros.activo?.length) {
    valores.push(filtros.activo);
    condiciones.push(`activo = ANY($${valores.length})`);
  }

  const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  const claveOrden = identificadorSeguro(
    filtros.orden ?? "creadoEn",
    Object.keys(COLUMNAS_ORDEN) as (keyof typeof COLUMNAS_ORDEN)[],
  );
  const columnaOrden = COLUMNAS_ORDEN[claveOrden];
  const direccion = identificadorSeguro(filtros.direccion ?? "desc", ["asc", "desc"]);

  const totales = await consultarUno<{ total: string }>(
    `SELECT count(*)::text AS total FROM vw_usuarios_completos ${donde}`,
    valores,
  );
  const total = Number(totales?.total ?? 0);

  // El limite y el desplazamiento tambien van parametrizados.
  valores.push(porPagina, (pagina - 1) * porPagina);

  const filas = await consultar<UsuarioCompleto>(
    `SELECT ${COLUMNAS_COMPLETO}
     FROM vw_usuarios_completos
     ${donde}
     ORDER BY ${columnaOrden} ${direccion.toUpperCase()} NULLS LAST, id DESC
     LIMIT $${valores.length - 1} OFFSET $${valores.length}`,
    valores,
  );

  return {
    filas,
    total,
    pagina,
    porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
  };
}

/**
 * Los administradores activos, para notificarles.
 *
 * `salvo` deja fuera a uno: quien provoca algo no necesita que se lo cuenten.
 */
export async function idsDeAdministradores(
  salvo: number | null,
  ejecutor?: Ejecutor,
): Promise<number[]> {
  const filas = await consultar<{ id: number }>(
    `SELECT id FROM vw_usuarios_completos
     WHERE rol = 'admin' AND activo AND ($1::int IS NULL OR id <> $1)`,
    [salvo],
    ejecutor,
  );

  return filas.map((fila) => fila.id);
}

/** Cuenta cuantas personas tienen un rol dado. Sirve para no quedarse sin admin. */
export async function contarPorRol(rol: string): Promise<number> {
  const fila = await consultarUno<{ total: string }>(
    "SELECT count(*)::text AS total FROM vw_usuarios_completos WHERE rol = $1 AND activo",
    [rol],
  );

  return Number(fila?.total ?? 0);
}

/**
 * El equipo de la agencia: los trabajadores activos, para asignarles tareas,
 * fases o piezas. Con su cargo, que ayuda a elegir.
 */
export async function equipo(ejecutor?: Ejecutor): Promise<PersonaDeEquipo[]> {
  return consultar<PersonaDeEquipo>(
    `SELECT id,
            nombre || ' ' || apellido AS nombre,
            cargo
     FROM vw_usuarios_completos
     WHERE activo AND tipo = 'trabajador'
     ORDER BY lower(nombre), lower(apellido)`,
    [],
    ejecutor,
  );
}
