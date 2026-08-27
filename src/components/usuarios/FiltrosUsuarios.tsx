import type { Cargo, DefinicionFiltro } from "@/types";

/**
 * Los filtros del listado de usuarios.
 *
 * Son datos, no componentes: el listado estandar los pinta como desplegables y
 * cada uno acaba siendo un parametro de la URL, asi que sus claves tienen que
 * coincidir con las que la page declara en `filtrosPermitidos`.
 *
 * Ninguno declara su opcion de "Todos": esa la antepone `ListadoFiltros` para
 * que se llame igual en toda la aplicacion.
 */

export function filtrosUsuarios(cargos: Cargo[]): DefinicionFiltro[] {
  return [
    {
      clave: "tipo",
      titulo: "Tipo de usuario",
      opciones: [
        { valor: "trabajador", texto: "Trabajadores" },
        { valor: "cliente", texto: "Clientes" },
      ],
    },

    {
      clave: "rol",
      titulo: "Rol",
      opciones: [
        { valor: "admin", texto: "Admin" },
        { valor: "trabajador", texto: "Trabajador" },
        { valor: "cliente", texto: "Cliente" },
      ],
    },

    {
      clave: "cargo",
      titulo: "Area de la agencia",
      // Las areas se leen de la base y no se escriben aqui: son un conjunto
      // cerrado que vive en el esquema, y duplicarlo dejaria la lista atras en
      // cuanto se anadiera una.
      opciones: cargos.map((cargo) => ({
        valor: cargo.slug,
        texto: cargo.nombre,
      })),
    },

    {
      clave: "activo",
      titulo: "Estado de la cuenta",
      opciones: [
        { valor: "true", texto: "Activos" },
        { valor: "false", texto: "Desactivados" },
      ],
    },
  ];
}
