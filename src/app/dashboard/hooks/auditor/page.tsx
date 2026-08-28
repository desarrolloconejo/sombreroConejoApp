import type { Metadata } from "next";

import { Wrapper } from "@/components/layout/Wrapper";
import { Auditor, PanelMetricasFicha, PendientesPaso } from "@/components/hooks";
import { PanelLateral } from "@/components/listado";
import { auditar, limitesPorDefecto } from "@/lib/hooks/auditor";
import { requerirCargo } from "@/lib/sesion";
import * as empresasModelo from "@/models/empresas";
import * as fichasModelo from "@/models/fichas";
import * as referenciasModelo from "@/models/referencias";
import * as reglasModelo from "@/models/reglasHook";

/**
 * El paso 04: donde se juzga una pieza antes de producirla.
 *
 * Aqui se llega de dos formas y las dos importan:
 *
 * - Desde el canvas, al pulsar «Auditar». La ficha llega ya guardada y con su
 *   nota, y esta pantalla muestra el veredicto. Antes ese veredicto se
 *   desplegaba debajo del formulario, lo que mezclaba escribir con juzgar.
 * - A pelo, para revisar un texto suelto o mirar que hay pendiente.
 */

export const metadata: Metadata = {
  title: "Auditor de hooks",
};

const RUTA = "/dashboard/hooks/auditor";

const MIGAS = [
  { texto: "Conejo App", href: "/dashboard" },
  { texto: "Hooks", href: "/dashboard/hooks" },
  { texto: "Auditor" },
];

function comoId(valor: unknown): number | null {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

export default async function PaginaAuditor(
  props: PageProps<"/dashboard/hooks/auditor">,
) {
  await requerirCargo("redes");

  const parametros = await props.searchParams;
  const idPedida = comoId(parametros.ficha);

  const [empresas, pendientes, ficha] = await Promise.all([
    empresasModelo.listarActivas(),

    // Un borrador es, por definicion, una pieza escrita que aun no ha pasado
    // por aqui: son exactamente las que este paso tiene pendientes.
    fichasModelo.listar({
      estado: ["borrador"],
      orden: "actualizadoEn",
      direccion: "desc",
      porPagina: 50,
    }),

    idPedida !== null ? fichasModelo.buscarPorId(idPedida) : null,
  ]);

  /*
   * El veredicto se vuelve a calcular aqui, no viaja por la URL.
   *
   * El auditor es una funcion pura y determinista sobre el texto de la ficha y
   * la regla de su cliente, asi que el resultado es exactamente el mismo que
   * se calculo al guardar. Pasarlo por la URL obligaria a serializar los nueve
   * controles y dejaria una direccion que se puede alterar a mano para
   * ensenar una nota que nadie calculo.
   */
  const limites = ficha ? await reglasModelo.limitesDeEmpresa(ficha.empresaId) : null;

  const resultado = ficha
    ? auditar({
        hablado: ficha.hablado,
        insertTitulo: ficha.insertTitulo,
        prueba: ficha.prueba,
        regla: limites,
      })
    : null;

  const estandar = limitesPorDefecto();

  /*
   * Las dos direcciones de la pieza auditada, en un solo sitio.
   *
   * `hrefVuelta` es tambien el cierre del panel: cerrar el registro de
   * metricas deja al usuario mirando el veredicto de la misma ficha, que es de
   * donde salio, y no en un auditor vacio.
   */
  const hrefVuelta = ficha ? `${RUTA}?ficha=${ficha.id}` : "";
  const hrefCorregir = ficha
    ? `/dashboard/hooks/nuevo?panel=editar&id=${ficha.id}`
    : "";

  /*
   * El panel se pide por la URL como en el resto de la app, pero NO pasa por
   * la lista blanca de `parametros.ts`: esa gobierna los listados, y esta
   * pagina no es uno. Se comprueba aqui, contra el unico valor que existe.
   *
   * Va cerrado tras `resultado.aprobado` a proposito, igual que el boton que
   * lo abre: con la nota por debajo del umbral, ofrecer medir seria empujar a
   * producir algo que el propio control acaba de desaconsejar. Y como el
   * veredicto se recalcula arriba, escribir el parametro a mano tampoco abre
   * el panel de una pieza suspendida.
   */
  const abrirMetricas =
    ficha !== null &&
    resultado !== null &&
    resultado.aprobado &&
    parametros.panel === "metricas";

  // Solo se pregunta si el panel se va a abrir: fuera de el nadie usa el dato.
  const enBanco = abrirMetricas
    ? await referenciasModelo.fichasGuardadas([ficha.id])
    : new Set<number>();

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

      {/*
        EL ORDEN CAMBIA SEGUN A QUE SE VENGA.

        Llegando desde el canvas, el auditor va primero: es exactamente lo que
        uno viene a ver, y con la cola encima habria que pasar por delante de
        una lista de otras piezas para leer la nota de la propia.

        Entrando a pelo, manda la cola. Ese fue el motivo de subirla: quien
        abria esta pantalla solo veia un formulario en blanco y no llegaba a
        enterarse de que tenia borradores esperando.
      */}
      {ficha && (
        <div className="mb-5">
          <Auditor
            key={ficha.id}
            empresas={empresas}
            limiteVoz={estandar.maxPalabrasVoz}
            limiteInsert={estandar.maxPalabrasInsert}
            ficha={ficha}
            resultadoInicial={resultado}
            hrefCorregir={hrefCorregir}
            /* El panel de metricas solo se ofrece si la pieza pasa el umbral. */
            hrefMetricas={resultado?.aprobado ? `${hrefVuelta}&panel=metricas` : null}
            rutaLimpia={RUTA}
          />
        </div>
      )}

      <PendientesPaso
        fichas={pendientes.filas}
        titulo="Esperan auditoria"
        descripcion="Borradores escritos que todavia no han pasado el control. Se auditan desde el canvas, con el boton Auditar."
        accion="Auditar"
        hrefDe={(pendiente) => `/dashboard/hooks/nuevo?panel=editar&id=${pendiente.id}`}
        vacio="Ningun borrador espera auditoria. Todo lo escrito ya paso el control."
      />

      {!ficha && (
        <div className="mt-5">
          <Auditor
            key="suelto"
            empresas={empresas}
            limiteVoz={estandar.maxPalabrasVoz}
            limiteInsert={estandar.maxPalabrasInsert}
            rutaLimpia={RUTA}
          />
        </div>
      )}

      {abrirMetricas && ficha && (
        <PanelLateral
          hrefCerrar={hrefVuelta}
          kicker="05 / Metricas"
          titulo="Lo que hizo la pieza"
          descripcion="Solo esta ficha. Registrar dos veces actualiza, no duplica."
        >
          <PanelMetricasFicha
            ficha={ficha}
            yaEnBanco={enBanco.has(ficha.id)}
            hrefCorregir={hrefCorregir}
            hrefCerrar={hrefVuelta}
          />
        </PanelLateral>
      )}
    </Wrapper>
  );
}
