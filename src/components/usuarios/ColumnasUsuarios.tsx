import Link from "next/link";
import { Eye, KeyRound, Pencil, Power, PowerOff } from "lucide-react";

import { Avatar, Estado, Etiqueta } from "@/components/ui";
import { conPanel } from "@/lib/urlListado";
import type { Columna, EstadoListado, NombreRol, UsuarioCompleto } from "@/types";

/**
 * Las columnas del listado de usuarios.
 *
 * El modulo no dibuja su tabla: solo declara que se ve en cada celda y deja
 * que el listado estandar la monte. Por eso esto es una funcion que devuelve
 * datos, no un componente.
 */

/** Los anchos de la rejilla, tal como salieron del diseno aprobado. */
const ANCHOS = {
  persona: "2.2fr",
  rol: "1.1fr",
  ambito: "1.5fr",
  estado: "1fr",
  // Cuatro botones de 36 px con sus separaciones. Fija y no fraccion: las
  // acciones no deben encoger cuando un nombre es largo.
  acciones: "164px",
} as const;

/**
 * La misma rejilla que arma ListadoTabla a partir de esos anchos.
 *
 * La usa el esqueleto de carga: con la plantilla derivada de aqui, las
 * columnas del esqueleto y las de la tabla real caen en el mismo sitio y no
 * hay salto cuando llegan los datos.
 */
export const REJILLA_USUARIOS = Object.values(ANCHOS)
  .map((ancho) => (ancho.endsWith("fr") ? `minmax(0, ${ancho})` : ancho))
  .join(" ");

const NOMBRE_ROL: Record<NombreRol, string> = {
  admin: "Admin",
  trabajador: "Trabajador",
  cliente: "Cliente",
};

/**
 * Un boton de accion de la fila.
 *
 * Son enlaces, no botones: abren un panel o un dialogo, y eso aqui significa
 * cambiar un parametro de la URL. Asi se puede compartir el enlace de "editar
 * a Fulano" y el boton atras del navegador cierra lo que se abrio.
 *
 * `scroll={false}` porque, sin el, Next sube al principio en cada navegacion.
 * En una lista larga eso significa pulsar un boton de la fila 40 y perder de
 * vista la fila 40: hay que volver a bajar a buscarla despues de cerrar el
 * panel. La misma razon vale para los filtros y para el orden.
 */
function AccionFila({
  href,
  etiqueta,
  children,
  tono = "normal",
}: {
  href: string;
  etiqueta: string;
  children: React.ReactNode;
  tono?: "normal" | "aviso";
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-label={etiqueta}
      title={etiqueta}
      className={[
        "suave grid size-9 shrink-0 place-items-center rounded-[10px]",
        "border border-transparent",
        tono === "aviso"
          ? "text-blackberry hover:border-blackberry hover:bg-blackberry hover:text-white dark-tema:text-[#e9a9cd]"
          : "text-suave hover:border-acento hover:bg-acento hover:text-acento-contraste",
        "[&>svg]:size-[16px]",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

export function columnasUsuarios(
  ruta: string,
  estado: EstadoListado,
): Columna<UsuarioCompleto>[] {
  return [
    {
      clave: "nombre",
      titulo: "Persona",
      ordenable: true,
      ancho: ANCHOS.persona,
      tarjeta: "titulo",
      render: (usuario) => (
        <div className="flex min-w-0 items-center gap-[11px]">
          <Avatar
            nombre={usuario.nombre}
            apellido={usuario.apellido}
            fotoUrl={usuario.fotoUrl}
            tamano="chico"
          />

          <div className="min-w-0">
            <span className="block truncate font-semibold">
              {usuario.nombre} {usuario.apellido}
            </span>
            <span className="mt-0.5 block truncate text-[11px] text-suave">
              {usuario.email}
            </span>
          </div>
        </div>
      ),
    },

    {
      clave: "rol",
      titulo: "Rol",
      ancho: ANCHOS.rol,
      render: (usuario) => (
        // El admin va en solida porque es el unico rol que crea cuentas: la
        // diferencia de peso visual es justo lo que hay que poder ver de un
        // vistazo al repasar la lista.
        <Etiqueta variante={usuario.rol === "admin" ? "solida" : "contorno"}>
          {NOMBRE_ROL[usuario.rol]}
        </Etiqueta>
      ),
    },

    {
      clave: "ambito",
      titulo: "Pertenece a",
      ancho: ANCHOS.ambito,
      render: (usuario) => {
        // Cada tipo pertenece a algo distinto: el trabajador a un area de la
        // agencia, el cliente a su empresa. Es la misma columna porque
        // responde a la misma pregunta.
        const ambito =
          usuario.tipo === "trabajador" ? usuario.cargo : usuario.empresaNombre;

        return (
          <span className="block truncate text-[12.5px] text-suave">
            {ambito ?? "Sin asignar"}
          </span>
        );
      },
    },

    {
      clave: "activo",
      titulo: "Estado",
      ancho: ANCHOS.estado,
      render: (usuario) => <Estado activo={usuario.activo} />,
    },

    {
      clave: "acciones",
      // Sin rotulo: cada boton ya lleva su propio nombre accesible, y una
      // cabecera que dijera "Acciones" solo gastaria ancho.
      titulo: "Acciones",
      ancho: ANCHOS.acciones,
      alineacion: "derecha",
      tarjeta: "acciones",
      render: (usuario) => {
        const quien = `${usuario.nombre} ${usuario.apellido}`;

        return (
          <div className="flex items-center justify-end gap-1">
            <AccionFila
              href={conPanel(ruta, estado, "ver", usuario.id)}
              etiqueta={`Ver los datos de ${quien}`}
            >
              <Eye aria-hidden="true" />
            </AccionFila>

            <AccionFila
              href={conPanel(ruta, estado, "editar", usuario.id)}
              etiqueta={`Editar a ${quien}`}
            >
              <Pencil aria-hidden="true" />
            </AccionFila>

            {/*
              Restablecer la contrasena es la unica forma de recuperar una
              cuenta cuya provisional se perdio: solo se muestra al crearla, y
              en la base queda cifrada. Sin esto, esa cuenta se quedaba sin
              acceso y sin arreglo, porque el correo es unico y no se podia ni
              recrear.
            */}
            <AccionFila
              href={conPanel(ruta, estado, "clave", usuario.id)}
              etiqueta={`Restablecer la contrasena de ${quien}`}
            >
              <KeyRound aria-hidden="true" />
            </AccionFila>

            {/*
              No hay borrar. Desactivar cierra el acceso y conserva el rastro
              de lo que esa persona hizo; borrar se lo llevaria por delante.
            */}
            <AccionFila
              href={conPanel(ruta, estado, "estado", usuario.id)}
              etiqueta={
                usuario.activo
                  ? `Desactivar la cuenta de ${quien}`
                  : `Reactivar la cuenta de ${quien}`
              }
              tono={usuario.activo ? "aviso" : "normal"}
            >
              {usuario.activo ? (
                <PowerOff aria-hidden="true" />
              ) : (
                <Power aria-hidden="true" />
              )}
            </AccionFila>
          </div>
        );
      },
    },
  ];
}
