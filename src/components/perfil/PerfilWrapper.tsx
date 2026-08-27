import { Wrapper } from "@/components/layout/Wrapper";
import type { Miga } from "@/components/layout/Breadcrumb";
import type { UsuarioCompleto } from "@/types";

import { FormularioDatos } from "./FormularioDatos";
import { FormularioPassword } from "./FormularioPassword";
import { SelectorTema } from "./SelectorTema";
import { TarjetaFoto } from "./TarjetaFoto";
import { TarjetaSesion } from "./TarjetaSesion";

/**
 * El envoltorio del modulo Mi perfil.
 *
 * Es de servidor: recibe el usuario de la page y reparte a cada tarjeta solo
 * los campos que necesita. Ninguna de ellas recibe el objeto entero, y las de
 * cliente reciben unicamente valores primitivos, para que por la frontera no
 * cruce nada que no se vaya a pintar.
 *
 * Las dos columnas se separan por ritmo de uso: a la izquierda lo que se
 * cambia de vez en cuando (la identidad, el tema) y a la derecha lo que se llena
 * campo a campo.
 */

const MIGAS: Miga[] = [
  { texto: "Conejo App", href: "/dashboard" },
  { texto: "Mi perfil" },
];

export function PerfilWrapper({ usuario }: { usuario: UsuarioCompleto }) {
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

          <FormularioPassword />

          <TarjetaSesion ultimoAcceso={usuario.ultimoAcceso} />
        </div>
      </div>
    </Wrapper>
  );
}
