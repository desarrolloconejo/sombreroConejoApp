import type { Metadata } from "next";

import { Wrapper } from "@/components/layout/Wrapper";
import { Listado, ListadoVacio, PanelLateral } from "@/components/listado";
import { columnasSalida, DetalleCorreo, filtrosSalida } from "@/components/salida";
import { Alerta } from "@/components/ui";
import { conSesion } from "@/lib/db";
import { modoDeCorreo } from "@/lib/externos/correo";
import { leerEstadoListado } from "@/lib/parametros";
import { requerirAdmin } from "@/lib/sesion";
import { conPanel } from "@/lib/urlListado";
import * as correosModelo from "@/models/correos";
import type { EstadoCorreo } from "@/types";

/**
 * Todo lo que la aplicacion ha enviado, o habria enviado.
 *
 * Con el correo en modo simulado nadie recibe nada, y esta pantalla es lo que
 * lo hace usable: aqui se lee cada mensaje para entregarlo a mano, y se anota
 * cuando ya se hizo.
 */

export const metadata: Metadata = {
  title: "Bandeja de salida",
};

const RUTA = "/dashboard/salida";

const ORDEN_PERMITIDO = ["creadoEn"] as const;

const MIGAS = [
  { texto: "Conejo App", href: "/dashboard" },
  { texto: "Bandeja de salida" },
];

const ESTADOS: readonly EstadoCorreo[] = ["enviado", "fallido", "pendiente"];

export default async function PaginaSalida(props: PageProps<"/dashboard/salida">) {
  // El proxy ya filtra esta ruta por rol, pero la comprobacion tiene que estar
  // tambien aqui: es lo que impide el acceso si su matcher cambia.
  const admin = await requerirAdmin();

  const parametros = await props.searchParams;

  const estado = leerEstadoListado(parametros, {
    ordenPermitido: ORDEN_PERMITIDO,
    ordenPorDefecto: "creadoEn",
    direccionPorDefecto: "desc",
    filtrosPermitidos: ["estado"],
  });

  // Lo que no se reconoce se descarta: un parametro escrito a mano no llega
  // nunca a la consulta.
  const pedidos = estado.filtros.estado ?? [];
  const estados = ESTADOS.filter((valor) => pedidos.includes(valor));

  /*
   * Todo en una sola transaccion con la sesion declarada. La bandeja tiene
   * seguridad por fila: sin `conSesion` no devolveria ninguna fila, por mucho
   * que quien pregunta sea administrador.
   */
  const { pagina, correoPanel, porEntregar } = await conSesion(admin, async (tx) => ({
    pagina: await correosModelo.listar(
      {
        busqueda: estado.busqueda || undefined,
        estado: estados.length > 0 ? estados : undefined,
        porEntregar: pedidos.includes("por_entregar"),
        direccion: estado.direccion,
        pagina: estado.pagina,
        porPagina: estado.porPagina,
      },
      tx,
    ),
    correoPanel:
      estado.panel === "ver" && estado.panelId !== null
        ? await correosModelo.buscarPorId(estado.panelId, tx)
        : null,
    porEntregar: await correosModelo.contarPorEntregar(tx),
  }));

  const simulado = modoDeCorreo() === "simulado";

  return (
    <Wrapper
      migas={MIGAS}
      kicker="Sistema"
      titulo="Bandeja de salida"
      descripcion="Cada correo que la aplicacion escribe, con su texto completo. Ninguno lleva contrasenas."
    >
      {simulado && (
        <Alerta className="mb-5">
          <b className="font-semibold">El correo esta en modo simulado.</b> No se
          envia nada: los mensajes quedan aqui para entregarlos a mano.
          {porEntregar > 0 &&
            ` Hay ${porEntregar} por entregar.`}
        </Alerta>
      )}

      <Listado
        ruta={RUTA}
        estado={estado}
        columnas={columnasSalida(RUTA, estado)}
        filtros={filtrosSalida()}
        filas={pagina.filas}
        total={pagina.total}
        totalPaginas={pagina.totalPaginas}
        claveFila={(correo) => correo.id}
        titulo="Correos"
        etiquetaBusqueda="Buscar en la bandeja de salida"
        marcadorBusqueda="Buscar por destinatario, asunto o empresa"
        vacio={
          <ListadoVacio
            titulo="Todavia no se ha escrito ningun correo"
            descripcion="Al dar de alta a alguien o restablecer una contrasena, su aviso aparecera aqui."
          />
        }
        panel={
          correoPanel && (
            <PanelLateral
              hrefCerrar={conPanel(RUTA, estado, null)}
              kicker="Correo"
              titulo={correoPanel.paraNombre ?? correoPanel.para}
              descripcion="El mensaje tal como se escribio."
            >
              <DetalleCorreo correo={correoPanel} />
            </PanelLateral>
          )
        }
      />
    </Wrapper>
  );
}
