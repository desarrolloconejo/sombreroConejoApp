import type { Metadata } from "next";
import { Building2 } from "lucide-react";

import { Wrapper } from "@/components/layout/Wrapper";
import { PanelLateral } from "@/components/listado";
import { FormularioEmpresa } from "@/components/empresas/FormularioEmpresa";
import { FormularioHook } from "@/components/hooks";
import { BotonEnlace } from "@/components/ui";
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
 *
 * Aqui vive tambien el alta de empresas, y no es un capricho de colocacion:
 * es donde uno se encuentra con que falta el cliente. La ficha exige uno, y
 * antes el desplegable salia vacio sin explicacion y sin salida.
 */

export const metadata: Metadata = {
  title: "Escribir un hook",
};

const RUTA = "/dashboard/hooks/nuevo";

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

  const abrirEmpresa = estado.panel === "nuevo";

  // Partir de una ficha para crear otra: se copian sus campos pero NO su id,
  // asi que el primer guardado crea una pieza nueva y la original no se toca.
  const esPlantilla = estado.panel === "plantilla";

  const [empresas, ficha] = await Promise.all([
    empresasModelo.listarActivas(),
    estado.panelId !== null ? fichasModelo.buscarPorId(estado.panelId) : null,
  ]);

  const limites = ficha
    ? await reglasModelo.limitesDeEmpresa(ficha.empresaId)
    : null;

  const activos = limites ?? limitesPorDefecto();

  // Se conserva el resto de la URL al abrir y cerrar el panel: si alguien
  // estaba editando una ficha, el alta de empresa no puede perdersela.
  const conservar = new URLSearchParams();
  if (estado.panelId !== null && !abrirEmpresa) {
    conservar.set("panel", estado.panel ?? "editar");
    conservar.set("id", String(estado.panelId));
  }

  const hrefEmpresa = `${RUTA}?panel=nuevo`;
  const hrefCerrar = conservar.toString() ? `${RUTA}?${conservar}` : RUTA;

  return (
    <Wrapper
      migas={MIGAS}
      kicker="03 / Hooks"
      titulo={
        esPlantilla
          ? "Parte de una que funciono"
          : ficha
            ? "Sigue donde lo dejaste"
            : "Escribe la decision, no la frase"
      }
      descripcion={
        esPlantilla
          ? "Se copio todo menos el cliente: elige a quien va esta vez. La ficha original no se toca; al guardar nace una pieza nueva."
          : "Completa la decision antes de redactar. Al final genera una ficha que edicion puede ejecutar sin interpretar la idea."
      }
      accion={
        <BotonEnlace href={hrefEmpresa} variante="fantasma" tamano="chico">
          <Building2 aria-hidden="true" />
          Nueva empresa
        </BotonEnlace>
      }
    >
      <FormularioHook
        empresas={empresas}
        ficha={ficha}
        limiteVoz={activos.maxPalabrasVoz}
        limiteInsert={activos.maxPalabrasInsert}
        etiquetaRegla={activos.etiqueta}
        hrefNuevaEmpresa={hrefEmpresa}
        plantilla={esPlantilla}
      />

      {abrirEmpresa && (
        <PanelLateral
          hrefCerrar={hrefCerrar}
          kicker="Alta de cliente"
          titulo="Nueva empresa"
          descripcion="Solo hace falta el nombre. El resto se puede completar despues."
        >
          <FormularioEmpresa hrefCancelar={hrefCerrar} />
        </PanelLateral>
      )}
    </Wrapper>
  );
}
