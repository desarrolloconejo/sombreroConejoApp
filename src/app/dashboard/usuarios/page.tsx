import type { Metadata } from "next";
import { Plus } from "lucide-react";

import { Wrapper } from "@/components/layout/Wrapper";
import {
  Listado,
  ListadoVacio,
  ModalConfirmacion,
  PanelLateral,
} from "@/components/listado";
import {
  columnasUsuarios,
  ConfirmarEstadoUsuario,
  ConfirmarRestablecer,
  DetalleUsuario,
  filtrosUsuarios,
  FormularioEditarUsuario,
  FormularioNuevoUsuario,
} from "@/components/usuarios";
import { BotonEnlace } from "@/components/ui";
import { leerEstadoListado } from "@/lib/parametros";
import { requerirAdmin } from "@/lib/sesion";
import { conPanel } from "@/lib/urlListado";
import * as dosPasosModelo from "@/models/dosPasos";
import * as cargosModelo from "@/models/cargos";
import * as empresasModelo from "@/models/empresas";
import * as rolesModelo from "@/models/roles";
import * as usuariosModelo from "@/models/usuarios";
import type {
  Cargo,
  FiltrosUsuarios,
  NombreEmpresa,
  NombreRol,
  OrdenUsuarios,
  SlugCargo,
  TipoUsuario,
} from "@/types";

/**
 * El listado de usuarios, y el ejemplo de como se usa el patron de listado.
 *
 * La page hace lo que le toca en este proyecto: exige el permiso, lee el
 * estado de la URL, consulta los modelos e INYECTA todo como props. No pinta
 * ninguna tabla: de eso se encarga el listado estandar.
 */

export const metadata: Metadata = {
  title: "Usuarios",
};

const RUTA = "/dashboard/usuarios";

/**
 * Por que columnas se puede ordenar.
 *
 * Es la misma lista que acepta el modelo, y sirve para dos cosas: filtrar lo
 * que llega por la URL y convertirlo despues sin inventar una clave. Un valor
 * fuera de aqui haria que `identificadorSeguro` lanzara.
 */
const ORDEN_PERMITIDO: readonly OrdenUsuarios[] = [
  "nombre",
  "email",
  "creadoEn",
  "ultimoAcceso",
];

const TIPOS: readonly TipoUsuario[] = ["trabajador", "cliente"];
const ROLES: readonly NombreRol[] = ["admin", "trabajador", "cliente"];

const MIGAS = [{ texto: "Conejo App", href: "/dashboard" }, { texto: "Usuarios" }];

/**
 * Las conversiones de abajo existen porque `leerEstadoListado` devuelve texto
 * (lo unico que hay en una URL) y el modelo espera valores tipados. Cada una
 * descarta lo que no reconoce en lugar de arriesgar un cast: un parametro
 * escrito a mano no debe llegar nunca a la consulta.
 */
function comoOrden(valor: string): OrdenUsuarios {
  return ORDEN_PERMITIDO.find((clave) => clave === valor) ?? "creadoEn";
}

/*
 * Reciben y devuelven LISTAS porque el listado admite varios valores por
 * grupo. Filtrar aqui, ademas, hace que "?rol=admin&rol=inventado" consulte
 * por el valido y descarte el otro, en lugar de fallar entera.
 *
 * Devuelven `undefined` cuando no queda nada valido: una lista vacia y la
 * ausencia de filtro significan lo mismo, y el modelo solo entiende una.
 */
function soloValidos<T>(valores: T[]): T[] | undefined {
  return valores.length > 0 ? valores : undefined;
}

function comoTipos(valores: string[] | undefined): TipoUsuario[] | undefined {
  return soloValidos(
    (valores ?? []).filter((v): v is TipoUsuario => TIPOS.some((t) => t === v)),
  );
}

function comoRoles(valores: string[] | undefined): NombreRol[] | undefined {
  return soloValidos(
    (valores ?? []).filter((v): v is NombreRol => ROLES.some((r) => r === v)),
  );
}

/** El area se valida contra las que existen en la base, no contra una lista. */
function comoCargos(
  valores: string[] | undefined,
  cargos: Cargo[],
): SlugCargo[] | undefined {
  return soloValidos(
    (valores ?? [])
      .map((v) => cargos.find((cargo) => cargo.slug === v)?.slug)
      .filter((slug): slug is SlugCargo => slug !== undefined),
  );
}

/**
 * La empresa se valida contra las que existen, igual que el area: asi
 * "?empresa=999" consulta como si no hubiera filtro en lugar de devolver una
 * lista vacia sin explicacion.
 */
function comoEmpresas(
  valores: string[] | undefined,
  empresas: NombreEmpresa[],
): number[] | undefined {
  return soloValidos(
    (valores ?? [])
      .map(Number)
      .filter((id) => empresas.some((empresa) => empresa.id === id)),
  );
}

/** El chip manda "true" o "false"; el modelo espera booleanos. */
function comoActivos(valores: string[] | undefined): boolean[] | undefined {
  return soloValidos(
    (valores ?? [])
      .filter((v) => v === "true" || v === "false")
      .map((v) => v === "true"),
  );
}

/** Lo que necesitan los desplegables del alta y de la edicion. */
async function cargarOpciones() {
  const [roles, empresas] = await Promise.all([
    rolesModelo.listarAsignables(),
    empresasModelo.listarActivas(),
  ]);

  return { roles, empresas };
}

/**
 * Los paneles que trabajan sobre un registro concreto.
 *
 * Se resuelve en una sola funcion para que la consulta salga una vez: los cuatro
 * necesitan el usuario, y solo dos de ellos las opciones de los desplegables.
 * Si el id no corresponde a nadie devuelve null y no se abre nada, que es lo
 * que pasa al recargar un "?panel=editar&id=999" viejo.
 */
async function cargarPanelDeRegistro(panel: string | null, id: number | null) {
  if (!panel || id === null) return null;
  if (!["ver", "editar", "estado", "clave"].includes(panel)) return null;

  const usuario = await usuariosModelo.buscarPorId(id);

  if (!usuario) return null;

  // La ficha y la confirmacion no llevan desplegables: no hace falta traerlos.
  const opciones = panel === "editar" ? await cargarOpciones() : null;

  return { usuario, opciones };
}

export default async function PaginaUsuarios(
  props: PageProps<"/dashboard/usuarios">,
) {
  // El proxy ya filtra esta ruta por rol, pero la comprobacion tiene que estar
  // tambien aqui: es lo que impide el acceso si su matcher cambia.
  await requerirAdmin();

  const parametros = await props.searchParams;

  const estado = leerEstadoListado(parametros, {
    ordenPermitido: ORDEN_PERMITIDO,
    ordenPorDefecto: "creadoEn",
    direccionPorDefecto: "desc",
    filtrosPermitidos: ["tipo", "rol", "cargo", "activo", "empresa"],
  });

  // Areas y empresas se consultan siempre porque alimentan los chips del
  // filtro, y de paso son la lista blanca contra la que se validan `cargo` y
  // `empresa`. Las dos son consultas cortas y sin paginar.
  const [cargos, empresas] = await Promise.all([
    cargosModelo.listar(),
    empresasModelo.nombres(),
  ]);

  const filtros: FiltrosUsuarios = {
    busqueda: estado.busqueda || undefined,
    tipo: comoTipos(estado.filtros.tipo),
    rol: comoRoles(estado.filtros.rol),
    cargo: comoCargos(estado.filtros.cargo, cargos),
    activo: comoActivos(estado.filtros.activo),
    empresaId: comoEmpresas(estado.filtros.empresa, empresas),
    orden: comoOrden(estado.orden),
    direccion: estado.direccion,
    pagina: estado.pagina,
    porPagina: estado.porPagina,
  };

  const abrirAlta = estado.panel === "nuevo";

  const [pagina, alta, registro] = await Promise.all([
    usuariosModelo.listar(filtros),
    abrirAlta ? cargarOpciones() : null,
    cargarPanelDeRegistro(estado.panel, estado.panelId),
  ]);

  const hrefAlta = conPanel(RUTA, estado, "nuevo");
  const hrefCerrar = conPanel(RUTA, estado, null);

  return (
    <Wrapper
      migas={MIGAS}
      kicker="Solo para administradores"
      titulo="Usuarios"
      descripcion="Trabajadores de la agencia y personas de contacto de cada empresa cliente."
    >
      <Listado
        ruta={RUTA}
        estado={estado}
        columnas={columnasUsuarios(RUTA, estado)}
        filtros={filtrosUsuarios(cargos, empresas)}
        filas={pagina.filas}
        total={pagina.total}
        totalPaginas={pagina.totalPaginas}
        claveFila={(usuario) => usuario.id}
        titulo="Usuarios de la aplicacion"
        etiquetaBusqueda="Buscar usuarios"
        marcadorBusqueda="Buscar por nombre o correo"
        accion={{
          texto: "Nuevo usuario",
          href: hrefAlta,
          icono: <Plus aria-hidden="true" />,
        }}
        vacio={
          <ListadoVacio
            titulo="Todavia no hay usuarios"
            descripcion="Las cuentas las crea un administrador. La primera que aparezca aqui sera la que crees ahora."
            accion={
              <BotonEnlace href={hrefAlta} tamano="chico">
                <Plus aria-hidden="true" />
                Nuevo usuario
              </BotonEnlace>
            }
          />
        }
        panel={
          <>
            {alta && (
              <PanelLateral
                hrefCerrar={hrefCerrar}
                kicker="Alta de cuenta"
                titulo="Nuevo usuario"
                descripcion="Se genera una contrasena provisional. No se envia ningun correo: hay que entregarsela en persona."
              >
                <FormularioNuevoUsuario
                  roles={alta.roles}
                  cargos={cargos}
                  empresas={alta.empresas}
                  hrefCancelar={hrefCerrar}
                />
              </PanelLateral>
            )}

            {registro && estado.panel === "ver" && (
              <PanelLateral
                hrefCerrar={hrefCerrar}
                kicker="Ficha de la cuenta"
                titulo={`${registro.usuario.nombre} ${registro.usuario.apellido}`}
              >
                <DetalleUsuario
                  usuario={registro.usuario}
                  dosPasos={
                    (await dosPasosModelo.estado(registro.usuario.id)).activado
                  }
                  hrefEditar={conPanel(RUTA, estado, "editar", registro.usuario.id)}
                  hrefCerrar={hrefCerrar}
                />
              </PanelLateral>
            )}

            {registro && registro.opciones && estado.panel === "editar" && (
              <PanelLateral
                hrefCerrar={hrefCerrar}
                kicker="Editar cuenta"
                titulo={`${registro.usuario.nombre} ${registro.usuario.apellido}`}
                descripcion="La contrasena no se cambia desde aqui: solo la cambia su duena, y le pide la actual."
              >
                <FormularioEditarUsuario
                  usuario={registro.usuario}
                  roles={registro.opciones.roles}
                  cargos={cargos}
                  empresas={registro.opciones.empresas}
                  hrefCancelar={hrefCerrar}
                />
              </PanelLateral>
            )}

            {registro && estado.panel === "estado" && (
              <ModalConfirmacion
                hrefCerrar={hrefCerrar}
                tono={registro.usuario.activo ? "aviso" : "normal"}
                kicker={registro.usuario.activo ? "Desactivar" : "Reactivar"}
                titulo={
                  registro.usuario.activo
                    ? "¿Desactivar esta cuenta?"
                    : "¿Reactivar esta cuenta?"
                }
              >
                <ConfirmarEstadoUsuario
                  usuario={registro.usuario}
                  hrefCerrar={hrefCerrar}
                />
              </ModalConfirmacion>
            )}

            {registro && estado.panel === "clave" && (
              <ModalConfirmacion
                hrefCerrar={hrefCerrar}
                kicker="Restablecer contrasena"
                titulo={`¿Generar una contrasena nueva para ${registro.usuario.nombre}?`}
              >
                <ConfirmarRestablecer
                  usuario={registro.usuario}
                  hrefCerrar={hrefCerrar}
                />
              </ModalConfirmacion>
            )}
          </>
        }
      />
    </Wrapper>
  );
}
