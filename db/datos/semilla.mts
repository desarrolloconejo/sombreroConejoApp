/**
 * Los datos minimos con los que arranca la aplicacion: roles, la empresa de
 * ejemplo, las cuentas, las dos reglas y la referencia del banco.
 *
 * Viven aparte porque tienen DOS consumidores y no puede haber dos versiones:
 *
 *   db/seed.mts        los inserta contra la base local, por conexion directa
 *   db/generarSql.mts  los vuelca a SQL para pegarlos en el panel de Neon
 *
 * Las 42 aperturas estan en ./aperturas.mts, por volumen.
 */

export const RONDAS_BCRYPT = 12;

export type Rol = {
  nombre: string;
  descripcion: string;
};

export const ROLES: Rol[] = [
  { nombre: "admin", descripcion: "Administra la plataforma y crea usuarios" },
  { nombre: "trabajador", descripcion: "Personal de la agencia" },
  { nombre: "cliente", descripcion: "Persona de una empresa cliente" },
];

export const EMPRESA_DEMO = {
  nombre: "Distribuidora Ejemplo, C.A.",
  rif: "J-30123456-7",
  telefono: "+58 212 555 0100",
  direccion: "Av. Principal, Caracas",
  // El sector alimenta el escalon del medio de la resolucion de regla:
  // cliente -> sector -> estandar de la casa.
  sector: "Hosteleria",
};

export type UsuarioSemilla = {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  telefono: string | null;

  /**
   * Si al entrar se le pide configurar la verificacion en dos pasos, que es
   * lo que le pasa por defecto a cualquier cuenta real. En la semilla es al
   * reves: solo se le pide a la que lo declara.
   */
  pideDosPasos?: boolean;
  perfil:
    // El cargo de un trabajador es un slug de la tabla cargos: de el
    // depende QUE MODULOS ve. El de un cliente es texto libre, describe
    // su puesto en su propia empresa, y no decide nada.
    | { tipo: "trabajador"; rol: string; cargo: string }
    | { tipo: "cliente"; cargo: string };
};

/*
 * El administrador es una cuenta REAL; los otros tres son de prueba y sus
 * correos usan dominios .test, reservados por norma: no pueden chocar nunca
 * con un dominio real.
 *
 * Los tres de prueba existen para poder comprobar la autorizacion de un
 * vistazo, no por adorno: `redes` ve el modulo de Hooks, `diseno` no lo ve, y
 * el cliente ve lo suyo.
 *
 * OJO: sus contrasenas estan aqui, y esto es codigo versionado. Es aceptable
 * mientras la aplicacion sea desarrollo y demostracion. En cuanto guarde datos
 * reales de la agencia hay que borrar esas tres cuentas de produccion.
 */
export const USUARIOS: UsuarioSemilla[] = [
  {
    nombre: "Juan",
    apellido: "Vivas",
    email: "juanvivas043@gmail.com",
    password: "Conejo404",
    telefono: "+58 412 555 0101",
    perfil: { tipo: "trabajador", rol: "admin", cargo: "direccion" },
  },
  {
    nombre: "Luis",
    apellido: "Perez",
    email: "diseno@conejo.test",
    password: "Trabajador123*",
    telefono: "+58 412 555 0102",
    perfil: { tipo: "trabajador", rol: "trabajador", cargo: "diseno" },
  },
  {
    nombre: "Carla",
    apellido: "Mendez",
    email: "redes@conejo.test",
    password: "Trabajador123*",
    telefono: "+58 412 555 0104",
    perfil: { tipo: "trabajador", rol: "trabajador", cargo: "redes" },
  },
  {
    nombre: "Maria",
    apellido: "Gomez",
    email: "cliente@empresa.test",
    password: "Cliente123*",
    telefono: "+58 412 555 0103",
    perfil: { tipo: "cliente", cargo: "Gerente de mercadeo" },
  },
  /*
   * La cuenta sobre la que las pruebas hacen lo que no se puede deshacer:
   * restablecerle la contrasena, por ejemplo. Nadie inicia sesion con ella, y
   * por eso da igual que su contrasena deje de ser la de aqui.
   *
   * De paso es la unica persona de produccion de la semilla.
   */
  {
    nombre: "Pruebas",
    apellido: "Automaticas",
    email: "pruebas@conejo.test",
    password: "Trabajador123*",
    telefono: null,
    perfil: { tipo: "trabajador", rol: "trabajador", cargo: "produccion" },
  },
  /*
   * La cuenta que las pruebas bloquean a proposito, fallando su contrasena.
   * Va aparte de la anterior porque las pruebas corren en paralelo: si a una
   * misma cuenta le restablecieran la contrasena mientras otra prueba cuenta
   * sus fallos, el contador volveria a cero a mitad.
   */
  {
    nombre: "Bloqueo",
    apellido: "Automatico",
    email: "bloqueo@conejo.test",
    password: "Trabajador123*",
    telefono: null,
    perfil: { tipo: "trabajador", rol: "trabajador", cargo: "produccion" },
  },
  /*
   * La cuenta con la que las pruebas recorren la verificacion en dos pasos.
   * Es la unica de la semilla a la que se le PIDE configurarla al entrar: a
   * las demas el seed les apunta que prefieren no usarla, para que entrar con
   * ellas siga siendo correo y contrasena.
   */
  {
    nombre: "Dos",
    apellido: "Pasos",
    email: "dospasos@conejo.test",
    password: "Trabajador123*",
    telefono: null,
    pideDosPasos: true,
    perfil: { tipo: "trabajador", rol: "trabajador", cargo: "produccion" },
  },
];

/** Quien firma lo que siembra el seed: la creadora de contenido. */
export const EMAIL_CREADORA = "redes@conejo.test";

/**
 * Dos reglas de ejemplo, elegidas para que ensenen la resolucion completa:
 * la de sector amplia los limites de la casa (y por tanto sale marcada como
 * limite ampliado en el auditor), y la de cliente los devuelve al estandar
 * para demostrar que la del cliente gana sobre la del sector.
 */
export const REGLAS = [
  {
    etiqueta: "Estandar hosteleria",
    empresaId: null,
    sector: "Hosteleria",
    maxVoz: 16,
    maxInsert: 8,
    exigirPrueba: true,
  },
  {
    etiqueta: "Distribuidora Ejemplo",
    empresaId: 1,
    sector: null,
    maxVoz: 12,
    maxInsert: 6,
    exigirPrueba: true,
  },
];

/** Una referencia de ejemplo, para que el banco no arranque vacio. */
export const REFERENCIA = {
  hablado: "Publicar todos los dias esta hundiendo tu alcance.",
  insertTitulo: "Publicar a diario te frena",
  plataforma: "tiktok",
  territorio: "g",
  urlFuente: null as string | null,
  lectura:
    "Abre con una creencia del sector y pone la curva en pantalla antes " +
    "del segundo dos. La prueba llega antes que la explicacion.",
  etiquetas: "alcance, dato-propio, analitica",
};
