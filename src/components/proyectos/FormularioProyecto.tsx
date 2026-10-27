"use client";

import { useActionState, useState } from "react";
import { FolderPlus, Plus, X } from "lucide-react";

import { crearProyecto } from "@/actions/proyectos";
import { useAvisoDeAccion } from "@/components/layout/useAvisoDeAccion";
import { PanelCuerpo, PanelPie, SeparadorPanel } from "@/components/listado";
import { Alerta, Boton, BotonEnlace, Campo, CampoFecha, CampoBloque, CampoFijo, claseLinea, Selector, useCampos } from "@/components/ui";
import { LARGO_NOMBRE_CORTO, proponerNombreCorto } from "@/lib/nomenclatura";
import { SERVICIOS } from "@/lib/portal/catalogo";
import {
  ESTADO_INICIAL,
  NOMBRES_DE_TIPO_PIEZA,
  type Asignacion,
  type NombreEmpresa,
  type PersonaBreve,
  type TipoPieza,
} from "@/types";

/**
 * El alta de un proyecto, dentro del panel lateral.
 *
 * Nace del catalogo: el servicio decide la plantilla de fases, que tipos de
 * pieza se ofrecen y que tareas se proponen. Un proyecto de redes se arma con
 * sus piezas aqui mismo; uno especial tiene una sola, que se crea sola.
 *
 * Quien lo lleva: si lo abre un ejecutivo, el mismo, sin selector. El
 * administrador elige: primero los ejecutivos asignados a la empresa y
 * despues los de otra cuenta. Por eso el selector se rehace al cambiar de
 * empresa.
 */

type FilaPieza = { clave: number; tipo: TipoPieza; titulo: string };

let siguienteClave = 1;

function filaNueva(tipo: TipoPieza): FilaPieza {
  return { clave: siguienteClave++, tipo, titulo: "" };
}

export function FormularioProyecto({
  empresas,
  asignaciones,
  ejecutivos,
  esAdmin,
  usuarioId,
  empresaInicial,
  hrefCancelar,
}: {
  /** Las empresas donde quien mira puede abrir proyectos. */
  empresas: NombreEmpresa[];
  /** Quien atiende a cada empresa. */
  asignaciones: Asignacion[];
  /** Todos los ejecutivos de cuentas activos. Solo los recibe el administrador. */
  ejecutivos: PersonaBreve[];
  /** El administrador elige quien lo lleva; un ejecutivo lo lleva el mismo. */
  esAdmin: boolean;
  /** Quien abre el proyecto: si es un ejecutivo, es quien lo lleva. */
  usuarioId: number;
  empresaInicial: number | null;
  hrefCancelar: string;
}) {
  const [estado, enviar, enviando] = useActionState(crearProyecto, ESTADO_INICIAL);
  useAvisoDeAccion(estado);

  const errores = estado.errores ?? {};

  const [empresaId, setEmpresaId] = useState<string>(
    empresaInicial !== null && empresas.some((e) => e.id === empresaInicial)
      ? String(empresaInicial)
      : empresas.length === 1
        ? String(empresas[0].id)
        : "",
  );
  const [servicioSlug, setServicioSlug] = useState<string>(SERVICIOS[0].slug);
  const [sugeridas, setSugeridas] = useState(true);
  const [filas, setFilas] = useState<FilaPieza[]>(() => [filaNueva("post")]);

  const { campo, fecha } = useCampos({
    nombre: "",
    descripcion: "",
    fechaInicio: "",
    fechaEstimadaCierre: "",
  });

  const servicio = SERVICIOS.find((s) => s.slug === servicioSlug) ?? SERVICIOS[0];

  // Para el administrador: primero quien atiende a la empresa elegida, despues
  // los ejecutivos de otra cuenta. La action lo vuelve a comprobar en la base.
  const asignados = new Set(
    asignaciones.filter((a) => String(a.empresaId) === empresaId).map((a) => a.usuarioId),
  );
  const opcionesEjecutivo = [
    ...ejecutivos.filter((p) => asignados.has(p.id)).map((p) => ({ valor: String(p.id), texto: p.nombre })),
    ...ejecutivos
      .filter((p) => !asignados.has(p.id))
      .map((p) => ({ valor: String(p.id), texto: p.nombre, detalle: "De otra cuenta: vera solo este proyecto" })),
  ];
  const sinEjecutivo = esAdmin && ejecutivos.length === 0;

  function cambiarFila(clave: number, cambio: Partial<FilaPieza>) {
    setFilas((actuales) =>
      actuales.map((fila) => (fila.clave === clave ? { ...fila, ...cambio } : fila)),
    );
  }

  return (
    <form action={enviar} noValidate className="flex min-h-0 flex-1 flex-col">
      <PanelCuerpo>
        <SeparadorPanel>Para quien</SeparadorPanel>

        <div className="flex flex-col gap-3.5">
          <Selector
            id="proyecto-empresa"
            nombre="empresaId"
            etiqueta="Empresa"
            marcador="Elige la empresa"
            opciones={empresas.map((e) => ({ valor: String(e.id), texto: e.nombre }))}
            valorInicial={empresaId}
            onCambio={setEmpresaId}
            error={errores.empresaId}
          />

          <Selector
            id="proyecto-servicio"
            nombre="servicio"
            etiqueta="Servicio"
            opciones={SERVICIOS.map((s) => ({
              valor: s.slug,
              texto: s.titulo,
              detalle: s.descripcion,
            }))}
            valorInicial={servicioSlug}
            onCambio={setServicioSlug}
            error={errores.servicio}
          />
        </div>

        <SeparadorPanel>El proyecto</SeparadorPanel>

        <div className="grid grid-cols-2 gap-3.5">
          <Campo
            id="proyecto-nombre"
            {...campo("nombre")}
            etiqueta="Nombre"
            placeholder={servicio.piezaUnica ? "Empaque de la linea premium" : "Parrilla de noviembre"}
            maxLength={120}
            required
            error={errores.nombre}
            className="col-span-2"
          />
          {/* El bloque PROYECTO de sus archivos: CLIENTE_PROYECTO_TIPO_AAMM_vNN. */}
          <CampoBloque
            id="proyecto-nombre-corto"
            name="nombreCorto"
            etiqueta="Nombre corto"
            origen={campo("nombre").value}
            inicial={null}
            proponer={proponerNombreCorto}
            largo={LARGO_NOMBRE_CORTO}
            ejemplo="PARRILLA-NOVIEMBRE"
            error={errores.nombreCorto}
            className="col-span-2"
          />

          <Campo
            id="proyecto-descripcion"
            {...campo("descripcion")}
            etiqueta="Descripcion"
            opcional
            maxLength={1000}
            className="col-span-2"
          />

          {esAdmin ? (
            // La clave cambia con la empresa: el selector se rehace con sus ejecutivos.
            <Selector
              key={`ejecutivo-${empresaId}`}
              id="proyecto-ejecutivo"
              nombre="ejecutivoId"
              etiqueta="Lo lleva"
              marcador={empresaId ? "Elige quien lo lleva" : "Primero elige la empresa"}
              opciones={opcionesEjecutivo}
              deshabilitado={!empresaId || sinEjecutivo}
              error={errores.ejecutivoId}
              className="col-span-2"
            />
          ) : (
            <>
              <input type="hidden" name="ejecutivoId" value={usuarioId} />
              <CampoFijo
                etiqueta="Lo lleva"
                valor="Tu"
                ayuda="Solo un administrador puede darselo a otro ejecutivo."
                className="col-span-2"
              />
            </>
          )}

          {sinEjecutivo && (
            <Alerta className="col-span-2">
              <b className="font-semibold">No hay ningun ejecutivo de cuentas activo.</b> Un
              proyecto solo lo lleva un ejecutivo de cuentas: crea uno en Usuarios.
            </Alerta>
          )}

          <CampoFecha
            id="proyecto-inicio"
            etiqueta="Inicio"
            opcional
            error={errores.fechaInicio}
            {...fecha("fechaInicio")}
          />

          <CampoFecha
            id="proyecto-cierre"
            etiqueta="Cierre estimado"
            opcional
            error={errores.fechaEstimadaCierre}
            {...fecha("fechaEstimadaCierre")}
          />
        </div>

        <SeparadorPanel>Piezas</SeparadorPanel>

        {servicio.piezaUnica ? (
          <p className="rounded-xl border border-borde bg-campo px-4 py-3.5 text-[12.5px] leading-relaxed text-suave">
            Este servicio es de una sola pieza: «{servicio.piezaUnica.titulo}». Se
            crea sola, con sus cinco fases.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {filas.map((fila, indice) => (
              <div key={fila.clave} className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-right text-[12px] font-bold text-suave tabular-nums">
                  {String(indice + 1).padStart(2, "0")}
                </span>

                <Selector
                  id={`pieza-tipo-${fila.clave}`}
                  nombre="piezaTipo"
                  etiqueta={`Tipo de la pieza ${indice + 1}`}
                  etiquetaOculta
                  className="w-[132px] shrink-0"
                  valor={fila.tipo}
                  onCambio={(valor) => cambiarFila(fila.clave, { tipo: valor as TipoPieza })}
                  opciones={servicio.tiposDePieza.map((tipo) => ({ valor: tipo, texto: NOMBRES_DE_TIPO_PIEZA[tipo] }))}
                />

                <label className="sr-only" htmlFor={`pieza-titulo-${fila.clave}`}>
                  Titulo de la pieza {indice + 1}
                </label>
                <input
                  id={`pieza-titulo-${fila.clave}`}
                  name="piezaTitulo"
                  value={fila.titulo}
                  onChange={(e) => cambiarFila(fila.clave, { titulo: e.target.value })}
                  placeholder={`${NOMBRES_DE_TIPO_PIEZA[fila.tipo]} ${indice + 1}`}
                  maxLength={120}
                  className={`${claseLinea()} min-w-0 flex-1`}
                />

                <button
                  type="button"
                  onClick={() => setFilas((actuales) => actuales.filter((f) => f.clave !== fila.clave))}
                  disabled={filas.length === 1}
                  aria-label={`Quitar la pieza ${indice + 1}`}
                  className="suave grid size-10 shrink-0 place-items-center rounded-[10px] border border-transparent text-suave hover:border-acento hover:bg-acento hover:text-acento-contraste disabled:pointer-events-none disabled:opacity-40 [&>svg]:size-4"
                >
                  <X aria-hidden="true" />
                </button>
              </div>
            ))}

            {errores.piezas && (
              <p role="alert" className="text-[11.5px] font-medium text-blackberry dark-tema:text-gold">
                {errores.piezas}
              </p>
            )}

            <div>
              <Boton
                type="button"
                variante="fantasma"
                tamano="chico"
                onClick={() =>
                  setFilas((actuales) => [
                    ...actuales,
                    filaNueva(actuales[actuales.length - 1]?.tipo ?? "post"),
                  ])
                }
              >
                <Plus aria-hidden="true" />
                Anadir pieza
              </Boton>
            </div>
          </div>
        )}

        <label className="mt-4 flex items-start gap-3 rounded-xl border border-borde px-4 py-3 text-[12.5px] leading-relaxed">
          <input
            type="checkbox"
            name="sugeridas"
            checked={sugeridas}
            onChange={(e) => setSugeridas(e.target.checked)}
            className="mt-0.5 size-[18px] shrink-0 accent-[var(--acento)]"
          />
          <span>
            <b className="font-semibold">Crear las tareas sugeridas.</b>{" "}
            <span className="text-suave">
              Cada pieza nace con las tareas habituales de su tipo, sin asignar.
              Despues se ajustan en su ficha.
            </span>
          </span>
        </label>
      </PanelCuerpo>

      <PanelPie>
        <BotonEnlace href={hrefCancelar} variante="fantasma">
          Cancelar
        </BotonEnlace>
        <Boton type="submit" disabled={enviando || sinEjecutivo}>
          <FolderPlus aria-hidden="true" />
          {enviando ? "Creando…" : "Crear proyecto"}
        </Boton>
      </PanelPie>
    </form>
  );
}
