"use client";

import { useActionState, type ReactNode } from "react";
import { Building2, Check } from "lucide-react";

import { crearEmpresa, editarEmpresa } from "@/actions/empresas";
import { PanelCuerpo, PanelPie, SeparadorPanel } from "@/components/listado";
import { Boton, BotonEnlace, Campo, useCampos } from "@/components/ui";
import { ENLACES_EMPRESA } from "@/lib/validaciones";
import { ESTADO_INICIAL } from "@/types";
import type { Empresa } from "@/types";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";

/**
 * Alta y edicion de una empresa cliente, dentro del panel lateral.
 *
 * UNO SOLO PARA LAS DOS COSAS
 * ---------------------------
 * Al contrario que en usuarios, aqui no hacen falta dos formularios. Alli el
 * alta y la edicion piden cosas distintas —el tipo se elige al crear y no se
 * cambia, y la contrasena solo existe en el alta—; una empresa se describe con
 * los mismos campos el primer dia y el ultimo. Con dos formularios habria dos
 * copias de la lista de enlaces esperando a desincronizarse.
 *
 * Es de cliente por `useActionState`: el RIF es unico en la base y ese choque
 * vuelve como error de campo, que hay que poder leer junto al campo sin
 * recargar. Y los campos van CONTROLADOS porque React vacia los formularios no
 * controlados en cuanto la action termina, tambien cuando devuelve errores: sin
 * eso, un RIF repetido borraba los otros diez campos ya escritos.
 *
 * Solo el nombre es obligatorio. Lo demas se completa cuando se sabe, y pedirlo
 * todo de golpe convierte un alta de diez segundos en un formulario que se
 * abandona a la mitad.
 */
/** El boton de guardar vive en el pie, fuera del formulario: lo encuentra por su id. */
const ID_FORMULARIO = "formulario-empresa";

export function FormularioEmpresa({
  empresa = null,
  hrefCancelar,
  aparte,
}: {
  /** La que se edita. Null en el alta. */
  empresa?: Empresa | null;
  hrefCancelar: string;
  /**
   * Lo que se edita con sus propios formularios (los ejecutivos que la
   * atienden): va en el panel, debajo de los datos y fuera de este
   * formulario, porque un formulario no puede ir dentro de otro.
   */
  aparte?: ReactNode;
}) {
  const [estado, enviar, enviando] = useActionState(
    empresa ? editarEmpresa : crearEmpresa,
    ESTADO_INICIAL,
  );

  // El resultado sale como aviso flotante: en un formulario largo, una alerta
  // arriba queda fuera de la vista de quien acaba de pulsar el boton.
  useAvisoDeAccion(estado);

  const { campo } = useCampos({
    nombre: empresa?.nombre ?? "",
    rif: empresa?.rif ?? "",
    sector: empresa?.sector ?? "",
    telefono: empresa?.telefono ?? "",
    direccion: empresa?.direccion ?? "",
    sitioWeb: empresa?.sitioWeb ?? "",
    instagram: empresa?.instagram ?? "",
    tiktok: empresa?.tiktok ?? "",
    facebook: empresa?.facebook ?? "",
    youtube: empresa?.youtube ?? "",
    linkedin: empresa?.linkedin ?? "",
  });

  const errores = estado.errores ?? {};

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PanelCuerpo>
        <form id={ID_FORMULARIO} action={enviar} noValidate>
        {/* Cual se edita viaja aqui, no en la URL de la action. La action lo
            vuelve a comprobar: este campo lo escribe el navegador. */}
        {empresa && <input type="hidden" name="id" value={empresa.id} />}

        <SeparadorPanel>Quien es</SeparadorPanel>

        <div className="grid grid-cols-2 gap-3.5">
          <Campo
            id="empresa-nombre"
            {...campo("nombre")}
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
            {...campo("rif")}
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
            {...campo("sector")}
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
            {...campo("telefono")}
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
            {...campo("direccion")}
            etiqueta="Direccion"
            opcional
            placeholder="Av. Principal, Caracas"
            autoComplete="off"
            maxLength={200}
            error={errores.direccion}
            className="col-span-2"
          />
        </div>

        <SeparadorPanel>Donde esta en internet</SeparadorPanel>

        {/*
          La lista viene de `validaciones` y no de aqui: la recorren tanto la
          validacion como este formulario. Con dos copias, anadir una red en un
          sitio y no en el otro deja un campo que se escribe y no se guarda.
        */}
        <div className="grid grid-cols-2 gap-3.5">
          {ENLACES_EMPRESA.map(({ clave, rotulo }) => (
            <Campo
              key={clave}
              id={`empresa-${clave}`}
              {...campo(clave)}
              etiqueta={rotulo}
              opcional
              type="url"
              inputMode="url"
              placeholder="https://…"
              autoComplete="off"
              maxLength={1000}
              error={errores[clave]}
            />
          ))}
        </div>

        <p className="mt-[18px] text-[11.5px] leading-relaxed text-suave">
          El enlace completo, con <b className="text-texto">https://</b>. Un
          nombre de usuario suelto no se puede abrir.
        </p>

        <p className="mt-[18px] flex items-start gap-3 rounded-xl border border-borde bg-campo p-4 text-[12.5px] leading-relaxed text-suave">
          <Building2 aria-hidden="true" className="mt-px size-4 shrink-0 text-acento" />
          Registrar la empresa no le da acceso a nadie. Para que alguien de esa
          empresa pueda entrar, hay que crearle su cuenta desde Usuarios.
        </p>
        </form>

        {aparte}
      </PanelCuerpo>

      <PanelPie>
        <BotonEnlace href={hrefCancelar} variante="fantasma">
          {estado.ok ? "Cerrar" : "Cancelar"}
        </BotonEnlace>

        <Boton type="submit" form={ID_FORMULARIO} disabled={enviando}>
          {enviando
            ? "Guardando…"
            : empresa
              ? "Guardar cambios"
              : "Registrar empresa"}
          {!enviando && <Check aria-hidden="true" />}
        </Boton>
      </PanelPie>
    </div>
  );
}
