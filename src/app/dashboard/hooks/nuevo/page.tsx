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
import * as referenciasModelo from "@/models/referencias";
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

/** Un id que llega por la URL. Nunca lanza: la basura cae a null. */
function comoId(valor: unknown): number | null {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

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

  /*
   * Una plantilla puede venir de dos sitios, y no son el mismo.
   *
   * De una FICHA propia (`?id=`) se copia la decision entera menos el cliente.
   * De una REFERENCIA del banco (`?ref=`) solo hay tres cosas que copiar —el
   * hook, el Insert-Titulo y la plataforma— porque una referencia no tiene
   * objetivo ni audiencia: es material observado, no una decision tomada.
   *
   * El id de la referencia va en su propio parametro para que no se confunda
   * con el de una ficha: si compartieran `id`, un enlace viejo abriria la
   * ficha 7 creyendo abrir la referencia 7.
   */
  const idReferencia = comoId(parametros.ref);

  const [empresas, ficha, referencia] = await Promise.all([
    empresasModelo.listarActivas(),
    estado.panelId !== null ? fichasModelo.buscarPorId(estado.panelId) : null,
    esPlantilla && idReferencia !== null
      ? referenciasModelo.buscarPorId(idReferencia)
      : null,
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
        referencia
          ? "Parte de una referencia del banco"
          : esPlantilla
            ? "Parte de una que funciono"
            : ficha
              ? "Sigue donde lo dejaste"
              : "Escribe la decision, no la frase"
      }
      descripcion={
        referencia
          ? "Se trajo el hook, su Insert-Titulo y la plataforma. Lo demas es tuyo: una referencia se adapta, no se copia. La del banco no se toca."
          : esPlantilla
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
        referencia={referencia}
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
