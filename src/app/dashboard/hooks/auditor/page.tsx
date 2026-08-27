import type { Metadata } from "next";

import { Wrapper } from "@/components/layout/Wrapper";
import { AuditorSuelto, FiltroCalidad } from "@/components/hooks";
import { limitesPorDefecto } from "@/lib/hooks/auditor";
import { requerirCargo } from "@/lib/sesion";
import * as empresasModelo from "@/models/empresas";

export const metadata: Metadata = {
  title: "Auditor de hooks",
};

const MIGAS = [
  { texto: "Conejo App", href: "/dashboard" },
  { texto: "Hooks", href: "/dashboard/hooks" },
  { texto: "Auditor" },
];

export default async function PaginaAuditor() {
  await requerirCargo("redes");

  const empresas = await empresasModelo.listarActivas();
  const estandar = limitesPorDefecto();

  return (
    <Wrapper
      migas={MIGAS}
      kicker="04 / Auditor"
      titulo="Control previo"
      descripcion="Nueve controles conocidos antes de grabar. Umbral de paso visible: 70/100."
    >
      {/*
        El aviso va ANTES de cualquier cosa, y se queda siempre. Es una
        decision etica del producto, no un adorno: la puntuacion no esta
        contrastada contra resultados y quien la lee tiene derecho a saberlo
        antes de fiarse de ella.
      */}
      <div className="surge mb-[22px] rounded-xl border border-[#d77474] bg-[#fff2f1] px-4 py-3.5 text-[12.5px] leading-relaxed text-[#7f2b2b] dark-tema:bg-[rgb(215_116_116/0.12)] dark-tema:text-[#f0b8b8]">
        <b>Esta puntuacion todavia no esta validada.</b> Los controles salen de
        investigacion disponible y criterio de la casa, no de un modelo
        contrastado contra resultados. Usala como lista de comprobacion, no
        como oraculo.
      </div>

      <AuditorSuelto
        empresas={empresas}
        limiteVoz={estandar.maxPalabrasVoz}
        limiteInsert={estandar.maxPalabrasInsert}
      />

      <div className="mt-5">
        <FiltroCalidad />
      </div>
    </Wrapper>
  );
}
