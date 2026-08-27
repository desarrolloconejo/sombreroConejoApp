"use client";

import { useActionState } from "react";
import type { CSSProperties } from "react";
import { Mail, Phone, Save, User } from "lucide-react";

import { actualizarPerfil } from "@/actions/perfil";
import { Boton, Campo, CampoFijo } from "@/components/ui";
import { ESTADO_INICIAL } from "@/types";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";

/**
 * Los datos personales.
 *
 * Es de cliente por `useActionState`: los errores de cada campo se pintan sin
 * recargar y sin perder lo escrito. El correo y el cargo van como CampoFijo
 * porque solo los cambia un administrador; mostrarlos editables prometeria
 * algo que la action rechazaria.
 */

const TARJETA =
  "surge rounded-[15px] border border-borde bg-superficie p-[22px] shadow-[var(--sombra)]";

export function FormularioDatos({
  nombre,
  apellido,
  telefono,
  email,
  cargo,
}: {
  nombre: string;
  apellido: string;
  telefono: string | null;
  email: string;
  cargo: string | null;
}) {
  const [estado, enviar, enviando] = useActionState(actualizarPerfil, ESTADO_INICIAL);

  // El resultado sale como aviso flotante: en un formulario largo, una alerta
  // arriba queda fuera de la vista de quien acaba de pulsar el boton.
  useAvisoDeAccion(estado);

  return (
    <section
      style={{ "--retraso": "0.12s" } as CSSProperties}
      className={TARJETA}
      aria-labelledby="perfil-datos"
    >
      <header className="mb-[18px] flex items-center gap-2.5">
        <User aria-hidden="true" className="size-[17px] shrink-0 text-acento" />
        <div>
          <h2 id="perfil-datos" className="text-[15px] font-bold tracking-[-0.01em]">
            Datos personales
          </h2>
          <p className="mt-[3px] text-xs text-suave">
            El correo y el cargo solo los cambia un administrador
          </p>
        </div>
      </header>

      <form action={enviar} noValidate>

        <div className="grid gap-[15px] sm:grid-cols-2">
          <Campo
            id="nombre"
            name="nombre"
            etiqueta="Nombre"
            defaultValue={nombre}
            autoComplete="given-name"
            maxLength={60}
            required
            error={estado.errores?.nombre}
          />

          <Campo
            id="apellido"
            name="apellido"
            etiqueta="Apellido"
            defaultValue={apellido}
            autoComplete="family-name"
            maxLength={60}
            required
            error={estado.errores?.apellido}
          />

          <Campo
            id="telefono"
            name="telefono"
            type="tel"
            inputMode="tel"
            etiqueta="Telefono"
            opcional
            defaultValue={telefono ?? ""}
            autoComplete="tel"
            maxLength={30}
            placeholder="+58 412 555 0101"
            icono={<Phone />}
            error={estado.errores?.telefono}
          />

          <CampoFijo etiqueta="Cargo" valor={cargo ?? "Sin cargo asignado"} />

          <CampoFijo
            etiqueta="Correo"
            valor={email}
            icono={<Mail />}
            ayuda="Es tu identificador de acceso. Para cambiarlo, pideselo a un administrador."
            className="sm:col-span-2"
          />
        </div>

        <div className="mt-5 flex justify-end border-t border-borde pt-[18px]">
          <Boton type="submit" disabled={enviando}>
            {enviando ? (
              "Guardando..."
            ) : (
              <>
                <Save aria-hidden="true" />
                Guardar cambios
              </>
            )}
          </Boton>
        </div>
      </form>
    </section>
  );
}
