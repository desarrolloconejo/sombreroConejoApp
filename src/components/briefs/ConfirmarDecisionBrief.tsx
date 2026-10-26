"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Ban, Check, FileSpreadsheet, FolderPlus } from "lucide-react";

import { aceptarBrief, descartarBrief, presupuestarBrief } from "@/actions/briefs";
import { Alerta, Boton, BotonEnlace, CLASE_CONTROL } from "@/components/ui";
import { CredencialProvisional } from "@/components/usuarios/CredencialProvisional";
import { ESTADO_INICIAL, TITULOS_DECISION, type DecisionBrief } from "@/types";

/**
 * Confirmar una decision sobre un brief, y despues ver lo que paso.
 *
 * Son dos momentos del mismo gesto, como al restablecer una contrasena: antes
 * se dice que va a pasar (y que no), y en cuanto se hace se muestra el
 * resultado aqui mismo, con los datos de acceso si nacio una cuenta. Esos
 * datos se ven una sola vez, asi que no pueden quedar en un aviso que se va.
 *
 * La page pinta esta ventana mientras este `?decision=` en la URL, aunque el
 * brief ya haya cambiado de estado: asi el estado de la action sobrevive a la
 * revalidacion y el resultado no se pierde.
 */

const ACCIONES = {
  aceptar: aceptarBrief,
  presupuestar: presupuestarBrief,
  descartar: descartarBrief,
} as const;

export function ConfirmarDecisionBrief({
  decision,
  briefId,
  esProspecto,
  disponible,
  hrefCerrar,
}: {
  decision: DecisionBrief;
  briefId: number;
  /** Llego por un enlace privado: decidir puede crear su empresa y su cuenta. */
  esProspecto: boolean;
  /** Si el brief aun admite esta decision. */
  disponible: boolean;
  hrefCerrar: string;
}) {
  const [estado, enviar, enviando] = useActionState(ACCIONES[decision], ESTADO_INICIAL);
  const [motivo, setMotivo] = useState("");

  if (estado.ok) {
    return (
      <div className="flex flex-col gap-4">
        <Alerta tono="logro">
          <b className="font-semibold">{estado.mensaje}</b>
        </Alerta>

        {estado.credencial && (
          <CredencialProvisional
            email={estado.credencial.email}
            password={estado.credencial.password}
            titulo="Cuenta creada para el cliente"
            descripcion="Enviasela al cliente: al entrar tendra que elegir otra contrasena. No se vuelve a mostrar."
          />
        )}

        <div className="flex flex-wrap justify-end gap-2.5">
          {estado.destino && (
            <BotonEnlace href={estado.destino} variante="fantasma" tamano="chico">
              Abrir el proyecto
              <ArrowRight aria-hidden="true" />
            </BotonEnlace>
          )}
          <BotonEnlace href={hrefCerrar} tamano="chico">
            <Check aria-hidden="true" />
            Listo
          </BotonEnlace>
        </div>
      </div>
    );
  }

  if (!disponible) {
    return (
      <div className="flex flex-col gap-4">
        <p>Este brief ya no esta para esta decision: alguien lo decidio antes o cambio de estado.</p>
        <div className="flex justify-end">
          <BotonEnlace href={hrefCerrar} tamano="chico">
            Cerrar
          </BotonEnlace>
        </div>
      </div>
    );
  }

  return (
    <form action={enviar} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="id" value={briefId} />

      {decision === "aceptar" && (
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>
            Nace el <b className="font-semibold text-texto">proyecto</b>: Desarrollo de producto, con su
            pieza, sus cinco fases y las tareas sugeridas. Lo llevas tu.
          </li>
          <li>La fase 1 queda en curso; al completarla, el brief queda validado.</li>
          <li>El cliente recibe el aviso de que su brief es un proyecto.</li>
        </ul>
      )}

      {decision === "presupuestar" && (
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>
            El brief pasa a la cola de <b className="font-semibold text-texto">administracion</b>, que
            arma el presupuesto y se lo envia al cliente.
          </li>
          <li>Todavia no nace el proyecto: lo abres tu cuando el cliente apruebe el presupuesto.</li>
        </ul>
      )}

      {decision === "descartar" && (
        <>
          <p>
            El brief queda <b className="font-semibold text-texto">archivado</b>, no se borra, y el
            cliente recibe el motivo que escribas.
          </p>
          <label>
            <span className="mb-2 block text-xs font-semibold text-texto">Por que no seguimos</span>
            <textarea
              name="motivo"
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              rows={3}
              maxLength={1000}
              aria-invalid={estado.errores?.motivo ? true : undefined}
              className={`${CLASE_CONTROL} min-h-[84px]`}
            />
            {estado.errores?.motivo && (
              <span role="alert" className="mt-1.5 block text-[12px] font-medium text-blackberry dark-tema:text-acento">
                {estado.errores.motivo}
              </span>
            )}
          </label>
        </>
      )}

      {esProspecto && decision !== "descartar" && (
        <Alerta tono="info">
          <b className="font-semibold">Es un prospecto.</b> Pasa a ser cliente: nace su empresa,
          asignada a ti, y su cuenta, que podra aprobar piezas y ver sus finanzas. Te mostraremos aqui
          su contrasena provisional para que se la envies.
        </Alerta>
      )}

      {!estado.ok && estado.mensaje && <Alerta>{estado.mensaje}</Alerta>}

      <div className="flex flex-wrap justify-end gap-2.5">
        <BotonEnlace href={hrefCerrar} variante="fantasma" tamano="chico">
          Cancelar
        </BotonEnlace>
        <Boton
          type="submit"
          tamano="chico"
          variante={decision === "descartar" ? "peligro" : "primario"}
          disabled={enviando || (decision === "descartar" && !motivo.trim())}
        >
          {decision === "aceptar" && <FolderPlus aria-hidden="true" />}
          {decision === "presupuestar" && <FileSpreadsheet aria-hidden="true" />}
          {decision === "descartar" && <Ban aria-hidden="true" />}
          {enviando ? "Un momento..." : TITULOS_DECISION[decision]}
        </Boton>
      </div>
    </form>
  );
}
