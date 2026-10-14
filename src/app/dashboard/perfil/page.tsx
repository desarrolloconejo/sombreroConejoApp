import type { Metadata } from "next";

import { PerfilWrapper } from "@/components/perfil";
import { obtenerSesion, requerirUsuario } from "@/lib/sesion";
import * as dosPasosModelo from "@/models/dosPasos";
import * as sesiones from "@/models/sesiones";
import { ZONA_HORARIA } from "@/lib/fechas";

export const metadata: Metadata = {
  title: "Mi perfil",
};

const FECHA = new Intl.DateTimeFormat("es-VE", { timeZone: ZONA_HORARIA, dateStyle: "long" });

/**
 * La page es de servidor y hace solo lo que le toca: exigir la sesion, leer a
 * la persona ya resuelta con su tipo y su rol, e inyectarla. El marcado vive
 * entero en el wrapper.
 *
 * `requerirUsuario` lee de la base y no del token, que es lo correcto aqui:
 * si un administrador le cambio el cargo a alguien, el perfil tiene que
 * mostrar el valor de ahora, no la foto del momento en que inicio sesion.
 */
export default async function PaginaPerfil() {
  const usuario = await requerirUsuario();

  // Las dos lecturas no dependen una de otra. La sesion ya esta verificada en
  // esta peticion, asi que leerla de nuevo no cuesta nada.
  const [abiertas, sesion, dosPasos] = await Promise.all([
    sesiones.listarAbiertas(usuario.id),
    obtenerSesion(),
    dosPasosModelo.estado(usuario.id),
  ]);

  return (
    <PerfilWrapper
      usuario={usuario}
      sesiones={abiertas}
      sesionActualId={sesion?.sesionId ?? null}
      dosPasos={{
        activado: dosPasos.activado,
        // La fecha se formatea aqui, en el servidor: el idioma del navegador
        // no puede producir un texto distinto del que se pinto.
        desde: dosPasos.activadoEn ? FECHA.format(dosPasos.activadoEn) : null,
        respaldos: dosPasos.respaldos,
      }}
    />
  );
}
