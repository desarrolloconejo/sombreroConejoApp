"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Check, Copy, Link2, Link2Off, TriangleAlert } from "lucide-react";

import { crearEnlace, revocarEnlace } from "@/actions/briefs";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { Boton, Campo, Etiqueta, Selector, useCampos, useCopiar } from "@/components/ui";
import { ESTADO_INICIAL, type EstadoFormulario } from "@/types";

/**
 * Los enlaces privados para prospectos (S-05): quien aun no es cliente llena
 * su brief por un enlace, sin cuenta.
 *
 * El enlace se ve UNA vez, al generarlo: se copia y se le hace llegar al
 * prospecto por el canal de siempre. No sale por correo, porque ningun correo
 * lleva tokens, y la base solo guarda su hash.
 */

export type FilaEnlace = {
  id: number;
  empresaNombre: string;
  contactoNombre: string;
  email: string;
  formatoNombre: string;
  estado: "vigente" | "vencido" | "revocado";
  /** El dia en que vence, ya escrito. */
  vence: string;
  briefId: number | null;
  briefRuta: string | null;
  briefEstado: string | null;
};

const VACIOS = { empresaNombre: "", contactoNombre: "", email: "", telefono: "" };

/** La ruta recien generada, entera, con boton de copiar que confirma. */
function EnlaceGenerado({ ruta }: { ruta: string }) {
  const { copiado, fallo, copiar: copiarTexto } = useCopiar(2500);
  const url = typeof window === "undefined" ? ruta : `${window.location.origin}${ruta}`;

  async function copiar() {
    await copiarTexto(url);
  }

  return (
    <div className="surge rounded-2xl border border-acento bg-acento-tenue p-4">
      <p className="text-[13px] font-bold">Copia el enlace ahora</p>
      <p className="mt-1 text-[12px] leading-relaxed text-suave">
        No se vuelve a mostrar. Vale 7 dias, y cada mensaje que le escribas en el brief lo renueva.
      </p>
      <p
        aria-label="Enlace generado"
        className="mt-3 break-all rounded-xl border border-borde bg-superficie px-3 py-2.5 font-mono text-[12px]"
      >
        {url}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <Boton type="button" tamano="chico" onClick={copiar}>
          {copiado ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copiado ? "Copiado" : "Copiar el enlace"}
        </Boton>
        {fallo && (
          <span role="alert" className="inline-flex items-center gap-1.5 text-[12px] text-suave">
            <TriangleAlert aria-hidden="true" className="size-3.5" />
            No se pudo copiar: seleccionalo y copialo a mano.
          </span>
        )}
      </div>
    </div>
  );
}

function NuevoEnlace({ formatos }: { formatos: { clave: string; nombre: string }[] }) {
  const [estado, enviar, enviando] = useActionState(crearEnlace, ESTADO_INICIAL);
  useAvisoDeAccion(estado);
  const { campo, setValores } = useCampos(VACIOS);
  const [formato, setFormato] = useState(formatos[0]?.clave ?? "");

  // Con el enlace generado, el formulario queda limpio para el siguiente.
  const [visto, setVisto] = useState<EstadoFormulario>(estado);
  if (estado !== visto) {
    setVisto(estado);
    if (estado.ok) setValores(VACIOS);
  }

  const errores = estado.errores ?? {};

  return (
    <div className="flex flex-col gap-4">
      {estado.ok && estado.enlace && <EnlaceGenerado ruta={estado.enlace} />}

      <form action={enviar} noValidate className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
        <Campo
          id="enlace-empresa"
          etiqueta="Empresa"
          maxLength={150}
          error={errores.empresaNombre}
          {...campo("empresaNombre")}
        />
        <Campo
          id="enlace-contacto"
          etiqueta="Persona de contacto"
          maxLength={150}
          error={errores.contactoNombre}
          {...campo("contactoNombre")}
        />
        <Campo
          id="enlace-email"
          etiqueta="Correo"
          type="email"
          maxLength={254}
          error={errores.email}
          {...campo("email")}
        />
        <Campo id="enlace-telefono" etiqueta="Telefono" opcional maxLength={40} {...campo("telefono")} />
        <Selector
          id="enlace-formato"
          nombre="formato"
          etiqueta="Tipo de brief"
          valor={formato}
          onCambio={setFormato}
          error={errores.formato}
          className="sm:col-span-2"
          opciones={formatos.map((f) => ({ valor: f.clave, texto: f.nombre }))}
        />
        <div className="flex justify-end sm:col-span-2">
          <Boton type="submit" disabled={enviando}>
            <Link2 aria-hidden="true" />
            {enviando ? "Generando..." : "Generar enlace"}
          </Boton>
        </div>
      </form>
    </div>
  );
}

/**
 * Revocar. Su estado vive en la lista: al revocar, el boton desaparece y el
 * aviso se perderia con el.
 */
function Revocar({
  id,
  empresa,
  enviar,
  enviando,
}: {
  id: number;
  empresa: string;
  enviar: (datos: FormData) => void;
  enviando: boolean;
}) {
  return (
    <form action={enviar}>
      <input type="hidden" name="id" value={id} />
      <Boton
        type="submit"
        variante="fantasma"
        tamano="chico"
        disabled={enviando}
        aria-label={`Revocar el enlace de ${empresa}`}
      >
        <Link2Off aria-hidden="true" />
        Revocar
      </Boton>
    </form>
  );
}

const NOMBRE_ESTADO: Record<FilaEnlace["estado"], string> = {
  vigente: "Vigente",
  vencido: "Vencido",
  revocado: "Revocado",
};

export function EnlacesProspectos({
  enlaces,
  formatos,
}: {
  enlaces: FilaEnlace[];
  formatos: { clave: string; nombre: string }[];
}) {
  const [estadoRevocar, revocar, revocando] = useActionState(revocarEnlace, ESTADO_INICIAL);
  useAvisoDeAccion(estadoRevocar);

  return (
    <div className="flex flex-col gap-5">
      <NuevoEnlace formatos={formatos} />

      {enlaces.length > 0 && (
        <ul aria-label="Enlaces generados" className="-my-1 flex flex-col border-t border-borde pt-1">
          {enlaces.map((enlace) => (
            <li
              key={enlace.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-borde py-3 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold">{enlace.empresaNombre}</p>
                <p className="mt-0.5 truncate text-[12px] text-suave">
                  {enlace.contactoNombre} · {enlace.email}
                </p>
                <p className="mt-0.5 text-[12px] text-suave">
                  {enlace.formatoNombre}
                  {enlace.estado === "vigente" ? ` · vence el ${enlace.vence}` : ""}
                </p>
                {enlace.briefRuta && (
                  <Link href={enlace.briefRuta} className="mt-1 inline-block text-[12px] font-semibold text-acento hover:underline">
                    Ver su brief{enlace.briefEstado ? ` (${enlace.briefEstado})` : ""}
                  </Link>
                )}
              </div>
              <Etiqueta variante={enlace.estado === "vigente" ? "solida" : "contorno"}>
                {NOMBRE_ESTADO[enlace.estado]}
              </Etiqueta>
              {enlace.estado === "vigente" && (
                <Revocar id={enlace.id} empresa={enlace.empresaNombre} enviar={revocar} enviando={revocando} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
