import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AvisoPresupuestos } from "@/components/facturacion";
import { BloqueInicio, InicioWrapper, type ElementoInicio } from "@/components/inicio";
import { AvisoRevision, TarjetaProyectoCliente } from "@/components/misProyectos";
import { conSesion } from "@/lib/db";
import { haceCuanto, hoyEnCaracas } from "@/lib/fechas";
import { aEscalado, deEscalado } from "@/lib/finanzas/calculo";
import { bolivares, dolares, numeroDe } from "@/lib/finanzas/documentos";
import { situacionTasa } from "@/lib/finanzas/programacionTasa";
import {
  RUTA_AJUSTES_FINANZAS,
  RUTA_COBRANZA,
  RUTA_FACTURACION,
  RUTA_FACTURAS,
  RUTA_PRESUPUESTOS,
  RUTA_PROFORMAS,
  rutaFactura,
  rutaPresupuesto,
  rutaProforma,
} from "@/lib/finanzas/rutas";
import { formatoPor } from "@/lib/portal/briefs";
import { nombreDeFase } from "@/lib/portal/catalogo";
import { RUTA_BRIEFS, RUTA_MIS_BRIEFS, rutaBrief, rutaMiBrief, rutaPieza, rutaProyecto } from "@/lib/portal/rutas";
import { requerirUsuario } from "@/lib/sesion";
import * as auditoria from "@/models/auditoria";
import * as briefs from "@/models/briefs";
import * as facturas from "@/models/facturas";
import * as pagos from "@/models/pagos";
import * as piezas from "@/models/piezas";
import * as presupuestos from "@/models/presupuestos";
import * as proformas from "@/models/proformas";
import * as proyectos from "@/models/proyectos";
import * as tareas from "@/models/tareas";
import * as tasas from "@/models/tasas";
import * as usuarios from "@/models/usuarios";
import { NOMBRES_DE_ACCION, NOMBRES_DE_TIPO_PAGO, type AccionAuditoria } from "@/types";

export const metadata: Metadata = {
  title: "Inicio",
};

/**
 * El saludo de la cabecera, segun la hora del servidor.
 *
 * Se calcula aqui y no en el componente porque el contrato del proyecto es que
 * la page resuelve los datos y los inyecta ya listos. Depende de la zona
 * horaria del contenedor: si algun dia se despliega fuera de la zona de la
 * agencia, se corrige con la variable TZ del servicio, no tocando este codigo.
 */
function saludoSegunLaHora(): string {
  const hora = new Date().getHours();

  if (hora < 12) return "Buenos dias";
  if (hora < 20) return "Buenas tardes";

  return "Buenas noches";
}

/** Un dia del calendario, corto («14 nov»). En UTC para no correrlo al anterior. */
const DIA = new Intl.DateTimeFormat("es-VE", { timeZone: "UTC", day: "numeric", month: "short" });
const diaDe = (fecha: string) => DIA.format(new Date(`${fecha}T00:00:00Z`));

/** Suma importes en texto sin pasar por `number`. */
function sumar(importes: string[]): string {
  return deEscalado(
    importes.reduce((suma, importe) => suma + (aEscalado(importe, 2) ?? BigInt(0)), BigInt(0)),
    2,
  );
}

const PRIMEROS = 4;

/** «1 empresa», «3 empresas». */
function cuantos(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

/**
 * El inicio: lo que le toca a quien entra, segun su rol y su cargo. Cada
 * bloque responde una pregunta («¿que tengo por decidir?») y lleva al modulo
 * donde se resuelve.
 *
 * - El ejecutivo de cuentas: briefs por decidir y proyectos con alertas.
 * - Quien tiene trabajo asignado: sus tareas y las fases a su cargo.
 * - Administracion: presupuestos, pagos por confirmar, proformas, cobranza y
 *   la tasa del dolar.
 * - El administrador: todo lo anterior y la actividad reciente.
 * - El cliente: lo que espera su revision, sus proyectos, sus briefs en curso
 *   y, si ve las finanzas, su saldo.
 *
 * Solo se consulta lo que se va a pintar.
 */
export default async function PaginaInicio() {
  const usuario = await requerirUsuario();

  const esAdmin = usuario.rol === "admin";
  const esCliente = usuario.tipo === "cliente";
  const esCuentas = esAdmin || usuario.cargoSlug === "cuentas";
  const esFinanzas = esAdmin || usuario.cargoSlug === "administracion";
  const tieneTrabajo = !esCliente && usuario.cargoSlug !== "administracion";
  const hoy = hoyEnCaracas();

  const usuariosActivos = esAdmin ? (await usuarios.listar({ activo: [true], porPagina: 1 })).total : null;

  const datos = await conSesion(usuario, async (tx) => ({
    // Equipo
    tareas: tieneTrabajo ? await tareas.asignadasA(usuario.id, { incluirListas: false }, tx) : [],
    fases: tieneTrabajo ? await piezas.fasesACargoDe(usuario.id, tx) : [],
    // Cuentas
    cuentasBandeja: esCuentas ? await briefs.cuentasBandeja(tx) : null,
    porDecidir: esCuentas
      ? (
          await briefs.bandeja(
            { grupo: "decidir", orden: "recibido", direccion: "asc", pagina: 1, porPagina: PRIMEROS },
            tx,
          )
        ).filas
      : [],
    enCurso: esCuentas || (esCliente && usuario.empresaId) ? await proyectos.enCurso(tx) : [],
    // Finanzas
    borradores: esFinanzas
      ? await presupuestos.listar(
          { situacion: ["borrador"], orden: "creadoEn", direccion: "desc", pagina: 1, porPagina: PRIMEROS },
          tx,
        )
      : null,
    aprobados: esFinanzas
      ? (
          await presupuestos.listar(
            { situacion: ["aprobado"], orden: "creadoEn", direccion: "desc", pagina: 1, porPagina: 1 },
            tx,
          )
        ).total
      : 0,
    pagosPorConfirmar: esFinanzas ? await pagos.porConfirmar(tx) : [],
    recurrentes: esFinanzas ? await proformas.recurrentesPendientes(tx) : [],
    porFacturar: esFinanzas ? await proformas.porFacturar(tx) : [],
    cobranza: esFinanzas ? await facturas.cobranza(tx) : [],
    tasa: esFinanzas ? ((await tasas.recientes("bcv", "USD", 1, tx))[0] ?? null) : null,
    lecturasTasa: esFinanzas ? await tasas.ultimasLecturas(5, tx) : [],
    // Cliente
    esperando: esCliente && usuario.empresaId ? await piezas.esperandoCliente(tx) : [],
    presupuestosPendientes: esCliente && usuario.puedeVerFinanzas ? await presupuestos.porAprobar(tx) : [],
    briefsEnCurso:
      esCliente && usuario.empresaId
        ? await briefs.listar({ estados: ["enviado", "en_validacion", "en_presupuesto"] }, tx)
        : [],
    cuenta:
      esCliente && usuario.puedeVerFinanzas && usuario.empresaId
        ? await facturas.estadoDeCuenta(usuario.empresaId, tx)
        : null,
  }));

  // La actividad la lee el administrador sin seguridad por fila: la tabla de
  // auditoria es suya.
  const actividad = esAdmin ? (await auditoria.listar({ porPagina: PRIMEROS + 1 })).filas : [];

  const bloques: ReactNode[] = [];

  // ---------------------------------------------------------------- equipo
  if (tieneTrabajo && (!esAdmin || datos.tareas.length > 0 || datos.fases.length > 0)) {
    const vencidas = datos.tareas.filter((t) => t.fechaEstimada !== null && t.fechaEstimada < hoy).length;
    const ordenadas = [...datos.tareas].sort((a, b) =>
      (a.fechaEstimada ?? "9999").localeCompare(b.fechaEstimada ?? "9999"),
    );
    bloques.push(
      <BloqueInicio
        key="tareas"
        titulo="Tus tareas"
        cifra={datos.tareas.length}
        nota={vencidas > 0 ? cuantos(vencidas, "vencida", "vencidas") : "Ninguna vencida"}
        elementos={ordenadas.slice(0, PRIMEROS + 1).map<ElementoInicio>((tarea) => ({
          clave: tarea.id,
          href: rutaPieza(tarea.proyectoId, tarea.piezaId),
          titulo: tarea.titulo,
          detalle: `${tarea.piezaTitulo} · ${tarea.proyectoNombre}`,
          marca: tarea.fechaEstimada ? diaDe(tarea.fechaEstimada) : null,
          alerta: tarea.fechaEstimada !== null && tarea.fechaEstimada < hoy,
        }))}
        vacio="No tienes tareas pendientes."
        enlace={{ href: "/dashboard/mi-trabajo", texto: "Ir a Mi trabajo" }}
      />,
      <BloqueInicio
        key="fases"
        titulo="Fases a tu cargo"
        cifra={datos.fases.length}
        nota="Las que llevas y deben salir"
        elementos={datos.fases.slice(0, PRIMEROS).map<ElementoInicio>((fase) => ({
          clave: fase.id,
          href: rutaPieza(fase.proyectoId, fase.piezaId),
          titulo: `Fase ${fase.fase} · ${nombreDeFase(fase.proyectoTipo, fase.fase)}`,
          detalle: `${fase.piezaTitulo} · ${fase.proyectoNombre}`,
          marca: fase.fechaEstimada ? diaDe(fase.fechaEstimada) : null,
          alerta: fase.fechaEstimada !== null && fase.fechaEstimada < hoy,
        }))}
        vacio="No eres responsable de ninguna fase ahora."
        enlace={{ href: "/dashboard/mi-trabajo", texto: "Ir a Mi trabajo" }}
      />,
    );
  }

  // ---------------------------------------------------------------- cuentas
  if (esCuentas && datos.cuentasBandeja) {
    const conAlertas = datos.enCurso
      .filter((p) => p.alertas.atrasada + p.alertas.esperando_cliente + p.alertas.en_correccion > 0)
      .sort((a, b) => b.alertas.atrasada - a.alertas.atrasada);
    const suma = (clave: keyof (typeof datos.enCurso)[number]["alertas"]) =>
      datos.enCurso.reduce((total, p) => total + p.alertas[clave], 0);

    bloques.push(
      <BloqueInicio
        key="briefs"
        titulo="Briefs por decidir"
        cifra={datos.cuentasBandeja.decidir}
        nota={`${datos.cuentasBandeja.curso} en curso`}
        elementos={datos.porDecidir.map<ElementoInicio>((brief) => ({
          clave: brief.id,
          href: rutaBrief(brief.id),
          titulo: brief.solicitante,
          detalle: `${formatoPor(brief.formato, brief.formatoVersion)?.nombre ?? brief.formato} · ${brief.codigo}`,
          marca: haceCuanto(brief.enviadoEn ?? brief.actualizadoEn),
        }))}
        vacio="Nada por decidir."
        enlace={{ href: RUTA_BRIEFS, texto: "Ir a Briefs" }}
      />,
      <BloqueInicio
        key="alertas"
        titulo="Piezas que piden atencion"
        cifra={suma("atrasada")}
        nota={`${suma("atrasada") === 1 ? "atrasada" : "atrasadas"} · ${cuantos(suma("esperando_cliente"), "espera", "esperan")} al cliente · ${suma("en_correccion")} en correccion`}
        elementos={conAlertas.slice(0, PRIMEROS).map<ElementoInicio>((proyecto) => ({
          clave: proyecto.id,
          href: rutaProyecto(proyecto.id),
          titulo: proyecto.nombre,
          detalle: proyecto.empresaNombre,
          marca: proyecto.alertas.atrasada > 0 ? cuantos(proyecto.alertas.atrasada, "atrasada", "atrasadas") : null,
          alerta: proyecto.alertas.atrasada > 0,
        }))}
        vacio="Ningun proyecto en curso tiene alertas."
        enlace={{ href: "/dashboard/tablero", texto: "Ir al Tablero" }}
      />,
    );
  }

  // ---------------------------------------------------------------- finanzas
  if (esFinanzas && datos.borradores) {
    const total = sumar(datos.cobranza.map((e) => e.total));
    const vencido = sumar(datos.cobranza.flatMap((e) => [e.dias0a30, e.dias31a60, e.dias61a90, e.mas90]));
    bloques.push(
      <BloqueInicio
        key="pagos"
        titulo="Pagos por confirmar"
        cifra={datos.pagosPorConfirmar.length}
        nota="No bajan el saldo hasta confirmarlos"
        elementos={datos.pagosPorConfirmar.slice(0, PRIMEROS).map<ElementoInicio>((pago) => ({
          clave: pago.id,
          href: rutaFactura(pago.facturaId),
          titulo: pago.empresaNombre,
          detalle: NOMBRES_DE_TIPO_PAGO[pago.tipo],
          marca: pago.moneda === "USD" ? dolares(pago.monto) : bolivares(pago.monto),
        }))}
        vacio="Nada por confirmar."
        enlace={{ href: RUTA_FACTURAS, texto: "Ir a Facturas" }}
      />,
      <BloqueInicio
        key="presupuestos"
        titulo="Presupuestos por enviar"
        cifra={datos.borradores.total}
        nota={`${cuantos(datos.aprobados, "aprobado", "aprobados")}: genera su proforma`}
        elementos={datos.borradores.filas.map<ElementoInicio>((presupuesto) => ({
          clave: presupuesto.id,
          href: rutaPresupuesto(presupuesto.id),
          titulo: presupuesto.titulo,
          detalle: `${numeroDe("presupuesto", presupuesto.numero)} · ${presupuesto.empresaNombre}`,
        }))}
        vacio="Ningun borrador pendiente."
        enlace={{ href: RUTA_PRESUPUESTOS, texto: "Ir a Presupuestos" }}
      />,
      <BloqueInicio
        key="proformas"
        titulo="Proformas por facturar"
        cifra={datos.porFacturar.length}
        nota={`${cuantos(datos.recurrentes.length, "recurrente", "recurrentes")} que toca preparar`}
        elementos={[...datos.recurrentes, ...datos.porFacturar].slice(0, PRIMEROS).map<ElementoInicio>((proforma) => ({
          clave: `${proforma.id}-${proforma.estado}`,
          href: rutaProforma(proforma.id),
          titulo: proforma.titulo,
          detalle: `${numeroDe("proforma", proforma.numero)} · ${proforma.empresaNombre}`,
          marca: datos.recurrentes.some((r) => r.id === proforma.id) ? "Recurrente" : dolares(proforma.total),
        }))}
        vacio="Nada por facturar."
        enlace={{ href: RUTA_PROFORMAS, texto: "Ir a Proformas" }}
      />,
      <BloqueInicio
        key="cobranza"
        titulo="Por cobrar"
        cifra={bolivares(total)}
        nota={`Vencido ${bolivares(vencido)} · ${cuantos(datos.cobranza.length, "empresa", "empresas")}`}
        elementos={datos.cobranza.slice(0, PRIMEROS).map<ElementoInicio>((empresa) => ({
          clave: empresa.empresaId,
          href: `${RUTA_FACTURAS}?empresa=${empresa.empresaId}&cobro=pendiente&cobro=parcial`,
          titulo: empresa.empresaNombre,
          marca: bolivares(empresa.total),
        }))}
        vacio="Nadie debe nada."
        enlace={{ href: RUTA_COBRANZA, texto: "Ir a Cobranza" }}
      />,
      <BloqueInicio
        key="tasa"
        titulo="Tasa del dolar"
        cifra={datos.tasa ? `Bs. ${datos.tasa.valor}` : "Sin tasa"}
        nota={`${
          datos.tasa
            ? `BCV, valor del ${diaDe(datos.tasa.fechaValor)}${datos.tasa.origen === "manual" ? " · registrada a mano" : ""}`
            : "Sin tasa no se puede facturar"
        }. ${situacionTasa(datos.lecturasTasa).titulo}`}
        vacio="Se lee sola del BCV una vez al dia."
        enlace={{ href: RUTA_AJUSTES_FINANZAS, texto: "Ir a Ajustes de finanzas" }}
      />,
    );
  }

  // ---------------------------------------------------------------- administrador
  if (esAdmin) {
    bloques.push(
      <BloqueInicio
        key="actividad"
        titulo="Actividad reciente"
        elementos={actividad.map<ElementoInicio>((linea) => ({
          clave: linea.id,
          href: `/dashboard/auditoria?panel=ver&id=${linea.id}`,
          titulo: NOMBRES_DE_ACCION[linea.accion as AccionAuditoria] ?? linea.accion,
          detalle: linea.actorNombre ?? "Sistema",
          marca: haceCuanto(linea.creadoEn),
        }))}
        vacio="Sin actividad todavia."
        enlace={{ href: "/dashboard/auditoria", texto: "Ir a Auditoria" }}
      />,
    );
  }

  // ---------------------------------------------------------------- cliente
  if (esCliente && usuario.empresaId) {
    bloques.push(
      <BloqueInicio
        key="mis-briefs"
        titulo="Tus briefs en curso"
        cifra={datos.briefsEnCurso.length}
        elementos={datos.briefsEnCurso.slice(0, PRIMEROS).map<ElementoInicio>((brief) => ({
          clave: brief.id,
          href: rutaMiBrief(brief.id),
          titulo: formatoPor(brief.formato, brief.formatoVersion)?.nombre ?? brief.formato,
          detalle: brief.codigo,
          marca: haceCuanto(brief.actualizadoEn),
        }))}
        vacio="Ningun brief en curso."
        enlace={{ href: RUTA_MIS_BRIEFS, texto: "Ir a Mis briefs" }}
      />,
    );
    if (datos.cuenta) {
      bloques.push(
        <BloqueInicio
          key="saldo"
          titulo="Tu saldo"
          cifra={bolivares(datos.cuenta.saldo)}
          nota={`Vencido ${bolivares(datos.cuenta.vencido)} · ${cuantos(datos.cuenta.pagosPorConfirmar, "pago", "pagos")} por confirmar`}
          vacio={`${cuantos(datos.cuenta.facturasAbiertas, "factura abierta", "facturas abiertas")}.`}
          enlace={{ href: RUTA_FACTURACION, texto: "Ir a Facturacion" }}
        />,
      );
    }
  }

  const destacado = (
    <>
      <AvisoPresupuestos presupuestos={datos.presupuestosPendientes} />
      <AvisoRevision piezas={datos.esperando} />
      {esCliente && datos.enCurso.length > 0 && (
        <section aria-labelledby="titulo-tus-proyectos">
          <h2 id="titulo-tus-proyectos" className="mb-3 text-[19px] font-extrabold tracking-[-0.02em]">
            Tus proyectos
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {datos.enCurso.map((proyecto) => (
              <li key={proyecto.id}>
                <TarjetaProyectoCliente proyecto={proyecto} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {bloques.length > 0 && (
        <div className="grid items-stretch gap-4 md:grid-cols-2">
          {/* Entran escalonados, en el orden en que se leen. */}
          {bloques.map((bloque, indice) => (
            <div key={indice} className="surge" style={{ ["--retraso" as string]: `${0.04 + indice * 0.03}s` }}>
              {bloque}
            </div>
          ))}
        </div>
      )}
    </>
  );

  return (
    <InicioWrapper
      usuario={usuario}
      saludo={saludoSegunLaHora()}
      usuariosActivos={usuariosActivos}
      destacado={destacado}
    />
  );
}
