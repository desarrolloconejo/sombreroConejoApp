import { TarjetaDosPasos } from "@/components/dosPasos";
import { Wrapper } from "@/components/layout/Wrapper";
import type { Miga } from "@/components/layout/Breadcrumb";
import type { SesionAbierta, UsuarioCompleto } from "@/types";

import { FormularioDatos } from "./FormularioDatos";
import { FormularioPassword } from "./FormularioPassword";
import { SelectorTema } from "./SelectorTema";
import { TarjetaFoto } from "./TarjetaFoto";
import { TarjetaSesion } from "./TarjetaSesion";
import { TarjetaSesiones } from "./TarjetaSesiones";

/**
 * El envoltorio del modulo Mi perfil.
 *
 * Es de servidor: recibe el usuario de la page y reparte a cada tarjeta solo
 * los campos que necesita. Ninguna de ellas recibe el objeto entero, y las de
 * cliente reciben unicamente valores primitivos, para que por la frontera no
 * cruce nada que no se vaya a pintar.
 *
 * Arriba van dos columnas: a la izquierda quien eres y el tema, a la derecha
 * tus datos. Debajo, el resto de tarjetas ocupan el ancho completo: son
 * bloques independientes —la contrasena, los dos pasos, las sesiones— y en
 * una columna estrecha dejaban media pantalla vacia a su lado.
 */

const MIGAS: Miga[] = [
  { texto: "Conejo App", href: "/dashboard" },
  { texto: "Mi perfil" },
];

export function PerfilWrapper({
  usuario,
  sesiones,
  sesionActualId,
  dosPasos,
}: {
  usuario: UsuarioCompleto;
  sesiones: SesionAbierta[];
  sesionActualId: number | null;

  /** El estado de la verificacion en dos pasos, con la fecha ya formateada. */
  dosPasos: { activado: boolean; desde: string | null; respaldos: number };
}) {
  return (
    <Wrapper
      migas={MIGAS}
      kicker="Tu cuenta"
      titulo="Mi perfil"
      descripcion="Tus datos y tus preferencias de la plataforma."
    >
      {/* En movil las tarjetas caen en una sola columna y conservan el orden
          en que se escriben, que ya es el de importancia: quien eres primero,
          y las preferencias al final. */}
      <div className="grid gap-5 lg:grid-cols-[348px_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-5">
          <TarjetaFoto
            nombre={usuario.nombre}
            apellido={usuario.apellido}
            email={usuario.email}
            fotoUrl={usuario.fotoUrl}
            rol={usuario.rol}
            tipo={usuario.tipo}
          />

          <SelectorTema />
        </div>

        <div className="flex flex-col gap-5">
          <FormularioDatos
            nombre={usuario.nombre}
            apellido={usuario.apellido}
            telefono={usuario.telefono}
            email={usuario.email}
            cargo={usuario.cargo}
          />

        </div>
      </div>

      <div className="mt-5 flex flex-col gap-5">
        <FormularioPassword />

        <TarjetaDosPasos
          activado={dosPasos.activado}
          desde={dosPasos.desde}
          respaldos={dosPasos.respaldos}
        />

        <TarjetaSesiones sesiones={sesiones} actualId={sesionActualId} />

        <TarjetaSesion ultimoAcceso={usuario.ultimoAcceso} />
      </div>
    </Wrapper>
  );
}
