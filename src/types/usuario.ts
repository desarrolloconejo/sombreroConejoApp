/** Preferencia de tema. "sistema" sigue la configuracion del dispositivo. */
export type Tema = "sistema" | "claro" | "oscuro";

/** Una persona es trabajador de la empresa o cliente de la empresa, nunca ambos. */
export type TipoUsuario = "trabajador" | "cliente";

/**
 * Roles de autorizacion.
 * "admin" y "trabajador" salen de la tabla roles; "cliente" se deriva de que
 * la persona tenga fila en la tabla clientes.
 */
export type NombreRol = "admin" | "trabajador" | "cliente";

/**
 * Area de la agencia. Es el SEGUNDO eje de autorizacion, y no se mezcla con
 * el rol:
 *
 *   rol    -> que PUEDE HACER  (admin crea usuarios, trabajador no)
 *   cargo  -> que VE           (redes ve lo de redes, tecnologia lo suyo)
 *
 * Solo lo tienen los trabajadores. El equivalente para un cliente es su
 * empresa: dos clientes de empresas distintas ven contenidos distintos.
 */
export type SlugCargo =
  | "direccion"
  | "cuentas"
  | "redes"
  | "diseno"
  | "produccion"
  | "tecnologia"
  | "administracion";

/**
 * Datos de la tabla usuarios.
 *
 * No incluye `passwordHash` a proposito: este tipo es el que viaja hacia las
 * pages y los componentes, y el hash nunca debe salir de la capa de datos.
 */
export type Usuario = {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string | null;
  fotoUrl: string | null;
  tema: Tema;
  activo: boolean;

  /**
   * La contrasena la puso otra persona, en el alta o al restablecerla, y hay
   * que elegir una propia antes de poder hacer nada.
   */
  debeCambiarClave: boolean;

  ultimoAcceso: Date | null;
  creadoEn: Date;
  actualizadoEn: Date;
};

/**
 * Usuario resuelto con su tipo, rol y pertenencia, tal como lo devuelve la
 * vista vw_usuarios_completos. Es lo que consumen el dashboard y el perfil.
 */
export type UsuarioCompleto = Usuario & {
  tipo: TipoUsuario;
  rol: NombreRol;

  /**
   * Lo que se MUESTRA. Para un trabajador, el nombre de su cargo; para un
   * cliente, su puesto en su propia empresa, que es descriptivo y no decide
   * nada. No filtrar contenido con esto.
   */
  cargo: string | null;

  /**
   * Lo que DECIDE. Solo lo tienen los trabajadores, y es contra esto contra
   * lo que se filtra el contenido.
   */
  cargoSlug: SlugCargo | null;
  cargoId: number | null;

  fechaIngreso: Date | null;

  /** El ambito del cliente: determina que contenido ve. */
  empresaId: number | null;
  empresaNombre: string | null;
  empresaActiva: boolean | null;

  /** Si puede decidir en la fase 5 por su empresa. Solo clientes. */
  puedeAprobar: boolean | null;
};

/**
 * Usuario con su hash de contrasena.
 *
 * Solo lo usa la action de inicio de sesion, para comparar la contrasena. No
 * debe devolverse desde una page ni pasarse como prop a un componente.
 */
export type UsuarioConCredenciales = UsuarioCompleto & {
  passwordHash: string;

  /** Si ahora mismo no se le admite ningun intento, por fallos repetidos. */
  bloqueado: boolean;

  /** Si tras la contrasena hay que pedirle el codigo de su app. */
  dosPasos: boolean;
};

/** Datos necesarios para crear un usuario. La contrasena llega ya hasheada. */
export type DatosNuevoUsuario = {
  nombre: string;
  apellido: string;
  email: string;
  passwordHash: string;
  telefono: string | null;

  /** Cierto cuando la contrasena es provisional y la conoce quien da el alta. */
  debeCambiarClave: boolean;
};

/** Campos que una persona puede cambiar de su propio perfil. */
export type DatosPerfil = {
  nombre: string;
  apellido: string;
  telefono: string | null;
};

/** Columnas por las que se puede ordenar el listado de usuarios. */
export type OrdenUsuarios = "nombre" | "email" | "creadoEn" | "ultimoAcceso";

/** Filtros del listado de usuarios del modulo de administracion. */
export type FiltrosUsuarios = {
  busqueda?: string;

  /*
   * Los filtros son LISTAS: el listado admite elegir varios valores del mismo
   * grupo. Una lista vacia equivale a no filtrar por esa clave.
   */
  tipo?: TipoUsuario[];
  rol?: NombreRol[];
  cargo?: SlugCargo[];
  empresaId?: number[];
  activo?: boolean[];
  orden?: OrdenUsuarios;
  direccion?: "asc" | "desc";
  pagina?: number;
  porPagina?: number;
};

/** Un tramo de resultados junto con el total, para paginar. */
export type Pagina<T> = {
  filas: T[];
  total: number;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
};
