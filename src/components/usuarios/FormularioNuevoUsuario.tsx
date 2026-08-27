"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  Briefcase,
  Building2,
  CircleAlert,
  Mail,
  Phone,
  Plus,
} from "lucide-react";
import type { ReactNode } from "react";

import { crearUsuario } from "@/actions/usuarios";
import { SeparadorPanel } from "@/components/listado";
import { PanelCuerpo, PanelPie } from "@/components/listado";
import { Alerta, Boton, BotonEnlace, Campo, Selector } from "@/components/ui";
import { CredencialProvisional } from "./CredencialProvisional";
import { ESTADO_INICIAL } from "@/types";
import type { Cargo, Empresa, NombreRol, Rol, TipoUsuario } from "@/types";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";

/**
 * Formulario de alta, dentro del panel lateral.
 *
 * Es de cliente por dos motivos concretos: `useActionState` para pintar los
 * errores que devuelve la action sin recargar, y el selector de tipo, que
 * decide que campos se muestran. Los datos de los desplegables llegan como
 * props desde la page: aqui no se consulta nada.
 */

const TARJETA =
  "relative flex cursor-pointer flex-col rounded-[13px] border-[1.5px] px-3.5 py-[15px] " +

  "suave hover:border-acento " +
  "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 " +
  "has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-acento";

// Seleccionada va navy con el icono dorado, que es donde el dorado es legal.
// En tema oscuro el navy ya es el fondo, asi que se marca con un velo dorado.
const TARJETA_ELEGIDA =
  "border-navy bg-navy dark-tema:border-acento dark-tema:bg-gold/[0.12]";

const TARJETA_SUELTA = "border-borde bg-campo";

// En la base cada rol lleva una frase que lo explica, demasiado larga para un
// desplegable estrecho. La explicacion que importa esta en la ayuda del campo.
const ROTULO_ROL: Record<NombreRol, string> = {
  admin: "Admin",
  trabajador: "Trabajador",
  cliente: "Cliente",
};

function TarjetaTipo({
  valor,
  titulo,
  descripcion,
  icono,
  elegida,
  alElegir,
}: {
  valor: TipoUsuario;
  titulo: string;
  descripcion: string;
  icono: ReactNode;
  elegida: boolean;
  alElegir: (valor: TipoUsuario) => void;
}) {
  return (
    <label className={[TARJETA, elegida ? TARJETA_ELEGIDA : TARJETA_SUELTA].join(" ")}>
      {/*
        Un radio de verdad, solo que invisible: asi el tipo viaja en el
        FormData, se puede elegir con las flechas del teclado y el lector de
        pantalla anuncia el grupo sin que haya que inventarle roles.
      */}
      <input
        type="radio"
        name="tipo"
        value={valor}
        checked={elegida}
        onChange={() => alElegir(valor)}
        className="sr-only"
      />

      <span
        aria-hidden="true"
        className={[
          "[&>svg]:size-5",
          elegida ? "text-acento" : "text-suave",
        ].join(" ")}
      >
        {icono}
      </span>

      <span
        className={[
          "mt-[9px] text-[13.5px] font-bold",
          elegida ? "text-white dark-tema:text-texto" : "text-texto",
        ].join(" ")}
      >
        {titulo}
      </span>

      <span
        className={[
          "mt-[3px] text-[11.5px] leading-[1.4]",
          elegida ? "text-white/60 dark-tema:text-suave" : "text-suave",
        ].join(" ")}
      >
        {descripcion}
      </span>
    </label>
  );
}

export function FormularioNuevoUsuario({
  roles,
  cargos,
  empresas,
  hrefCancelar,
}: {
  roles: Rol[];
  cargos: Cargo[];
  empresas: Empresa[];

  /** A donde vuelve el boton de cancelar: la misma URL sin el panel. */
  hrefCancelar: string;
}) {
  const [estado, enviar, enviando] = useActionState(crearUsuario, ESTADO_INICIAL);

  // El resultado sale como aviso flotante: en un formulario largo, una alerta
  // arriba queda fuera de la vista de quien acaba de pulsar el boton.
  useAvisoDeAccion(estado);
  const [tipo, setTipo] = useState<TipoUsuario>("trabajador");

  const errores = estado.errores ?? {};
  const esTrabajador = tipo === "trabajador";

  /*
   * Creada la cuenta, el panel deja de ser un formulario.
   *
   * Antes seguia siendo el mismo formulario relleno con un aviso arriba, y ese
   * aviso llevaba dentro la contrasena provisional. Como el cuerpo del panel
   * se desplaza y el boton de enviar vive en el pie, quien acababa de pulsar
   * estaba abajo y el aviso aparecia fuera de la vista: la clave no se veia
   * nunca. Y como solo se muestra una vez, la cuenta nacia inservible.
   *
   * Sustituir la pantalla entera resuelve las dos cosas a la vez: no hay nada
   * que perderse de vista, y no queda un formulario a medio camino invitando a
   * crear la misma cuenta otra vez.
   */
  if (estado.ok && estado.credencial) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PanelCuerpo>
          <CredencialProvisional
            email={estado.credencial.email}
            password={estado.credencial.password}
            titulo="Cuenta creada"
            descripcion="Entregale estos datos a la persona. Al entrar podra cambiar la contrasena desde Mi perfil."
          />
        </PanelCuerpo>

        <PanelPie>
          <BotonEnlace href={hrefCancelar}>Listo</BotonEnlace>
        </PanelPie>
      </div>
    );
  }

  // Un cliente pertenece siempre a una empresa, asi que sin empresas
  // registradas no hay alta posible: mejor decirlo que dejar enviar el
  // formulario para que falle.
  const sinEmpresas = empresas.length === 0;

  return (
    <form action={enviar} noValidate className="flex min-h-0 flex-1 flex-col">
      <PanelCuerpo>

      <fieldset className="min-w-0">
        <legend className="sr-only">Tipo de usuario</legend>

        <div className="grid grid-cols-2 gap-[11px]">
          <TarjetaTipo
            valor="trabajador"
            titulo="Trabajador"
            descripcion="Personal de la agencia. Lleva un rol."
            icono={<Briefcase />}
            elegida={esTrabajador}
            alElegir={setTipo}
          />

          <TarjetaTipo
            valor="cliente"
            titulo="Cliente"
            descripcion="Contacto de una empresa cliente."
            icono={<Building2 />}
            elegida={!esTrabajador}
            alElegir={setTipo}
          />
        </div>

        {errores.tipo && (
          <p
            role="alert"
            className="mt-2 text-[11.5px] font-medium text-blackberry dark-tema:text-[#e9a9cd]"
          >
            {errores.tipo}
          </p>
        )}
      </fieldset>

      <SeparadorPanel>Datos de la persona</SeparadorPanel>

      <div className="grid grid-cols-2 gap-3.5">
        <Campo
          id="nuevo-nombre"
          name="nombre"
          etiqueta="Nombre"
          placeholder="Nombre"
          autoComplete="off"
          maxLength={60}
          required
          error={errores.nombre}
        />

        <Campo
          id="nuevo-apellido"
          name="apellido"
          etiqueta="Apellido"
          placeholder="Apellido"
          autoComplete="off"
          maxLength={60}
          required
          error={errores.apellido}
        />

        <Campo
          id="nuevo-correo"
          name="correo"
          type="email"
          inputMode="email"
          etiqueta="Correo"
          placeholder="nombre@dominio.com"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={254}
          required
          icono={<Mail />}
          ayuda="Sera su identificador de acceso. No puede repetirse."
          error={errores.correo}
          className="col-span-2"
        />

        <Campo
          id="nuevo-telefono"
          name="telefono"
          type="tel"
          inputMode="tel"
          etiqueta="Telefono"
          opcional
          placeholder="+58 412 000 0000"
          autoComplete="off"
          maxLength={30}
          icono={<Phone />}
          error={errores.telefono}
          className="col-span-2"
        />
      </div>

      <SeparadorPanel>
        {esTrabajador ? "Rol dentro de la agencia" : "Empresa a la que pertenece"}
      </SeparadorPanel>

      {/*
        Solo se monta la mitad que corresponde al tipo elegido. Al no estar en
        el DOM, sus campos tampoco viajan en el FormData, y la action no tiene
        que decidir cual de los dos juegos de datos ignorar.
      */}
      <div className="grid grid-cols-2 gap-3.5">
        {esTrabajador ? (
          <>
            <Selector
              id="nuevo-rol"
              nombre="rolId"
              etiqueta="Rol"
              marcador="Elige un rol"
              requerido
              opciones={roles.map((rol) => ({
                valor: String(rol.id),
                texto: ROTULO_ROL[rol.nombre],
                detalle: rol.descripcion ?? undefined,
              }))}
              ayuda="El rol admin puede crear usuarios. Solo se asigna a trabajadores."
              error={errores.rolId}
              className="col-span-2"
            />

            <Selector
              id="nuevo-cargo"
              nombre="cargoId"
              etiqueta="Area"
              marcador="Elige un area"
              requerido
              opciones={cargos.map((cargo) => ({
                valor: String(cargo.id),
                texto: cargo.nombre,
                detalle: cargo.descripcion ?? undefined,
              }))}
              ayuda="Decide que contenido de la agencia ve esta persona."
              error={errores.cargoId}
              className="col-span-2"
            />
          </>
        ) : (
          <>
            {sinEmpresas ? (
              /*
                Este aviso era un callejon sin salida: decia que habia que
                registrar la empresa y no existia el sitio donde hacerlo. El
                alta vive en el modulo de hooks, que es donde tambien se
                tropieza con ella al escribir una ficha.
              */
              <Alerta icono={<CircleAlert />} className="col-span-2">
                Todavia no hay ninguna empresa activa. Hay que registrarla antes
                de dar de alta a su persona de contacto:{" "}
                <Link
                  href="/dashboard/hooks/nuevo?panel=nuevo"
                  className="font-semibold underline"
                >
                  registrar una empresa
                </Link>
                .
              </Alerta>
            ) : (
              <Selector
                id="nuevo-empresa"
                nombre="empresaId"
                etiqueta="Empresa"
                marcador="Elige una empresa"
                requerido
                opciones={empresas.map((empresa) => ({
                  valor: String(empresa.id),
                  texto: empresa.nombre,
                  detalle: empresa.rif ?? undefined,
                }))}
                ayuda="Determina que contenido ve: nunca vera el de otra empresa."
                error={errores.empresaId}
                className="col-span-2"
              />
            )}

            <Campo
              id="nuevo-cargo-libre"
              name="cargo"
              etiqueta="Cargo"
              opcional
              placeholder="Gerente de mercadeo"
              autoComplete="off"
              maxLength={80}
              ayuda="Su puesto en su propia empresa. Es descriptivo, no da permisos."
              error={errores.cargo}
              className="col-span-2"
            />
          </>
        )}
      </div>

      </PanelCuerpo>

      {/*
        El pie es hermano del cuerpo, no parte de el: el boton de enviar tiene
        que ser hijo de este <form>, pero si viviera dentro del area que se
        desplaza quedaria flotando con contenido asomando por debajo.
      */}
      <PanelPie>
        <BotonEnlace href={hrefCancelar} variante="fantasma">
          Cancelar
        </BotonEnlace>

        <Boton type="submit" disabled={enviando || (!esTrabajador && sinEmpresas)}>
          {enviando ? "Creando..." : "Crear usuario"}
          {!enviando && <Plus aria-hidden="true" />}
        </Boton>
      </PanelPie>
    </form>
  );
}
