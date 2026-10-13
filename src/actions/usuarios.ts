"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";

import { anotar, soloCambios } from "@/lib/auditoria";
import {
  correoDeBienvenida,
  correoDeClaveRestablecida,
} from "@/lib/correos/plantillas";
import { CODIGO_ERROR, conSesion, esErrorPostgres, transaccion } from "@/lib/db";
import { encolarCorreo, entregarCorreos } from "@/lib/externos/correo";
import { notificarA } from "@/lib/notificaciones";
import { hashear } from "@/lib/password";
import { requerirAdmin } from "@/lib/sesion";
import {
  comoIdentificador,
  esEmail,
  LIMITES,
  limpiarOpcional,
  limpiarTexto,
} from "@/lib/validaciones";
import * as clientes from "@/models/clientes";
import * as sesiones from "@/models/sesiones";
import * as trabajadores from "@/models/trabajadores";
import * as usuarios from "@/models/usuarios";
import type {
  ErroresCampo,
  EstadoFormulario,
  UsuarioCompleto,
  ValoresAuditoria,
} from "@/types";

/** Lo que de una cuenta se anota cuando cambia. Nunca la contrasena. */
function paraAuditoria(usuario: UsuarioCompleto): ValoresAuditoria {
  return {
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    email: usuario.email,
    telefono: usuario.telefono,
    rol: usuario.rol,
    cargo: usuario.cargo,
    empresa: usuario.empresaNombre,
  };
}

/**
 * Alta de usuarios. Solo un administrador puede crear cuentas.
 *
 * La action coordina: valida lo que llega del formulario, pide el hash a lib y
 * deja las escrituras a los modelos. No escribe SQL ni sabe de criptografia.
 */

/** La ruta del listado, para revalidarla cuando cambia lo que muestra. */
const RUTA_LISTADO = "/dashboard/usuarios";

/**
 * Nombre del indice unico del correo (db/schema.sql).
 *
 * Hace falta porque PostgreSQL usa el mismo codigo de error para el correo
 * repetido y para el trigger que impide ser trabajador y cliente a la vez.
 * Solo el primero llega con una restriccion asociada.
 */
const INDICE_EMAIL = "usuarios_email_unico";

// Alfabetos sin caracteres que se confunden al dictarlos: ni ele minuscula ni
// i mayuscula ni uno, ni o mayuscula ni cero. La contrasena provisional se
// comunica de viva voz, asi que cada ambiguedad cuesta un intento fallido.
const MINUSCULAS = "abcdefghijkmnopqrstuvwxyz";
const MAYUSCULAS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const NUMEROS = "23456789";

const LONGITUD_PROVISIONAL = 14;

/**
 * Un caracter al azar del alfabeto.
 *
 * `randomInt` da un entero uniforme dentro del rango. `Math.random()` no es
 * criptografico, y un modulo sobre bytes crudos sesgaria las primeras letras
 * del alfabeto, que son las que mas se repetirian en las contrasenas.
 */
function elegir(alfabeto: string): string {
  return alfabeto.charAt(randomInt(alfabeto.length));
}

/**
 * Contrasena provisional que cumple las reglas de `validarPassword`: al menos
 * una minuscula, una mayuscula y un numero.
 */
function generarPasswordProvisional(): string {
  const todos = MINUSCULAS + MAYUSCULAS + NUMEROS;

  const caracteres = [elegir(MINUSCULAS), elegir(MAYUSCULAS), elegir(NUMEROS)];
  while (caracteres.length < LONGITUD_PROVISIONAL) {
    caracteres.push(elegir(todos));
  }

  // Sin barajar, las tres primeras posiciones tendrian siempre el mismo tipo
  // de caracter, y quien lo supiera se ahorraria parte de la busqueda.
  for (let posicion = caracteres.length - 1; posicion > 0; posicion -= 1) {
    const otra = randomInt(posicion + 1);
    const guardado = caracteres[posicion];
    caracteres[posicion] = caracteres[otra];
    caracteres[otra] = guardado;
  }

  return caracteres.join("");
}

/** Datos personales, comunes a los dos tipos de usuario. */
type Persona = {
  nombre: string;
  apellido: string;
  correo: string;
  telefono: string | null;
};

/**
 * A que se vincula la cuenta. Decide en que tabla cae la segunda insercion, y
 * por eso se modela como union: un trabajador nunca lleva empresa y un cliente
 * nunca lleva rol.
 */
type Vinculo =
  | { tipo: "trabajador"; rolId: number; cargoId: number }
  | { tipo: "cliente"; empresaId: number; cargo: string | null };

type Validacion = {
  persona: Persona;
  vinculo: Vinculo | null;
  errores: ErroresCampo;
};

/**
 * Valida los campos que comparten el alta y la edicion.
 *
 * Es el mismo conjunto en los dos casos, asi que se valida una sola vez: si
 * cada formulario trajera su propia comprobacion, cualquier regla nueva
 * tendria que anadirse dos veces y la segunda se olvidaria.
 */
function validarUsuario(datos: FormData): Validacion {
  const persona: Persona = {
    nombre: limpiarTexto(datos.get("nombre"), LIMITES.nombre),
    apellido: limpiarTexto(datos.get("apellido"), LIMITES.apellido),
    correo: limpiarTexto(datos.get("correo"), LIMITES.email).toLowerCase(),
    telefono: limpiarOpcional(datos.get("telefono"), LIMITES.telefono),
  };

  const errores: ErroresCampo = {};

  if (!persona.nombre) errores.nombre = "Escribe el nombre";
  if (!persona.apellido) errores.apellido = "Escribe el apellido";

  if (!persona.correo) {
    errores.correo = "Escribe el correo";
  } else if (!esEmail(persona.correo)) {
    errores.correo = "El correo no tiene un formato valido";
  }

  if (persona.telefono && !/^[\d\s+()-]{7,}$/.test(persona.telefono)) {
    errores.telefono = "El telefono solo puede tener numeros, espacios y + ( ) -";
  }

  const tipo = datos.get("tipo");
  let vinculo: Vinculo | null = null;

  if (tipo === "trabajador") {
    const rolId = comoIdentificador(datos.get("rolId"));
    const cargoId = comoIdentificador(datos.get("cargoId"));

    if (rolId === null) errores.rolId = "Elige el rol dentro de la agencia";
    if (cargoId === null) errores.cargoId = "Elige el area a la que pertenece";

    if (rolId !== null && cargoId !== null) {
      vinculo = { tipo: "trabajador", rolId, cargoId };
    }
  } else if (tipo === "cliente") {
    const empresaId = comoIdentificador(datos.get("empresaId"));

    if (empresaId === null) {
      errores.empresaId = "Elige la empresa a la que pertenece";
    } else {
      // El cargo de un cliente es texto libre y descriptivo: dice que hace en
      // SU empresa, no decide nada dentro de la aplicacion.
      vinculo = {
        tipo: "cliente",
        empresaId,
        cargo: limpiarOpcional(datos.get("cargo"), LIMITES.cargo),
      };
    }
  } else {
    errores.tipo = "Elige si es trabajador de la agencia o cliente";
  }

  return { persona, vinculo, errores };
}

/** La restriccion que PostgreSQL reporta junto al error, si la hay. */
function restriccionDe(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("constraint" in error)) {
    return null;
  }

  const nombre = (error as { constraint?: unknown }).constraint;
  return typeof nombre === "string" ? nombre : null;
}

/**
 * Crea una cuenta con su vinculo de trabajador o de cliente.
 *
 * La contrasena provisional se genera aqui y vuelve en el mensaje: no hay
 * envio de correo, asi que es el administrador quien tiene que comunicarla.
 */
export async function crearUsuario(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  // Primero la barrera. El proxy ya filtra la ruta, pero una Server Action es
  // un POST a la page donde se usa: si el matcher cambiara, esta llamada es lo
  // unico que seguiria impidiendo que cualquiera cree cuentas.
  const admin = await requerirAdmin();

  const { persona, vinculo, errores } = validarUsuario(datos);

  if (Object.keys(errores).length > 0 || vinculo === null) {
    return { ok: false, errores };
  }

  if (await usuarios.existeEmail(persona.correo)) {
    return { ok: false, errores: { correo: "Ya hay una cuenta con ese correo" } };
  }

  const provisional = generarPasswordProvisional();
  const passwordHash = await hashear(provisional);

  let correoId: number | null = null;

  try {
    // Las dos inserciones van juntas o no va ninguna: un usuario sin fila en
    // trabajadores ni en clientes no tiene rol, y sin rol no podria entrar.
    // Va con `conSesion` y no con `transaccion` porque escribe en la bandeja
    // de salida, que tiene seguridad por fila.
    correoId = await conSesion(admin, async (cliente) => {
      const creado = await usuarios.crear(
        {
          nombre: persona.nombre,
          apellido: persona.apellido,
          email: persona.correo,
          passwordHash,
          telefono: persona.telefono,
          // La conoce quien da el alta: al entrar tendra que elegir otra.
          debeCambiarClave: true,
        },
        cliente,
      );

      if (vinculo.tipo === "trabajador") {
        await trabajadores.crear(
          {
            usuarioId: creado.id,
            rolId: vinculo.rolId,
            cargoId: vinculo.cargoId,
            fechaIngreso: null,
          },
          cliente,
        );
      } else {
        await clientes.crear(
          {
            usuarioId: creado.id,
            empresaId: vinculo.empresaId,
            cargo: vinculo.cargo,
          },
          cliente,
        );
      }

      // Se lee ya resuelta para anotar el rol, el cargo y la empresa con su
      // nombre, que es lo que alguien entendera al leer la linea.
      const completo = await usuarios.buscarPorId(creado.id, cliente);

      await anotar(cliente, admin, "usuario.creado", {
        entidadId: creado.id,
        empresaId: completo?.empresaId ?? null,
        despues: completo ? paraAuditoria(completo) : { email: creado.email },
      });

      // El aviso de que la cuenta existe. La contrasena NO va en el: se
      // entrega en mano, como hasta ahora.
      return encolarCorreo(
        cliente,
        admin,
        correoDeBienvenida({
          id: creado.id,
          nombre: creado.nombre,
          email: creado.email,
          empresaId: completo?.empresaId ?? null,
        }),
      );
    });
  } catch (error) {
    if (esErrorPostgres(error, CODIGO_ERROR.VIOLACION_UNICIDAD)) {
      if (restriccionDe(error) === INDICE_EMAIL) {
        // Alguien registro ese correo entre la comprobacion y la insercion.
        return {
          ok: false,
          errores: { correo: "Ya hay una cuenta con ese correo" },
        };
      }

      // El trigger de exclusividad lanza el mismo codigo, pero sin restriccion.
      return {
        ok: false,
        mensaje: "Esa persona ya figura como trabajador o como cliente",
      };
    }

    if (esErrorPostgres(error, CODIGO_ERROR.VIOLACION_LLAVE_FORANEA)) {
      // El formulario se cargo con unas opciones y alguna dejo de existir
      // antes de enviarlo.
      const restriccion = restriccionDe(error) ?? "";

      if (restriccion.includes("empresa")) {
        return {
          ok: false,
          errores: { empresaId: "Esa empresa ya no existe. Recarga la pagina" },
        };
      }

      if (restriccion.includes("cargo")) {
        return {
          ok: false,
          errores: { cargoId: "Esa area ya no existe. Recarga la pagina" },
        };
      }

      if (restriccion.includes("rol")) {
        return {
          ok: false,
          errores: { rolId: "Ese rol ya no existe. Recarga la pagina" },
        };
      }

      return {
        ok: false,
        mensaje: "Alguno de los datos elegidos ya no existe. Recarga la pagina",
      };
    }

    throw error;
  }

  // Con la cuenta ya creada y confirmada. Si el correo no sale, la cuenta
  // existe igual y el mensaje queda en la bandeja para reintentarlo.
  await entregarCorreos(admin, [correoId]);

  revalidatePath(RUTA_LISTADO);

  // La contrasena vuelve en `credencial` y NO dentro del mensaje: quien la
  // reciba tiene que poder copiarla y verla destacada, no buscarla dentro de
  // una frase.
  return {
    ok: true,
    credencial: { email: persona.correo, password: provisional },
  };
}

/**
 * Genera una contrasena provisional nueva para una cuenta ajena.
 *
 * Es la red de seguridad que faltaba. La provisional del alta se muestra una
 * sola vez, y sin esto una clave perdida dejaba la cuenta MUERTA: la persona
 * no podia entrar, el administrador no podia darle otra —`editarUsuario` no
 * toca la contrasena a proposito— y el cambio desde el perfil exige la actual,
 * que es justo la que se perdio. Como el correo es unico, ni siquiera se podia
 * recrear la cuenta.
 *
 * Sigue sin permitir suplantar: el administrador no elige la contrasena ni ve
 * la anterior, solo provoca una nueva al azar que tendra que entregar en mano.
 */
export async function restablecerPassword(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const admin = await requerirAdmin();

  const id = comoIdentificador(datos.get("id"));

  if (id === null) {
    return { ok: false, mensaje: "No se pudo identificar la cuenta" };
  }

  const usuario = await usuarios.buscarPorId(id);

  if (!usuario) {
    return { ok: false, mensaje: "Esa cuenta ya no existe" };
  }

  /*
   * Para la propia cuenta no.
   *
   * No es por seguridad —un administrador ya puede cambiarse la contrasena
   * desde su perfil— sino porque el resultado seria peor: se quedaria con una
   * clave al azar en lugar de la que eligio, y la sesion abierta seguiria
   * valiendo hasta caducar, asi que ni siquiera notaria el cambio hasta el
   * dia siguiente.
   */
  if (usuario.id === admin.id) {
    return {
      ok: false,
      mensaje: "Para tu propia cuenta usa el cambio de contrasena de Mi perfil",
    };
  }

  const provisional = generarPasswordProvisional();
  const hashProvisional = await hashear(provisional);

  const correoId = await conSesion(admin, async (tx) => {
    const hecho = await usuarios.actualizarPasswordHash(
      usuario.id,
      hashProvisional,
      // La conoce el administrador: al entrar tendra que elegir otra.
      true,
      tx,
    );

    if (!hecho) return null;

    // Quien estuviera dentro con la contrasena anterior, fuera.
    const cerradas = await sesiones.revocarDeUsuario(
      usuario.id,
      "clave_restablecida",
      null,
      tx,
    );

    await anotar(tx, admin, "usuario.clave_restablecida", {
      entidadId: usuario.id,
      empresaId: usuario.empresaId,
      despues: { sesionesCerradas: cerradas },
    });

    // Que la persona se entere por un canal que no controla quien lo hizo:
    // el correo, y la campana la proxima vez que entre.
    await notificarA(tx, [usuario.id], {
      tipo: "cuenta.clave_restablecida",
      titulo: "Un administrador restablecio tu contrasena",
      cuerpo: "Si no lo esperabas, avisa a la agencia.",
      href: "/dashboard/perfil",
      empresaId: usuario.empresaId,
    });

    return encolarCorreo(tx, admin, correoDeClaveRestablecida(usuario));
  });

  if (correoId === null) {
    return { ok: false, mensaje: "No se pudo restablecer la contrasena" };
  }

  await entregarCorreos(admin, [correoId]);

  return {
    ok: true,
    credencial: { email: usuario.email, password: provisional },
  };
}

/**
 * Guarda los cambios de una cuenta existente.
 *
 * No toca la contrasena: para eso esta el cambio de contrasena, que exige la
 * actual. Un administrador puede corregir datos y vinculo, no suplantar.
 *
 * El TIPO tampoco se cambia aqui. Pasar de trabajador a cliente significa
 * borrar una fila y crear otra en la tabla contraria, y con ella se irian el
 * cargo, la empresa y el historial: es un alta nueva, no una edicion, y el
 * trigger de exclusividad del esquema lo impide de todos modos.
 */
export async function editarUsuario(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const admin = await requerirAdmin();

  const id = comoIdentificador(datos.get("id"));

  if (id === null) {
    return { ok: false, mensaje: "No se pudo identificar la cuenta a editar" };
  }

  const existente = await usuarios.buscarPorId(id);

  if (!existente) {
    return { ok: false, mensaje: "Esa cuenta ya no existe" };
  }

  const { persona, vinculo, errores } = validarUsuario(datos);

  if (Object.keys(errores).length > 0 || vinculo === null) {
    return { ok: false, errores };
  }

  // El formulario manda el tipo que ya tenia, pero llega del cliente: si no
  // coincidiera se estaria escribiendo en la tabla equivocada.
  if (vinculo.tipo !== existente.tipo) {
    return {
      ok: false,
      mensaje: "No se puede cambiar de trabajador a cliente ni al reves",
    };
  }

  if (await usuarios.existeEmailDeOtro(persona.correo, id)) {
    return { ok: false, errores: { correo: "Ya hay otra cuenta con ese correo" } };
  }

  try {
    await transaccion(async (cliente) => {
      await usuarios.actualizarComoAdmin(
        id,
        {
          nombre: persona.nombre,
          apellido: persona.apellido,
          email: persona.correo,
          telefono: persona.telefono,
        },
        cliente,
      );

      if (vinculo.tipo === "trabajador") {
        await trabajadores.actualizar(
          id,
          { rolId: vinculo.rolId, cargoId: vinculo.cargoId },
          cliente,
        );
      } else {
        await clientes.actualizar(
          id,
          { empresaId: vinculo.empresaId, cargo: vinculo.cargo },
          cliente,
        );
      }

      const actualizado = await usuarios.buscarPorId(id, cliente);
      if (!actualizado) return;

      /*
       * Si cambio lo que decide que ve o que puede hacer, sus sesiones
       * abiertas se cierran: el token que tienen dice lo de antes, y volver a
       * entrar es lo que les da uno con lo de ahora.
       */
      const cambioDeVinculo =
        actualizado.rol !== existente.rol ||
        actualizado.cargoSlug !== existente.cargoSlug ||
        actualizado.empresaId !== existente.empresaId;

      const cerradas = cambioDeVinculo
        ? await sesiones.revocarDeUsuario(id, "vinculo_cambiado", null, cliente)
        : 0;

      const cambios = soloCambios(
        paraAuditoria(existente),
        paraAuditoria(actualizado),
      );

      if (cambios) {
        await anotar(cliente, admin, "usuario.editado", {
          entidadId: id,
          empresaId: actualizado.empresaId,
          antes: cambios.antes,
          despues: cambioDeVinculo
            ? { ...cambios.despues, sesionesCerradas: cerradas }
            : cambios.despues,
        });
      }
    });
  } catch (error) {
    if (esErrorPostgres(error, CODIGO_ERROR.VIOLACION_UNICIDAD)) {
      return { ok: false, errores: { correo: "Ya hay otra cuenta con ese correo" } };
    }

    if (esErrorPostgres(error, CODIGO_ERROR.VIOLACION_LLAVE_FORANEA)) {
      return {
        ok: false,
        mensaje: "Alguno de los datos elegidos ya no existe. Recarga la pagina",
      };
    }

    throw error;
  }

  revalidatePath(RUTA_LISTADO);

  return { ok: true, mensaje: "Los cambios quedaron guardados" };
}

/**
 * Activa o desactiva una cuenta. NO borra.
 *
 * Una cuenta borrada se llevaria por delante lo que esa persona hizo, y las
 * llaves foraneas de lo que cuelgue de ella en las fases siguientes. Desactivar
 * cierra el acceso y conserva el rastro, que es lo que se necesita de verdad
 * cuando alguien deja la agencia.
 */
export async function cambiarEstadoUsuario(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const admin = await requerirAdmin();

  const id = comoIdentificador(datos.get("id"));

  if (id === null) {
    return { ok: false, mensaje: "No se pudo identificar la cuenta" };
  }

  const usuario = await usuarios.buscarPorId(id);

  if (!usuario) {
    return { ok: false, mensaje: "Esa cuenta ya no existe" };
  }

  // Nadie se cierra a si mismo la puerta: quedaria fuera de la aplicacion sin
  // forma de volver a entrar a reactivarse.
  if (usuario.id === admin.id) {
    return { ok: false, mensaje: "No puedes desactivar tu propia cuenta" };
  }

  const activar = !usuario.activo;

  /*
   * Y sin quedarse sin administradores.
   *
   * `contarPorRol` cuenta los ACTIVOS, asi que si solo queda uno y es este,
   * desactivarlo dejaria la aplicacion sin nadie que pueda crear cuentas ni
   * reactivar a nadie. No hay forma de salir de ese estado desde la interfaz.
   */
  if (!activar && usuario.rol === "admin") {
    const admins = await usuarios.contarPorRol("admin");

    if (admins <= 1) {
      return {
        ok: false,
        mensaje:
          "Es el unico administrador activo. Nombra a otro antes de desactivarlo.",
      };
    }
  }

  const cambiado = await transaccion(async (tx) => {
    if (!(await usuarios.cambiarEstado(id, activar, tx))) return false;

    const cerradas = activar
      ? 0
      : await sesiones.revocarDeUsuario(id, "usuario_desactivado", null, tx);

    await anotar(tx, admin, activar ? "usuario.activado" : "usuario.desactivado", {
      entidadId: id,
      empresaId: usuario.empresaId,
      antes: { activo: !activar },
      despues: activar
        ? { activo: true }
        : { activo: false, sesionesCerradas: cerradas },
    });

    return true;
  });

  if (!cambiado) {
    return { ok: false, mensaje: "No se pudo cambiar el estado de la cuenta" };
  }

  revalidatePath(RUTA_LISTADO);

  return {
    ok: true,
    mensaje: activar
      ? `La cuenta de ${usuario.nombre} vuelve a estar activa`
      : `La cuenta de ${usuario.nombre} quedo desactivada`,
  };
}
