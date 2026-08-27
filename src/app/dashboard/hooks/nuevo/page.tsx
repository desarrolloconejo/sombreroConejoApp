import type { Metadata } from "next";

import { Wrapper } from "@/components/layout/Wrapper";
import { FormularioHook } from "@/components/hooks";
import { limitesPorDefecto } from "@/lib/hooks/auditor";
import { leerEstadoListado } from "@/lib/parametros";
import { requerirCargo } from "@/lib/sesion";
import * as empresasModelo from "@/models/empresas";
import * as fichasModelo from "@/models/fichas";
import * as reglasModelo from "@/models/reglasHook";

/**
 * El canvas: donde se escribe la decision de una pieza.
 *
 * La page hace lo que le toca: exige el permiso, resuelve los datos e
 * INYECTA. Los limites del auditor se resuelven aqui y no dentro del
 * formulario porque dependen del cliente, y el cliente puede cambiar mientras
 * se escribe: se pasan los del que trae la ficha, y la action vuelve a
 * resolverlos con el definitivo al guardar.
 */

export const metadata: Metadata = {
  title: "Escribir un hook",
};

const MIGAS = [
  { texto: "Conejo App", href: "/dashboard" },
  { texto: "Hooks", href: "/dashboard/hooks" },
  { texto: "Escribir" },
];

export default async function PaginaNuevoHook(
  props: PageProps<"/dashboard/hooks/nuevo">,
) {
  await requerirCargo("redes");

  const parametros = await props.searchParams;

  // Se reutiliza el lector del listado para no volver a escribir el saneado
  // de un id que llega por la URL: nunca lanza y cae a null ante basura.
  const estado = leerEstadoListado(parametros, {
    ordenPermitido: ["creadoEn"],
    ordenPorDefecto: "creadoEn",
  });

  const [empresas, ficha] = await Promise.all([
    empresasModelo.listarActivas(),
    estado.panelId !== null ? fichasModelo.buscarPorId(estado.panelId) : null,
  ]);

  const limites = ficha
    ? await reglasModelo.limitesDeEmpresa(ficha.empresaId)
    : null;

  const activos = limites ?? limitesPorDefecto();

  return (
    <Wrapper
      migas={MIGAS}
      kicker="03 / Hooks"
      titulo={ficha ? "Sigue donde lo dejaste" : "Escribe la decision, no la frase"}
      descripcion="Completa la decision antes de redactar. Al final genera una ficha que edicion puede ejecutar sin interpretar la idea."
    >
      <FormularioHook
        empresas={empresas}
        ficha={ficha}
        limiteVoz={activos.maxPalabrasVoz}
        limiteInsert={activos.maxPalabrasInsert}
        etiquetaRegla={activos.etiqueta}
      />
    </Wrapper>
  );
}
