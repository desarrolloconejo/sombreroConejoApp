import type { NombreRol, SlugCargo } from "./usuario";

/** Fila de la tabla roles. */
export type Rol = {
  id: number;
  nombre: NombreRol;
  descripcion: string | null;
};

/**
 * Area de la agencia a la que pertenece un trabajador.
 *
 * No es un dato descriptivo: de el depende que contenido ve esa persona.
 * Es el segundo eje de autorizacion, independiente del rol.
 */
export type Cargo = {
  id: number;
  slug: SlugCargo;
  nombre: string;
  descripcion: string | null;
};

/**
 * Empresa cliente. Puede tener varias personas de contacto, y determina que
 * contenido ven todas ellas.
 */
export type Empresa = {
  id: number;
  nombre: string;
  rif: string | null;

  /**
   * El sector, que decide la regla del auditor cuando la empresa no tiene
   * una propia: la resolucion es cliente, luego sector, luego el estandar.
   */
  sector: string | null;
  telefono: string | null;
  direccion: string | null;
  logoUrl: string | null;
  activo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
};

/** Datos necesarios para registrar una empresa. */
export type DatosNuevaEmpresa = {
  nombre: string;
  rif: string | null;
  sector: string | null;
  telefono: string | null;
  direccion: string | null;
};

/** Vinculo de un usuario con el personal de la empresa. */
export type Trabajador = {
  id: number;
  usuarioId: number;
  rolId: number;
  cargoId: number;
  fechaIngreso: Date | null;
  creadoEn: Date;
};

/** Vinculo de un usuario con una empresa cliente. */
export type Cliente = {
  id: number;
  usuarioId: number;
  empresaId: number;
  cargo: string | null;
  creadoEn: Date;
};
