"use client";

import { useActionState } from "react";
import { UserMinus, UserPlus } from "lucide-react";

import { asignarEjecutivo, quitarEjecutivo } from "@/actions/asignaciones";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { Avatar, Boton, Selector } from "@/components/ui";
import { ESTADO_INICIAL } from "@/types";
import type { Asignacion, PersonaBreve } from "@/types";

/**
 * Quien atiende a la empresa, dentro de su ficha.
 *
 * Un ejecutivo de cuentas solo ve los proyectos de las empresas que tiene
 * aqui. Una empresa puede tener varios; el administrador no hace falta
 * asignarlo, porque ya las ve todas.
 */

/**
 * El boton de quitar de cada fila. No lleva su propio estado: al quitar, la
 * fila desaparece con la revalidacion y se llevaria el resultado antes de
 * avisarlo. El estado vive en el padre, que no se desmonta.
 */
function Quitar({
  asignacion,
  enviar,
  enviando,
}: {
  asignacion: Asignacion;
  enviar: (datos: FormData) => void;
  enviando: boolean;
}) {
  return (
    <form action={enviar}>
      <input type="hidden" name="id" value={asignacion.id} />
      <Boton
        type="submit"
        variante="fantasma"
        tamano="chico"
        disabled={enviando}
        aria-label={`Quitar a ${asignacion.usuarioNombre}`}
      >
        <UserMinus aria-hidden="true" />
        {enviando ? "Quitando…" : "Quitar"}
      </Boton>
    </form>
  );
}

export function EjecutivosEmpresa({
  empresaId,
  activa,
  asignados,
  candidatos,
}: {
  empresaId: number;
  activa: boolean;
  asignados: Asignacion[];
  /** Ejecutivos de cuentas activos que todavia no la atienden. */
  candidatos: PersonaBreve[];
}) {
  const [estado, enviar, enviando] = useActionState(asignarEjecutivo, ESTADO_INICIAL);
  const [quitado, quitar, quitando] = useActionState(quitarEjecutivo, ESTADO_INICIAL);

  useAvisoDeAccion(estado);
  useAvisoDeAccion(quitado);

  return (
    <div className="flex flex-col gap-3">
      {asignados.length === 0 ? (
        <p className="rounded-xl border border-borde bg-campo px-4 py-3.5 text-[12.5px] leading-relaxed text-suave">
          Ningun ejecutivo la atiende todavia. Hasta que se le asigne uno, solo
          un administrador puede abrirle proyectos.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {asignados.map((asignacion) => (
            <li
              key={asignacion.id}
              className="flex items-center gap-3 rounded-xl border border-borde px-3.5 py-2"
            >
              <Avatar
                nombre={asignacion.usuarioNombre.split(" ")[0]}
                apellido={asignacion.usuarioNombre.split(" ").slice(1).join(" ")}
                tamano="chico"
              />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                {asignacion.usuarioNombre}
              </span>
              <Quitar asignacion={asignacion} enviar={quitar} enviando={quitando} />
            </li>
          ))}
        </ul>
      )}

      {activa && candidatos.length > 0 && (
        // La clave cambia con cada asignacion hecha: el selector vuelve a
        // quedar vacio en lugar de conservar a quien se acaba de asignar.
        <form
          key={asignados.length}
          action={enviar}
          className="flex flex-col gap-2.5 sm:flex-row sm:items-end"
        >
          <input type="hidden" name="empresaId" value={empresaId} />
          <Selector
            id="ejecutivo-nuevo"
            nombre="usuarioId"
            etiqueta="Asignar un ejecutivo"
            marcador="Elige a alguien de Cuentas"
            opciones={candidatos.map((persona) => ({
              valor: String(persona.id),
              texto: persona.nombre,
            }))}
            error={estado.errores?.usuarioId}
            className="min-w-0 flex-1"
          />
          <Boton type="submit" tamano="chico" disabled={enviando}>
            <UserPlus aria-hidden="true" />
            {enviando ? "Asignando…" : "Asignar"}
          </Boton>
        </form>
      )}

      {activa && candidatos.length === 0 && asignados.length > 0 && (
        <p className="text-[12px] text-suave">
          Todos los ejecutivos de Cuentas atienden ya a esta empresa.
        </p>
      )}

      {activa && candidatos.length === 0 && asignados.length === 0 && (
        <p className="text-[12px] text-suave">
          No hay nadie activo en el cargo Cuentas. Se crea desde Usuarios.
        </p>
      )}
    </div>
  );
}
