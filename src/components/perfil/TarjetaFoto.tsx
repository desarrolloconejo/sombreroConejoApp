import type { CSSProperties } from "react";

import { Avatar, Etiqueta } from "@/components/ui";
import type { NombreRol, TipoUsuario } from "@/types";

/**
 * La tarjeta de identidad de Mi perfil: avatar, nombre, correo y las pastillas
 * de rol y tipo.
 *
 * Era de cliente cuando llevaba la subida de foto —input oculto tras el boton
 * de la camara y vista previa instantanea—, pero esa parte esta apagada y su
 * codigo vive comentado al final del archivo, con el motivo y los pasos para
 * reactivarla. Sin ella no queda nada que necesite el navegador, asi que vuelve
 * a ser un componente de servidor.
 *
 * `fotoUrl` se conserva en las props aunque hoy llegue siempre en null: es lo
 * que hace que reactivar la funcionalidad sea aditivo y no una reescritura.
 */

const TARJETA =
  "surge rounded-[15px] border border-borde bg-superficie p-[22px] shadow-[var(--sombra)]";

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
  return (
    <section
      style={{ "--retraso": "0.1s" } as CSSProperties}
      className={TARJETA}
      aria-labelledby="perfil-identidad"
    >
      <div className="flex flex-col items-center pt-1 pb-0.5 text-center">
        <Avatar
          nombre={nombre}
          apellido={apellido}
          fotoUrl={fotoUrl}
          tamano="enorme"
          className="border-[3px] border-superficie shadow-[0_0_0_1px_var(--borde)]"
        />

        <b
          id="perfil-identidad"
          className="mt-3.5 text-[17px] font-bold tracking-[-0.015em]"
        >
          {nombre} {apellido}
        </b>

        <span className="mt-[3px] text-[12.5px] break-all text-suave">{email}</span>

        <div className="mt-3 flex flex-wrap justify-center gap-[7px]">
          <Etiqueta variante="solida">{ROLES[rol]}</Etiqueta>

          {/* El tipo solo se muestra cuando anade algo: para un trabajador
              raso repetiria la pastilla del rol. */}
          {TIPOS[tipo] !== ROLES[rol] && (
            <Etiqueta variante="contorno">{TIPOS[tipo]}</Etiqueta>
          )}
        </div>
      </div>
    </section>
  );
}

/* ===========================================================================
   SUBIDA DE FOTO — APAGADA, NO BORRADA
   ===========================================================================

   El motivo esta explicado a fondo en el bloque equivalente de
   src/actions/perfil.ts: en Vercel el disco de una funcion es de solo lectura
   y public/ se hornea en el build, asi que la foto no se podria ni escribir ni
   servir. En local y en un VPS funciona tal cual.

   NO se pone aqui un aviso del tipo "la foto llegara pronto": no se prometen
   fechas en la interfaz. Simplemente no hay nada que subir, y el avatar de
   iniciales cubre el hueco.

   PARA REACTIVARLA
   ----------------
   1. Devolver "use client" a la primera linea de este archivo.
   2. Descomentar los imports y el bloque de abajo, y sustituir el <div> del
      componente por el <form> que hay aqui.
   3. Descomentar la action `subirFoto` en src/actions/perfil.ts y
      `actualizarFoto` en src/models/usuarios.ts.
   4. Devolver la entrada de la foto al medidor de
      src/components/inicio/EstadoCuenta.tsx.
   =========================================================================== */

/*
import { useActionState, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Camera, CircleAlert, Upload, X } from "lucide-react";

import { subirFoto } from "@/actions/perfil";
import { Alerta, Boton } from "@/components/ui";
import { ESTADO_INICIAL } from "@/types";

const LIMITE_BYTES = 2 * 1024 * 1024;

const CAMARA =
  "absolute -right-0.5 -bottom-0.5 grid size-[34px] cursor-pointer place-items-center " +
  "rounded-full border-[3px] border-superficie bg-acento text-acento-contraste " +
  "suave hover:bg-acento-hover " +
  // El circulo mide 34 px porque asi lo pide el diseno, pero lo que responde
  // al dedo se estira a 44 px con el pseudoelemento: se respeta el objetivo
  // tactil sin engordar la pastilla.
  "before:absolute before:-inset-[5px] before:rounded-full before:content-['']";

// --- dentro del componente ---

const [estado, enviar, enviando] = useActionState(subirFoto, ESTADO_INICIAL);
const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
const [errorLocal, setErrorLocal] = useState<string | null>(null);

const formulario = useRef<HTMLFormElement>(null);
const entrada = useRef<HTMLInputElement>(null);

// La URL temporal de la vista previa ocupa memoria hasta que se revoca. La
// limpieza del efecto se dispara tambien al cambiar de imagen, asi que
// libera la anterior sin necesidad de hacerlo a mano en cada sitio.
useEffect(() => {
  if (!vistaPrevia) return;

  return () => URL.revokeObjectURL(vistaPrevia);
}, [vistaPrevia]);

// Cuando la subida sale bien la foto ya viene del servidor y la vista previa
// sobra.
//
// El ajuste se hace DURANTE EL RENDER, comparando con el estado anterior, y
// no dentro de un efecto: llamar a setState en un efecto obliga a pintar dos
// veces, una con el dato viejo y otra con el nuevo. Asi solo se pinta una.
const [estadoAnterior, setEstadoAnterior] = useState(estado);

if (estado !== estadoAnterior) {
  setEstadoAnterior(estado);

  if (estado.ok) {
    setVistaPrevia(null);
    setErrorLocal(null);
  }
}

// El formulario si es un sistema externo: limpiarlo toca el DOM, y eso es
// exactamente para lo que sirve un efecto.
useEffect(() => {
  if (estado.ok) formulario.current?.reset();
}, [estado]);

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

const fallo = errorLocal ?? (estado.ok ? null : (estado.errores?.foto ?? estado.mensaje));

// --- el JSX que envolvia a la identidad ---

<form
  ref={formulario}
  action={enviar}
  className="flex flex-col items-center pt-1 pb-0.5 text-center"
>
  <div className="relative">
    {vistaPrevia ? (
      <span className="grid size-[108px] shrink-0 place-items-center overflow-hidden rounded-full border-[3px] border-superficie bg-campo shadow-[0_0_0_1px_var(--borde)]">
        // Es una URL de objeto local, que solo existe en este navegador:
        // no hay nada que el optimizador de imagenes pueda pedir ni
        // cachear, asi que va como img a secas.
        <img
          src={vistaPrevia}
          alt="Vista previa de la foto elegida"
          className="size-full object-cover"
        />
      </span>
    ) : (
      <Avatar ... />
    )}

    // Va en el color de acento, que el tema resuelve: morado sobre claro y
    // vainilla sobre oscuro.
    <button
      type="button"
      onClick={() => entrada.current?.click()}
      aria-controls="foto"
      className={CAMARA}
    >
      <Camera aria-hidden="true" className="size-[15px]" />
      <span className="sr-only">Cambiar foto de perfil</span>
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
  />

  ... identidad ...

  {vistaPrevia && (
    <div className="mt-4 flex w-full gap-2.5">
      <Boton
        type="button"
        variante="fantasma"
        tamano="chico"
        onClick={descartar}
        disabled={enviando}
        className="flex-1"
      >
        <X aria-hidden="true" />
        Descartar
      </Boton>

      <Boton type="submit" tamano="chico" disabled={enviando} className="flex-1">
        {enviando ? (
          "Subiendo..."
        ) : (
          <>
            <Upload aria-hidden="true" />
            Subir
          </>
        )}
      </Boton>
    </div>
  )}

  {fallo && (
    <Alerta className="mt-4 w-full text-left" icono={<CircleAlert />}>
      {fallo}
    </Alerta>
  )}

  {estado.ok && estado.mensaje && (
    <Alerta tono="info" className="mt-4 w-full text-left">
      {estado.mensaje}
    </Alerta>
  )}

  <p className="mt-4 w-full border-t border-borde pt-3.5 text-[11.5px] leading-[1.5] text-suave">
    JPG, PNG o WEBP, hasta 2 MB. La foto anterior se reemplaza al subir una
    nueva.
  </p>
</form>
*/
