"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";
import { Camera, CircleAlert, Trash2, Upload, X } from "lucide-react";

import { quitarFoto, subirFoto } from "@/actions/perfil";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { Alerta, Avatar, Boton, Etiqueta } from "@/components/ui";
import { ESTADO_INICIAL } from "@/types";
import type { NombreRol, TipoUsuario } from "@/types";

/**
 * La tarjeta de identidad de Mi perfil: avatar, nombre, correo y las pastillas
 * de rol y tipo, con la foto de perfil.
 *
 * La foto se guarda en Drive (`subirFoto`). El boton de la camara abre el
 * selector, se ve una vista previa y se sube o se descarta; «Quitar foto»
 * vuelve a las iniciales. El selector es un input propio, oculto tras la
 * camara: es la unica excepcion a `CampoArchivo`, porque aqui la zona de
 * soltar archivos no cabe.
 */

const TARJETA =
  "surge rounded-[15px] border border-borde bg-superficie p-[22px] shadow-[var(--sombra)]";

const LIMITE_BYTES = 2 * 1024 * 1024;

const CAMARA =
  "absolute -right-0.5 -bottom-0.5 grid size-[34px] place-items-center " +
  "rounded-full border-[3px] border-superficie bg-acento text-acento-contraste " +
  "suave hover:bg-acento-hover " +
  // El circulo mide 34 px, pero lo que responde al dedo se estira a 44 px con
  // el pseudoelemento: se respeta el objetivo tactil sin engordar la pastilla.
  "before:absolute before:-inset-[5px] before:rounded-full before:content-['']";

/** Como se nombra cada rol y cada tipo en la interfaz. */
const ROLES: Record<NombreRol, string> = {
  admin: "Admin",
  trabajador: "Trabajador",
  cliente: "Cliente",
};

const TIPOS: Record<TipoUsuario, string> = {
  trabajador: "Trabajador",
  cliente: "Cliente",
};

export function TarjetaFoto({
  nombre,
  apellido,
  email,
  fotoUrl,
  rol,
  tipo,
}: {
  nombre: string;
  apellido: string;
  email: string;
  fotoUrl: string | null;
  rol: NombreRol;
  tipo: TipoUsuario;
}) {
  const [estado, enviar, enviando] = useActionState(subirFoto, ESTADO_INICIAL);
  const [quitado, quitar, quitando] = useActionState(quitarFoto, ESTADO_INICIAL);
  useAvisoDeAccion(estado);
  useAvisoDeAccion(quitado);

  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const formulario = useRef<HTMLFormElement>(null);
  const entrada = useRef<HTMLInputElement>(null);

  // La URL temporal de la vista previa ocupa memoria hasta que se revoca; la
  // limpieza se dispara tambien al cambiar de imagen.
  useEffect(() => {
    if (!vistaPrevia) return;

    return () => URL.revokeObjectURL(vistaPrevia);
  }, [vistaPrevia]);

  // Cuando la subida sale bien, la foto ya viene del servidor y la vista
  // previa sobra. Se ajusta durante el render, comparando con el estado
  // anterior, para no pintar dos veces.
  const [estadoAnterior, setEstadoAnterior] = useState(estado);

  if (estado !== estadoAnterior) {
    setEstadoAnterior(estado);

    if (estado.ok) {
      setVistaPrevia(null);
      setErrorLocal(null);
    }
  }

  function elegir(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0] ?? null;

    if (!archivo) {
      setVistaPrevia(null);
      return;
    }

    if (archivo.size > LIMITE_BYTES) {
      setErrorLocal("La imagen no puede pasar de 2 MB");
      setVistaPrevia(null);
      evento.target.value = "";
      return;
    }

    setErrorLocal(null);
    setVistaPrevia(URL.createObjectURL(archivo));
  }

  function descartar() {
    setVistaPrevia(null);
    setErrorLocal(null);
    formulario.current?.reset();
  }

  const fallo = errorLocal ?? (estado.ok ? null : estado.errores?.foto);

  return (
    <section
      style={{ "--retraso": "0.1s" } as CSSProperties}
      className={TARJETA}
      aria-labelledby="perfil-identidad"
    >
      <form
        ref={formulario}
        action={enviar}
        className="flex flex-col items-center pt-1 pb-0.5 text-center"
      >
        <div className="relative">
          {vistaPrevia ? (
            <span className="grid size-[108px] shrink-0 place-items-center overflow-hidden rounded-full border-[3px] border-superficie bg-campo shadow-[0_0_0_1px_var(--borde)]">
              {/* Una URL de objeto local: no hay nada que optimizar. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={vistaPrevia} alt="Vista previa de la foto elegida" className="size-full object-cover" />
            </span>
          ) : (
            <Avatar
              nombre={nombre}
              apellido={apellido}
              fotoUrl={fotoUrl}
              tamano="enorme"
              className="border-[3px] border-superficie shadow-[0_0_0_1px_var(--borde)]"
            />
          )}

          <button
            type="button"
            onClick={() => entrada.current?.click()}
            aria-controls="foto"
            className={CAMARA}
          >
            <Camera aria-hidden="true" className="size-[15px]" />
            <span className="sr-only">{fotoUrl ? "Cambiar foto de perfil" : "Subir foto de perfil"}</span>
          </button>
        </div>

        <input
          ref={entrada}
          id="foto"
          name="foto"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={elegir}
          className="sr-only"
          tabIndex={-1}
        />

        <b id="perfil-identidad" className="mt-3.5 text-[17px] font-bold tracking-[-0.015em]">
          {nombre} {apellido}
        </b>

        <span className="mt-[3px] text-[12.5px] break-all text-suave">{email}</span>

        <div className="mt-3 flex flex-wrap justify-center gap-[7px]">
          <Etiqueta variante="solida">{ROLES[rol]}</Etiqueta>

          {/* El tipo solo se muestra cuando anade algo: para un trabajador
              raso repetiria la pastilla del rol. */}
          {TIPOS[tipo] !== ROLES[rol] && <Etiqueta variante="contorno">{TIPOS[tipo]}</Etiqueta>}
        </div>

        {vistaPrevia && (
          <div className="mt-4 grid w-full grid-cols-2 gap-2.5">
            <Boton type="button" variante="fantasma" tamano="chico" onClick={descartar} disabled={enviando}>
              <X aria-hidden="true" />
              Descartar
            </Boton>

            <Boton type="submit" tamano="chico" disabled={enviando}>
              <Upload aria-hidden="true" />
              {enviando ? "Subiendo…" : "Subir"}
            </Boton>
          </div>
        )}

        {fallo && (
          <Alerta className="mt-4 w-full text-left" icono={<CircleAlert />}>
            {fallo}
          </Alerta>
        )}
      </form>

      <div className="mt-4 border-t border-borde pt-3.5 text-center">
        <p className="text-[11.5px] leading-[1.5] text-suave">
          JPG, PNG o WEBP, hasta 2 MB. La ven las personas con cuenta en Conejo App.
        </p>
        {fotoUrl && !vistaPrevia && (
          <form action={quitar} className="mt-2.5">
            <Boton type="submit" variante="fantasma" tamano="chico" disabled={quitando}>
              <Trash2 aria-hidden="true" />
              {quitando ? "Quitando…" : "Quitar foto"}
            </Boton>
          </form>
        )}
      </div>
    </section>
  );
}
