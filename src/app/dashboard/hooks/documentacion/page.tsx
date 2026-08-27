import type { Metadata } from "next";

import { Wrapper } from "@/components/layout/Wrapper";
import { ModalConfirmacion, PanelLateral } from "@/components/listado";
import {
  ConfirmarDocumentacion,
  DetalleApertura,
  DetalleReferencia,
  DetalleRegla,
  FormularioApertura,
  FormularioReferencia,
  FormularioRegla,
  RotuloSeccion,
  SeccionAperturas,
  SeccionReferencias,
  SeccionReglas,
} from "@/components/hooks";
import { TERRITORIOS } from "@/lib/hooks/catalogo";
import { requerirCargo } from "@/lib/sesion";
import * as aperturasModelo from "@/models/aperturas";
import * as empresasModelo from "@/models/empresas";
import * as referenciasModelo from "@/models/referencias";
import * as reglasModelo from "@/models/reglasHook";
import type { SlugTerritorio } from "@/types";

/**
 * Documentacion: con que se escribe y como habla esta marca.
 *
 * El Manual dice como funciona un hook EN GENERAL; esto dice que se puede
 * usar en ESTA cuenta. Son dos pasos distintos y por eso son dos pantallas:
 * el manual se lee una vez, esto se consulta cada vez que se escribe.
 *
 * Los paneles y modales se abren por la URL (?panel=ver-regla&id=3, ?panel=editar-apertura&id=1),
 * siguiendo el mismo estandar que el modulo de usuarios (ver ficha -> editar / borrar).
 */

export const metadata: Metadata = {
  title: "Documentacion de hooks",
};

const RUTA = "/dashboard/hooks/documentacion";

const MIGAS = [
  { texto: "Conejo App", href: "/dashboard" },
  { texto: "Hooks", href: "/dashboard/hooks" },
  { texto: "Documentacion" },
];

/**
 * Construye una URL de esta pantalla conservando lo que el usuario ya eligio.
 *
 * El territorio y el interruptor de retiradas viajan en TODOS los enlaces,
 * incluidos los que abren un panel: si no, cerrar el modal de una apertura
 * retirada devolveria a la lista sin retiradas, es decir, sin la apertura que
 * se acababa de tocar.
 */
function enlace(
  territorio: string | null,
  panel?: string,
  id?: number,
  retiradas = false,
): string {
  const parametros = new URLSearchParams();

  if (territorio) parametros.set("territorio", territorio);
  if (retiradas) parametros.set("retiradas", "si");
  if (panel) parametros.set("panel", panel);
  if (typeof id === "number") parametros.set("id", String(id));

  const cadena = parametros.toString();
  return cadena ? `${RUTA}?${cadena}` : RUTA;
}

function comoTerritorio(valor: unknown): SlugTerritorio | null {
  return TERRITORIOS.find((t) => t.slug === valor)?.slug ?? null;
}

function comoId(valor: unknown): number | null {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

export default async function PaginaDocumentacion(
  props: PageProps<"/dashboard/hooks/documentacion">,
) {
  await requerirCargo("redes");

  const parametros = await props.searchParams;

  const territorio = comoTerritorio(parametros.territorio);
  const panel = typeof parametros.panel === "string" ? parametros.panel : null;
  const id = comoId(parametros.id);
  const verRetiradas = parametros.retiradas === "si";

  const [reglas, aperturas, totalAperturas, referencias, empresas] =
    await Promise.all([
      reglasModelo.listar(),
      aperturasModelo.listar({
        ...(territorio ? { territorio } : {}),
        incluirRetiradas: verRetiradas,
      }),
      aperturasModelo.contarActivas(),
      referenciasModelo.listar(),
      empresasModelo.listarActivas(),
    ]);

  // Solo se consulta el registro que el panel o modal va a mostrar
  const [
    reglaVer,
    reglaEditar,
    reglaBorrar,
    aperturaVer,
    aperturaEditar,
    aperturaRetirar,
    referenciaVer,
    referenciaEditar,
    referenciaBorrar,
  ] = await Promise.all([
    (panel === "ver-regla" || panel === "ver") && id !== null
      ? reglasModelo.buscarPorId(id)
      : null,
    (panel === "editar-regla" || panel === "regla" || panel === "nueva-regla") && id !== null
      ? reglasModelo.buscarPorId(id)
      : null,
    panel === "borrar-regla" && id !== null ? reglasModelo.buscarPorId(id) : null,

    panel === "ver-apertura" && id !== null
      ? aperturasModelo.buscarPorId(id)
      : null,
    (panel === "editar-apertura" || panel === "apertura" || panel === "nueva-apertura") && id !== null
      ? aperturasModelo.buscarPorId(id)
      : null,
    (panel === "retirar" || panel === "retirar-apertura" || panel === "reponer-apertura") &&
    id !== null
      ? aperturasModelo.buscarPorId(id)
      : null,

    panel === "ver-referencia" && id !== null
      ? referenciasModelo.buscarPorId(id)
      : null,
    (panel === "editar-referencia" || panel === "referencia" || panel === "nueva-referencia") && id !== null
      ? referenciasModelo.buscarPorId(id)
      : null,
    panel === "borrar-referencia" && id !== null ? referenciasModelo.buscarPorId(id) : null,
  ]);

  // Cerrar devuelve a la lista TAL Y COMO estaba, retiradas incluidas: si no,
  // reponer una apertura terminaria en una lista donde ya no aparece.
  const hrefCerrar = enlace(territorio, undefined, undefined, verRetiradas);

  return (
    <Wrapper
      migas={MIGAS}
      kicker="02 / Documentacion"
      titulo="Con que se escribe y como habla esta marca"
      descripcion="Lo que hay que tener delante antes de escribir. El Manual dice como funciona un hook en general; esto dice que se puede usar en esta cuenta y con que se parte."
    >
      <RotuloSeccion numero="01" titulo="Reglas">
        Como habla cada cuenta. Fijan cuantas palabras admite la voz y el
        Insert-Titulo, que preambulos y formulas vetar y si esa marca exige
        prueba visible. El auditor las aplica: si no las miras antes, te las
        encuentras al final.
      </RotuloSeccion>

      <div className="surge">
        <SeccionReglas
          reglas={reglas}
          hrefNueva={enlace(territorio, "nueva-regla")}
          hrefVer={(reglaId) => enlace(territorio, "ver-regla", reglaId)}
          hrefEditar={(reglaId) => enlace(territorio, "editar-regla", reglaId)}
          hrefBorrar={(reglaId) => enlace(territorio, "borrar-regla", reglaId)}
        />
      </div>

      <RotuloSeccion numero="02" titulo="Aperturas">
        Formas de empezar, ordenadas por territorio (la intencion) y mecanismo
        (como se demuestra). Los corchetes son lo que hay que sustituir por la
        verdad del cliente: se adapta la estructura, nunca las palabras.
      </RotuloSeccion>

      <div className="surge [--retraso:0.04s]">
        <SeccionAperturas
          aperturas={aperturas}
          total={totalAperturas}
          territorioActivo={territorio}
          hrefTerritorio={(slug) => enlace(slug, undefined, undefined, verRetiradas)}
          hrefVer={(aperturaId) =>
            enlace(territorio, "ver-apertura", aperturaId, verRetiradas)
          }
          hrefEditar={(aperturaId) =>
            enlace(territorio, "editar-apertura", aperturaId, verRetiradas)
          }
          hrefRetirar={(aperturaId) =>
            enlace(territorio, "retirar-apertura", aperturaId, verRetiradas)
          }
          hrefNueva={enlace(territorio, "nueva-apertura", undefined, verRetiradas)}
          verRetiradas={verRetiradas}
          hrefRetiradas={(ver) => enlace(territorio, undefined, undefined, ver)}
        />
      </div>

      <RotuloSeccion numero="03" titulo="Referencias">
        El banco del equipo: hooks observados fuera que vale la pena estudiar,
        cada uno con la lectura de por que funciona. No es material para
        copiar, es material para entender un mecanismo y reescribirlo.
      </RotuloSeccion>

      <div className="surge [--retraso:0.08s]">
        <SeccionReferencias
          referencias={referencias}
          hrefNueva={enlace(territorio, "nueva-referencia")}
          hrefVer={(refId) => enlace(territorio, "ver-referencia", refId)}
          hrefEditar={(refId) => enlace(territorio, "editar-referencia", refId)}
          hrefBorrar={(refId) => enlace(territorio, "borrar-referencia", refId)}
        />
      </div>

      {/* =====================================================================
          01 · PANELES Y MODALES DE REGLAS
          ===================================================================== */}

      {/* Ver Regla (Detalle / Ficha de solo lectura) */}
      {(panel === "ver-regla" || panel === "ver") && reglaVer && (
        <PanelLateral
          hrefCerrar={hrefCerrar}
          kicker="Ficha de regla"
          titulo={reglaVer.etiqueta}
          descripcion="Los límites y vocabulario específico que el auditor aplica a esta cuenta o sector."
        >
          <DetalleRegla
            regla={reglaVer}
            empresas={empresas}
            hrefEditar={enlace(territorio, "editar-regla", reglaVer.id)}
            hrefCerrar={hrefCerrar}
          />
        </PanelLateral>
      )}

      {/* Crear / Editar Regla */}
      {(panel === "nueva-regla" || panel === "editar-regla" || panel === "regla") && (
        <PanelLateral
          hrefCerrar={hrefCerrar}
          kicker={reglaEditar ? "Editar regla" : "Nueva regla"}
          titulo={reglaEditar ? reglaEditar.etiqueta : "Como habla esta cuenta"}
          descripcion="Los limites que aplicara el auditor, y los terminos propios que se suman a los de la casa."
        >
          <FormularioRegla
            empresas={empresas}
            regla={reglaEditar}
            hrefCancelar={hrefCerrar}
          />
        </PanelLateral>
      )}

      {/* Borrar Regla */}
      {panel === "borrar-regla" && reglaBorrar && (
        <ModalConfirmacion
          hrefCerrar={hrefCerrar}
          kicker="Borrar regla"
          titulo={`¿Borrar la regla «${reglaBorrar.etiqueta}»?`}
          tono="aviso"
        >
          <ConfirmarDocumentacion
            caso="regla"
            id={reglaBorrar.id}
            nombre={`La regla ${reglaBorrar.etiqueta}`}
            hrefCerrar={hrefCerrar}
          />
        </ModalConfirmacion>
      )}

      {/* =====================================================================
          02 · PANELES Y MODALES DE APERTURAS
          ===================================================================== */}

      {/* Ver Apertura (Detalle / Ficha de solo lectura) */}
      {panel === "ver-apertura" && aperturaVer && (
        <PanelLateral
          hrefCerrar={hrefCerrar}
          kicker={`Apertura #${aperturaVer.numero}`}
          titulo={aperturaVer.insertTitulo || "Estructura de apertura"}
          descripcion="Plantilla, variables y pautas de ejecución para creadoras y edición."
        >
          <DetalleApertura
            apertura={aperturaVer}
            hrefEditar={enlace(territorio, "editar-apertura", aperturaVer.id)}
            hrefCerrar={hrefCerrar}
          />
        </PanelLateral>
      )}

      {/* Crear / Editar Apertura */}
      {(panel === "nueva-apertura" || panel === "editar-apertura" || panel === "apertura") && (
        <PanelLateral
          hrefCerrar={hrefCerrar}
          kicker={aperturaEditar ? `Apertura #${aperturaEditar.numero}` : "Nueva apertura"}
          titulo={aperturaEditar ? "Editar apertura" : "Nueva apertura del catalogo"}
          descripcion="Las aperturas alimentan las opciones y plantillas al escribir una ficha."
        >
          <FormularioApertura
            apertura={aperturaEditar}
            hrefCancelar={hrefCerrar}
          />
        </PanelLateral>
      )}

      {/* Retirar / Reponer Apertura */}
      {(panel === "retirar" || panel === "retirar-apertura" || panel === "reponer-apertura") &&
        aperturaRetirar && (
          <ModalConfirmacion
            hrefCerrar={hrefCerrar}
            kicker={aperturaRetirar.activa ? "Retirar apertura" : "Reponer apertura"}
            titulo={
              aperturaRetirar.activa
                ? `¿Retirar la apertura #${aperturaRetirar.numero}?`
                : `¿Reponer la apertura #${aperturaRetirar.numero}?`
            }
            tono={aperturaRetirar.activa ? "aviso" : "normal"}
          >
            <ConfirmarDocumentacion
              caso={aperturaRetirar.activa ? "retirar-apertura" : "reponer-apertura"}
              id={aperturaRetirar.id}
              nombre={`La apertura #${aperturaRetirar.numero}`}
              hrefCerrar={hrefCerrar}
            />
          </ModalConfirmacion>
        )}

      {/* =====================================================================
          03 · PANELES Y MODALES DE REFERENCIAS
          ===================================================================== */}

      {/* Ver Referencia (Detalle / Ficha de solo lectura) */}
      {panel === "ver-referencia" && referenciaVer && (
        <PanelLateral
          hrefCerrar={hrefCerrar}
          kicker="Referencia del banco"
          titulo="Lectura del equipo"
          descripcion="Por qué funciona este hook y qué mecanismo vale la pena adaptar."
        >
          <DetalleReferencia
            referencia={referenciaVer}
            hrefEditar={enlace(territorio, "editar-referencia", referenciaVer.id)}
            hrefCerrar={hrefCerrar}
          />
        </PanelLateral>
      )}

      {/* Crear / Editar Referencia */}
      {(panel === "nueva-referencia" || panel === "editar-referencia" || panel === "referencia") && (
        <PanelLateral
          hrefCerrar={hrefCerrar}
          kicker={referenciaEditar ? "Editar referencia" : "Nueva referencia"}
          titulo={referenciaEditar ? "Referencia del banco" : "Guarda lo que vale la pena adaptar"}
          descripcion="Se conserva como referencia del equipo, no como texto para copiar."
        >
          <FormularioReferencia
            referencia={referenciaEditar}
            hrefCancelar={hrefCerrar}
          />
        </PanelLateral>
      )}

      {/* Borrar Referencia */}
      {panel === "borrar-referencia" && referenciaBorrar && (
        <ModalConfirmacion
          hrefCerrar={hrefCerrar}
          kicker="Borrar referencia"
          titulo="¿Borrar esta referencia del banco?"
          tono="aviso"
        >
          <ConfirmarDocumentacion
            caso="referencia"
            id={referenciaBorrar.id}
            nombre={`La referencia «${referenciaBorrar.hablado}»`}
            hrefCerrar={hrefCerrar}
          />
        </ModalConfirmacion>
      )}
    </Wrapper>
  );
}

