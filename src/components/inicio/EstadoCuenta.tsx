import { CalendarClock, Clock, User, Users } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import type { UsuarioCompleto } from "@/types";

/**
 * El estado de la cuenta: tres cifras cortas, en fila.
 *
 * El home NO repite los datos de la persona: eso vive en Mi perfil, y tenerlo
 * en dos sitios obliga a mantener lo mismo por duplicado. Aqui solo van cifras
 * que resumen como esta la cuenta de un vistazo.
 *
 * Todo sale de la base. No hay contadores inventados: la antiguedad de la
 * contrasena, por ejemplo, no se guarda en ningun sitio, asi que no se finge
 * un numero de dias que nadie podria comprobar.
 */

const TARJETA =
  "surge rounded-[15px] border border-borde bg-superficie p-5 shadow-[var(--sombra)]";

/** La cifra grande de cada tarjeta. */
const CIFRA =
  "text-[22px] leading-[1.1] font-extrabold tracking-[-0.02em] text-balance lg:text-2xl";

/** La linea de apoyo bajo la cifra. */
const NOTA = "mt-[7px] text-[11.5px] leading-[1.45] text-suave";

const FECHA_CORTA = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
});

const HORA = new Intl.DateTimeFormat("es", {
  hour: "2-digit",
  minute: "2-digit",
});

const MES_Y_ANO = new Intl.DateTimeFormat("es", {
  month: "long",
  year: "numeric",
});

/**
 * Los campos que la persona puede rellenar por su cuenta desde Mi perfil.
 *
 * Solo entran esos tres: el cargo y la empresa los asigna un administrador,
 * asi que contarlos culparia a quien no puede hacer nada al respecto.
 *
 * Por el mismo motivo NO entra la foto mientras su subida este apagada: pedir
 * algo que la interfaz no deja hacer dejaria a todo el mundo clavado en un 75 %
 * imposible de completar. Cuando la funcionalidad vuelva, se repone aqui la
 * linea `{ lleno: Boolean(usuario.fotoUrl), nombre: "tu foto" }` y el
 * porcentaje se recalcula solo, porque divide entre `campos.length`.
 */
function revisarPerfil(usuario: UsuarioCompleto): {
  porcentaje: number;
  faltan: string[];
} {
  const campos = [
    { lleno: Boolean(usuario.telefono), nombre: "tu telefono" },
    { lleno: usuario.nombre.trim().length > 0, nombre: "tu nombre" },
    { lleno: usuario.apellido.trim().length > 0, nombre: "tu apellido" },
  ];

  const faltan = campos.filter((c) => !c.lleno).map((c) => c.nombre);
  const llenos = campos.length - faltan.length;

  return {
    porcentaje: Math.round((llenos / campos.length) * 100),
    faltan,
  };
}

/** "Faltan tu nombre y tu telefono", con la coma y la "y" donde tocan. */
function fraseDeLoQueFalta(faltan: string[]): string {
  if (faltan.length === 0) return "No falta nada por llenar";
  if (faltan.length === 1) return `Falta ${faltan[0]}`;

  const ultimo = faltan[faltan.length - 1];
  return `Faltan ${faltan.slice(0, -1).join(", ")} y ${ultimo}`;
}

/** Cuanto lleva la persona en la plataforma, en la unidad que se entienda. */
function antiguedad(desde: Date): string {
  const dias = Math.max(
    0,
    Math.floor((Date.now() - desde.getTime()) / 86_400_000),
  );

  if (dias === 0) return "Desde hoy";
  if (dias === 1) return "1 dia";
  if (dias < 31) return `${dias} dias`;

  const meses = Math.floor(dias / 30);
  if (meses < 12) return meses === 1 ? "1 mes" : `${meses} meses`;

  const anos = Math.floor(meses / 12);
  return anos === 1 ? "1 ano" : `${anos} anos`;
}

function retraso(segundos: string): CSSProperties {
  return { "--retraso": segundos } as CSSProperties;
}

export function EstadoCuenta({
  usuario,
  usuariosActivos,
}: {
  usuario: UsuarioCompleto;
  /** Solo llega cuando quien mira es administrador. */
  usuariosActivos: number | null;
}) {
  const { porcentaje, faltan } = revisarPerfil(usuario);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
      <Tarjeta
        retrasoEntrada="0.1s"
        icono={<Clock aria-hidden="true" />}
        titulo="Ultimo acceso"
      >
        {usuario.ultimoAcceso ? (
          <>
            <p className={CIFRA}>{HORA.format(usuario.ultimoAcceso)}</p>
            <p className={NOTA}>
              {FECHA_CORTA.format(usuario.ultimoAcceso)}, desde este dispositivo
            </p>
          </>
        ) : (
          <>
            <p className={CIFRA}>Primera vez</p>
            <p className={NOTA}>Bienvenido a la plataforma</p>
          </>
        )}
      </Tarjeta>

      <Tarjeta
        retrasoEntrada="0.14s"
        icono={<User aria-hidden="true" />}
        titulo="Perfil completo"
      >
        <p className={CIFRA}>{porcentaje}%</p>

        <div
          role="progressbar"
          aria-label="Datos del perfil completados"
          aria-valuenow={porcentaje}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-[13px] h-[7px] overflow-hidden rounded-full bg-campo"
        >
          <div
            style={{ width: `${porcentaje}%` }}
            className="h-full rounded-full bg-navy dark-tema:bg-gold"
          />
        </div>

        <p className={NOTA}>{fraseDeLoQueFalta(faltan)}</p>
      </Tarjeta>

      {/*
        La tercera cifra depende de quien mira. Un administrador tiene a mano
        un dato de la agencia; el resto solo tiene los suyos, asi que se les
        muestra su antiguedad en lugar de un numero que no les dice nada.
      */}
      {usuariosActivos === null ? (
        <Tarjeta
          retrasoEntrada="0.18s"
          icono={<CalendarClock aria-hidden="true" />}
          titulo="En la plataforma"
        >
          <p className={CIFRA}>{antiguedad(usuario.creadoEn)}</p>
          <p className={NOTA}>
            Desde {MES_Y_ANO.format(usuario.creadoEn)}
          </p>
        </Tarjeta>
      ) : (
        <Tarjeta
          retrasoEntrada="0.18s"
          icono={<Users aria-hidden="true" />}
          titulo="Usuarios activos"
        >
          <p className={CIFRA}>{usuariosActivos}</p>
          <p className={NOTA}>
            {usuariosActivos === 1
              ? "Una cuenta con acceso"
              : "Cuentas con acceso a la plataforma"}
          </p>
        </Tarjeta>
      )}
    </div>
  );
}

function Tarjeta({
  retrasoEntrada,
  icono,
  titulo,
  children,
}: {
  retrasoEntrada: string;
  icono: ReactNode;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <article style={retraso(retrasoEntrada)} className={TARJETA}>
      <h2 className="mb-3 flex items-center gap-[9px] text-xs font-medium text-suave [&>svg]:size-[15px] [&>svg]:shrink-0">
        {icono}
        {titulo}
      </h2>

      {children}
    </article>
  );
}
