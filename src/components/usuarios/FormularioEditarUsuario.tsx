"use client";

import { useActionState, useState } from "react";
import { Check, Mail, Phone } from "lucide-react";

import { editarUsuario } from "@/actions/usuarios";
import { PanelCuerpo, PanelPie, SeparadorPanel } from "@/components/listado";
import { Boton, BotonEnlace, Campo, Selector, useCampos } from "@/components/ui";
import { ESTADO_INICIAL } from "@/types";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import type {
  Cargo,
  Empresa,
  NombreRol,
  Rol,
  UsuarioCompleto,
} from "@/types";

/**
 * Formulario de edicion, dentro del panel lateral.
 *
 * Es hermano del de alta pero NO el mismo, y la diferencia no es cosmetica:
 *
 *   - el tipo no se elige, se muestra. Pasar de trabajador a cliente es
 *     borrar una fila y crear otra en la tabla contraria, con lo que se irian
 *     el cargo o la empresa. Eso es un alta nueva, no una edicion
 *   - no hay contrasena. Un administrador corrige datos, no suplanta: para
 *     cambiarla hace falta la actual, y esa solo la sabe su duena
 *
 * Se planteo unificar los dos formularios con un modo. Salia un componente
 * lleno de condicionales donde lo unico compartido de verdad son los campos
 * de la persona, que ya son cuatro Campo seguidos.
 */

const ROTULO_ROL: Record<NombreRol, string> = {
  admin: "Admin",
  trabajador: "Trabajador",
  cliente: "Cliente",
};

export function FormularioEditarUsuario({
  usuario,
  roles,
  cargos,
  empresas,
  hrefCancelar,
}: {
  usuario: UsuarioCompleto;
  roles: Rol[];
  cargos: Cargo[];
  empresas: Empresa[];
  hrefCancelar: string;
}) {
  const [estado, enviar, enviando] = useActionState(editarUsuario, ESTADO_INICIAL);

  // El resultado sale como aviso flotante: en un formulario largo, una alerta
  // arriba queda fuera de la vista de quien acaba de pulsar el boton.
  useAvisoDeAccion(estado);

  // Controlada: React vacia las casillas no controladas al terminar la action.
  const [puedeAprobar, setPuedeAprobar] = useState(usuario.puedeAprobar ?? false);
  const [puedeVerFinanzas, setPuedeVerFinanzas] = useState(usuario.puedeVerFinanzas ?? false);

  // Controlados a proposito: React vacia los campos no controlados en cuanto
  // la action termina, tambien cuando devuelve errores. Sin esto, un correo
  // repetido borraba tambien el nombre y el telefono ya corregidos.
  const { campo } = useCampos({
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    correo: usuario.email,
    telefono: usuario.telefono ?? "",
    cargo: usuario.cargo ?? "",
  });

  const errores = estado.errores ?? {};
  const esTrabajador = usuario.tipo === "trabajador";

  return (
    <form action={enviar} noValidate className="flex min-h-0 flex-1 flex-col">
      <PanelCuerpo>
        {/*
          Que cuenta se edita viaja aqui, no en la URL de la action. La action
          lo vuelve a comprobar contra la base: este campo lo escribe el
          navegador y no se puede dar por bueno.
        */}
        <input type="hidden" name="id" value={usuario.id} />
        <input type="hidden" name="tipo" value={usuario.tipo} />


        <SeparadorPanel>Datos de la persona</SeparadorPanel>

        <div className="grid grid-cols-2 gap-3.5">
          <Campo
            id="editar-nombre"
            etiqueta="Nombre"
            {...campo("nombre")}
            autoComplete="off"
            maxLength={60}
            required
            error={errores.nombre}
          />

          <Campo
            id="editar-apellido"
            etiqueta="Apellido"
            {...campo("apellido")}
            autoComplete="off"
            maxLength={60}
            required
            error={errores.apellido}
          />

          <Campo
            id="editar-correo"
            type="email"
            inputMode="email"
            etiqueta="Correo"
            {...campo("correo")}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={254}
            required
            icono={<Mail />}
            ayuda="Es su identificador de acceso. Si lo cambias, entrara con el nuevo."
            error={errores.correo}
            className="col-span-2"
          />

          <Campo
            id="editar-telefono"
            type="tel"
            inputMode="tel"
            etiqueta="Telefono"
            opcional
            {...campo("telefono")}
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

        <div className="grid grid-cols-2 gap-3.5">
          {esTrabajador ? (
            <>
              <Selector
                id="editar-rol"
                nombre="rolId"
                etiqueta="Rol"
                requerido
                valorInicial={String(
                  roles.find((rol) => rol.nombre === usuario.rol)?.id ?? "",
                )}
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
                id="editar-cargo"
                nombre="cargoId"
                etiqueta="Area"
                requerido
                valorInicial={usuario.cargoId ? String(usuario.cargoId) : ""}
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
              <Selector
                id="editar-empresa"
                nombre="empresaId"
                etiqueta="Empresa"
                requerido
                valorInicial={usuario.empresaId ? String(usuario.empresaId) : ""}
                opciones={empresas.map((empresa) => ({
                  valor: String(empresa.id),
                  texto: empresa.nombre,
                  detalle: empresa.rif ?? undefined,
                }))}
                ayuda="Determina que contenido ve: nunca vera el de otra empresa."
                error={errores.empresaId}
                className="col-span-2"
              />

              <Campo
                id="editar-cargo-libre"
                etiqueta="Cargo"
                opcional
                {...campo("cargo")}
                autoComplete="off"
                maxLength={80}
                ayuda="Su puesto en su propia empresa. Es descriptivo, no da permisos."
                error={errores.cargo}
                className="col-span-2"
              />

              <label className="col-span-2 flex items-start gap-3 rounded-xl border border-borde px-4 py-3 text-[12.5px] leading-relaxed">
                <input
                  type="checkbox"
                  name="puedeAprobar"
                  checked={puedeAprobar}
                  onChange={(evento) => setPuedeAprobar(evento.target.checked)}
                  className="mt-0.5 size-[18px] shrink-0 accent-[var(--acento)]"
                />
                <span>
                  <b className="font-semibold">Puede aprobar piezas.</b>{" "}
                  <span className="text-suave">
                    Decide en la fase 5 por su empresa: aprueba o pide una
                    correccion. Sin esto ve el avance, pero no decide.
                  </span>
                </span>
              </label>

              <label className="col-span-2 flex items-start gap-3 rounded-xl border border-borde px-4 py-3 text-[12.5px] leading-relaxed">
                <input
                  type="checkbox"
                  name="puedeVerFinanzas"
                  checked={puedeVerFinanzas}
                  onChange={(evento) => setPuedeVerFinanzas(evento.target.checked)}
                  className="mt-0.5 size-[18px] shrink-0 accent-[var(--acento)]"
                />
                <span>
                  <b className="font-semibold">Puede ver las finanzas.</b>{" "}
                  <span className="text-suave">
                    Ve los presupuestos y proformas de su empresa, y aprueba o
                    rechaza presupuestos. Sin esto no ve ningun importe.
                  </span>
                </span>
              </label>
            </>
          )}
        </div>
      </PanelCuerpo>

      <PanelPie>
        <BotonEnlace href={hrefCancelar} variante="fantasma">
          Cancelar
        </BotonEnlace>

        <Boton type="submit" disabled={enviando}>
          {enviando ? "Guardando..." : "Guardar cambios"}
          {!enviando && <Check aria-hidden="true" />}
        </Boton>
      </PanelPie>
    </form>
  );
}
