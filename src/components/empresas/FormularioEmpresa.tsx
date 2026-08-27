"use client";

import { useActionState } from "react";
import { Building2, Check, CircleAlert, CircleCheck } from "lucide-react";

import { crearEmpresa } from "@/actions/empresas";
import { PanelCuerpo, PanelPie, SeparadorPanel } from "@/components/listado";
import { Alerta, Boton, BotonEnlace, Campo } from "@/components/ui";
import { ESTADO_INICIAL } from "@/types";

/**
 * Alta rapida de una empresa cliente, dentro del panel lateral.
 *
 * Es de cliente por `useActionState`: el RIF es unico en la base y ese choque
 * vuelve como error de campo, que hay que poder leer junto al campo sin
 * recargar.
 *
 * Solo el nombre es obligatorio. Lo demas se puede completar despues, y pedirlo
 * todo aqui convertiria un desatasco de diez segundos en un formulario que se
 * abandona a la mitad.
 */
export function FormularioEmpresa({ hrefCancelar }: { hrefCancelar: string }) {
  const [estado, enviar, enviando] = useActionState(crearEmpresa, ESTADO_INICIAL);
  const errores = estado.errores ?? {};

  return (
    <form action={enviar} noValidate className="flex min-h-0 flex-1 flex-col">
      <PanelCuerpo>
        {estado.mensaje && (
          <Alerta
            tono={estado.ok ? "info" : "aviso"}
            icono={estado.ok ? <CircleCheck /> : <CircleAlert />}
            className="mb-[18px]"
          >
            {estado.mensaje}
          </Alerta>
        )}

        <SeparadorPanel>Quien es</SeparadorPanel>

        <div className="grid grid-cols-2 gap-3.5">
          <Campo
            id="empresa-nombre"
            name="nombre"
            etiqueta="Nombre"
            placeholder="Distribuidora Ejemplo, C.A."
            autoComplete="off"
            maxLength={120}
            required
            error={errores.nombre}
            className="col-span-2"
          />

          <Campo
            id="empresa-rif"
            name="rif"
            etiqueta="RIF"
            opcional
            placeholder="J-30123456-7"
            autoComplete="off"
            maxLength={20}
            error={errores.rif}
            ayuda="Si lo pones, no puede repetirse."
          />

          {/*
            El sector NO es un dato administrativo, aunque lo parezca: de el
            sale el escalon del medio de la resolucion de regla del auditor
            —cliente, luego sector, luego el estandar de la casa—. Una empresa
            sin sector se queda sin ese escalon.
          */}
          <Campo
            id="empresa-sector"
            name="sector"
            etiqueta="Sector"
            opcional
            placeholder="Hosteleria"
            autoComplete="off"
            maxLength={120}
            error={errores.sector}
            ayuda="Decide que regla del auditor le aplica."
          />
        </div>

        <SeparadorPanel>Como se contacta</SeparadorPanel>

        <div className="grid grid-cols-2 gap-3.5">
          <Campo
            id="empresa-telefono"
            name="telefono"
            etiqueta="Telefono"
            opcional
            type="tel"
            inputMode="tel"
            placeholder="+58 212 555 0100"
            autoComplete="off"
            maxLength={30}
            error={errores.telefono}
          />

          <Campo
            id="empresa-direccion"
            name="direccion"
            etiqueta="Direccion"
            opcional
            placeholder="Av. Principal, Caracas"
            autoComplete="off"
            maxLength={200}
            error={errores.direccion}
            className="col-span-2"
          />
        </div>

        <p className="mt-[18px] flex items-start gap-3 rounded-xl border border-borde bg-campo p-4 text-[12.5px] leading-relaxed text-suave">
          <Building2 aria-hidden="true" className="mt-px size-4 shrink-0 text-acento" />
          Registrar la empresa no le da acceso a nadie. Para que alguien de esa
          empresa pueda entrar, un administrador tiene que crearle su cuenta
          desde Usuarios.
        </p>
      </PanelCuerpo>

      <PanelPie>
        <BotonEnlace href={hrefCancelar} variante="fantasma">
          {estado.ok ? "Cerrar" : "Cancelar"}
        </BotonEnlace>

        <Boton type="submit" disabled={enviando}>
          {enviando ? "Registrando…" : "Registrar empresa"}
          {!enviando && <Check aria-hidden="true" />}
        </Boton>
      </PanelPie>
    </form>
  );
}
