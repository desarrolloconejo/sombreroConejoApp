"use server";

import { revalidatePath } from "next/cache";

import { ESTANDAR_INSERT, ESTANDAR_VOZ } from "@/lib/hooks/listas";
import { SLUGS_PLATAFORMA, TERRITORIOS } from "@/lib/hooks/catalogo";
import { requerirCargo } from "@/lib/sesion";
import { comoIdentificador, limpiarOpcional, limpiarTexto } from "@/lib/validaciones";
import * as aperturas from "@/models/aperturas";
import * as ediciones from "@/models/ediciones";
import * as fichas from "@/models/fichas";
import * as referencias from "@/models/referencias";
import * as reglas from "@/models/reglasHook";
import * as resultados from "@/models/resultados";
import type {
  ErroresCampo,
  EstadoFormulario,
  SlugMecanismo,
  SlugPlataforma,
  SlugTerritorio,
} from "@/types";

/**
 * Acciones de Documentacion y Metricas.
 *
 * Van aparte de actions/hooks.ts, que se ocupa del canvas y del auditor: son
 * dos superficies distintas y mezclarlas en un archivo de quinientas lineas
 * obligaria a leerlo entero para cambiar una validacion.
 */

const RUTA_MODULO = "/dashboard/hooks";

const LIMITES = {
  etiqueta: 120,
  sector: 120,
  lista: 1200,
  texto: 600,
  url: 1000,
  etiquetas: 500,
} as const;

/** Un entero dentro de un rango, o null. Lo piden los limites de una regla. */
function comoEntero(valor: unknown, minimo: number, maximo: number): number | null {
  const numero = comoIdentificador(valor);
  if (numero === null) return null;

  return numero >= minimo && numero <= maximo ? numero : null;
}

function comoTerritorio(valor: unknown): SlugTerritorio | null {
  return TERRITORIOS.find((t) => t.slug === valor)?.slug ?? null;
}

function comoPlataforma(valor: unknown): SlugPlataforma | null {
  return SLUGS_PLATAFORMA.find((p) => p === valor) ?? null;
}

/** "hola, buenas" -> ["hola", "buenas"]. Lo vacio no cuenta. */
function comoLista(valor: unknown): string[] {
  return limpiarTexto(valor, LIMITES.lista)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/* ===========================================================================
   REGLAS
   =========================================================================== */

export async function guardarRegla(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirCargo("redes");

  const errores: ErroresCampo = {};

  const etiqueta = limpiarTexto(datos.get("etiqueta"), LIMITES.etiqueta);
  const empresaId = comoIdentificador(datos.get("empresaId"));
  const sector = limpiarOpcional(datos.get("sector"), LIMITES.sector);

  // Los mismos rangos que el CHECK del esquema: si el formulario aceptara
  // algo que la base rechaza, el error saldria como fallo del servidor en
  // lugar de como un aviso junto al campo.
  const maxVoz = comoEntero(datos.get("maxPalabrasVoz"), 3, 30);
  const maxInsert = comoEntero(datos.get("maxPalabrasInsert"), 2, 16);

  if (!etiqueta) errores.etiqueta = "Ponle nombre a la regla";
  if (maxVoz === null) errores.maxPalabrasVoz = "Entre 3 y 30 palabras";
  if (maxInsert === null) errores.maxPalabrasInsert = "Entre 2 y 16 palabras";

  /*
   * O es de cliente, o es de sector. Una regla sin ninguno de los dos no la
   * alcanzaria nunca la resolucion: quedaria guardada y sin efecto, que es
   * peor que no dejar guardarla.
   */
  if (empresaId === null && !sector) {
    errores.empresaId = "Elige un cliente o escribe un sector";
  }

  if (Object.keys(errores).length > 0 || maxVoz === null || maxInsert === null) {
    return { ok: false, errores };
  }

  const campos = {
    etiqueta,
    // Una regla de cliente NO lleva sector: si llevara los dos, la resolucion
    // la encontraria por dos caminos y el orden dejaria de ser predecible.
    empresaId,
    sector: empresaId === null ? sector : null,
    maxPalabrasVoz: maxVoz,
    maxPalabrasInsert: maxInsert,
    exigirPrueba: datos.get("exigirPrueba") === "on",
    preambulos: comoLista(datos.get("preambulos")),
    formulasGastadas: comoLista(datos.get("formulasGastadas")),
    terminosTension: comoLista(datos.get("terminosTension")),
  };

  const id = comoIdentificador(datos.get("id"));

  if (id !== null) {
    const actualizada = await reglas.actualizar(id, campos);
    if (!actualizada) return { ok: false, mensaje: "Esa regla ya no existe" };
  } else {
    await reglas.crear({ ...campos, creadoPor: usuario.id });
  }

  revalidatePath(RUTA_MODULO, "layout");

  const ampliada = maxVoz > ESTANDAR_VOZ || maxInsert > ESTANDAR_INSERT;

  return {
    ok: true,
    mensaje: ampliada
      ? `Regla guardada. Supera el estandar ${ESTANDAR_VOZ}/${ESTANDAR_INSERT}, asi que la desviacion quedara visible en cada auditoria.`
      : "Regla guardada.",
  };
}

export async function borrarRegla(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  await requerirCargo("redes");

  const id = comoIdentificador(datos.get("id"));
  if (id === null) return { ok: false, mensaje: "No se pudo identificar la regla" };

  const borrada = await reglas.borrar(id);
  if (!borrada) return { ok: false, mensaje: "Esa regla ya no existe" };

  revalidatePath(RUTA_MODULO, "layout");

  return {
    ok: true,
    mensaje:
      "Regla borrada. Las cuentas que la usaban vuelven al escalon siguiente: su sector, o el estandar de la casa.",
  };
}

/* ===========================================================================
   APERTURAS
   =========================================================================== */

export async function guardarApertura(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  await requerirCargo("redes");

  const errores: ErroresCampo = {};

  const territorio = comoTerritorio(datos.get("territorio"));
  const plantilla = limpiarTexto(datos.get("plantilla"), LIMITES.texto);
  const ejemplo = limpiarTexto(datos.get("ejemplo"), LIMITES.texto);
  const insertTitulo = limpiarTexto(datos.get("insertTitulo"), LIMITES.texto);
  const direccionEdicion = limpiarTexto(datos.get("direccionEdicion"), LIMITES.texto);
  const usalaCuando = limpiarTexto(datos.get("usalaCuando"), LIMITES.texto);

  if (territorio === null) errores.territorio = "Elige el territorio";
  if (!plantilla) errores.plantilla = "Escribe la plantilla, con sus [corchetes]";
  if (!ejemplo) errores.ejemplo = "Escribe un ejemplo hablado";
  if (!insertTitulo) errores.insertTitulo = "Escribe el Insert-Titulo sugerido";
  if (!direccionEdicion) errores.direccionEdicion = "Escribe la direccion para edicion";
  if (!usalaCuando) errores.usalaCuando = "Explica cuando usarla";

  if (Object.keys(errores).length > 0 || territorio === null) {
    return { ok: false, errores };
  }

  const mecanismos = datos
    .getAll("mecanismos")
    .filter((m): m is string => typeof m === "string") as SlugMecanismo[];

  const campos = {
    territorio,
    mecanismos,
    plantilla,
    ejemplo,
    insertTitulo,
    direccionEdicion,
    usalaCuando,
  };

  const id = comoIdentificador(datos.get("id"));

  if (id !== null) {
    const actualizada = await aperturas.actualizar(id, campos);
    if (!actualizada) return { ok: false, mensaje: "Esa apertura ya no existe" };
  } else {
    await aperturas.crear(campos);
  }

  revalidatePath(RUTA_MODULO, "layout");
  return { ok: true, mensaje: "Apertura guardada." };
}

/**
 * Retira o repone una apertura.
 *
 * NO borra, y no es descuido: una apertura puede estar citada en fichas
 * antiguas, y borrarla dejaria esas piezas sin poder explicar de donde
 * salieron. Retirada deja de ofrecerse para escribir y sigue pudiendo leerse.
 */
export async function cambiarEstadoApertura(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  await requerirCargo("redes");

  const id = comoIdentificador(datos.get("id"));
  if (id === null) return { ok: false, mensaje: "No se pudo identificar la apertura" };

  const reponer = datos.get("reponer") === "si";
  const cambiada = await aperturas.cambiarEstado(id, reponer);

  if (!cambiada) return { ok: false, mensaje: "Esa apertura ya no existe" };

  revalidatePath(RUTA_MODULO, "layout");

  return {
    ok: true,
    mensaje: reponer
      ? "Apertura repuesta: vuelve a ofrecerse al escribir."
      : "Apertura retirada. Deja de ofrecerse, pero sigue pudiendo leerse en las fichas que la citan.",
  };
}

/* ===========================================================================
   REFERENCIAS
   =========================================================================== */

export async function guardarReferencia(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirCargo("redes");

  const errores: ErroresCampo = {};

  const hablado = limpiarTexto(datos.get("hablado"), LIMITES.texto);
  const lectura = limpiarTexto(datos.get("lectura"), LIMITES.texto);
  const plataforma = comoPlataforma(datos.get("plataforma"));
  const territorio = comoTerritorio(datos.get("territorio"));
  const urlFuente = limpiarOpcional(datos.get("urlFuente"), LIMITES.url);

  if (!hablado) errores.hablado = "Escribe el hook observado";

  /*
   * La lectura es obligatoria, y es LA regla de esta tabla. Una referencia
   * sin explicar por que funciona es un recorte suelto que dentro de un mes
   * no le dice nada a nadie, ni siquiera a quien la guardo.
   */
  if (!lectura) errores.lectura = "Explica por que funciona esta referencia";

  if (plataforma === null) errores.plataforma = "Elige la plataforma de origen";
  if (territorio === null) errores.territorio = "Elige el territorio";

  if (urlFuente && !/^https?:\/\/\S+$/.test(urlFuente)) {
    errores.urlFuente = "El enlace no es una URL valida";
  }

  if (Object.keys(errores).length > 0 || plataforma === null || territorio === null) {
    return { ok: false, errores };
  }

  const campos = {
    hablado,
    insertTitulo: limpiarOpcional(datos.get("insertTitulo"), LIMITES.texto),
    plataforma,
    territorio,
    urlFuente,
    lectura,
    etiquetas: comoLista(datos.get("etiquetas")),
  };

  const id = comoIdentificador(datos.get("id"));

  if (id !== null) {
    // `actualizar` no toca ficha_id a proposito: de donde salio la referencia
    // es un hecho del pasado, no un campo del formulario.
    const actualizada = await referencias.actualizar(id, campos);
    if (!actualizada) return { ok: false, mensaje: "Esa referencia ya no existe" };

    revalidatePath(RUTA_MODULO, "layout");
    return { ok: true, mensaje: "Referencia guardada." };
  }

  /*
   * De que pieza propia sale, si sale de una.
   *
   * Llega del formulario cuando se abrio desde el historial, y se comprueba
   * contra la base: es un campo que escribe el navegador. Si apunta a algo que
   * no existe se guarda igual, pero sin origen — una referencia con la lectura
   * escrita vale por si sola, y perder el trabajo por un id malo seria peor.
   */
  const fichaPedida = comoIdentificador(datos.get("fichaId"));

  const fichaId =
    fichaPedida !== null && (await fichas.buscarPorId(fichaPedida)) !== null
      ? fichaPedida
      : null;

  await referencias.crear({ ...campos, fichaId, creadoPor: usuario.id });

  revalidatePath(RUTA_MODULO, "layout");

  return {
    ok: true,
    mensaje: fichaId !== null
      ? "Referencia guardada. La pieza queda marcada en el historial."
      : "Referencia guardada.",
  };
}

export async function borrarReferencia(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  await requerirCargo("redes");

  const id = comoIdentificador(datos.get("id"));
  if (id === null) return { ok: false, mensaje: "No se pudo identificar la referencia" };

  const borrada = await referencias.borrar(id);
  if (!borrada) return { ok: false, mensaje: "Esa referencia ya no existe" };

  revalidatePath(RUTA_MODULO, "layout");
  return { ok: true, mensaje: "Referencia borrada." };
}

/* ===========================================================================
   METRICAS
   =========================================================================== */

/** Un contador: entero, nunca negativo. Un campo vacio cuenta como cero. */
function comoContador(valor: unknown): number {
  if (typeof valor !== "string" && typeof valor !== "number") return 0;

  // Se aceptan los separadores de miles con los que la gente copia y pega
  const limpio = String(valor).replace(/[.\s]/g, "").replace(",", ".");
  const numero = Number(limpio);

  return Number.isFinite(numero) && numero > 0 ? Math.trunc(numero) : 0;
}

export async function guardarResultados(
  _estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirCargo("redes");

  const fichaId = comoIdentificador(datos.get("fichaId"));

  if (fichaId === null) {
    return { ok: false, mensaje: "Elige la ficha que se esta midiendo" };
  }

  /*
   * Los numeros se registran UNA vez.
   *
   * Antes esta pantalla decia «registrar dos veces actualiza, no duplica», y
   * era cierto. Redes pide lo contrario: cuando una pieza tiene sus metricas
   * ha llegado a su ultimo estado y no la modifica nadie, porque lo que se
   * guarda es el par completo —lo que se dijo y lo que paso— y ese par es lo
   * que la cuenta aprende.
   *
   * Se comprueba contra la base y no solo en la interfaz: el modulo ya no
   * ofrece las piezas medidas, pero una action es un POST.
   */
  const ficha = await fichas.buscarPorId(fichaId);

  if (!ficha) return { ok: false, mensaje: "Esa ficha ya no existe" };

  if (ficha.estado === "medida") {
    return {
      ok: false,
      mensaje:
        "Esta pieza ya tiene sus numeros registrados: quedo cerrada y no se puede modificar.",
    };
  }

  const impresiones = comoContador(datos.get("impresiones"));
  const vistas3s = comoContador(datos.get("vistas3s"));

  /*
   * No se puede ver mas veces de las que se muestra. El CHECK del esquema lo
   * impide igualmente, pero ahi saldria como error del servidor: una tasa por
   * encima de 100 casi siempre es una cifra pegada en el campo equivocado, y
   * eso se dice junto al campo.
   */
  if (vistas3s > impresiones) {
    return {
      ok: false,
      errores: {
        vistas3s: "No puede haber mas vistas que impresiones. Revisa si se cruzaron los dos campos.",
      },
    };
  }

  const aprendizaje = limpiarOpcional(datos.get("aprendizaje"), LIMITES.texto);

  /*
   * Guardarla ademas en el banco de referencias.
   *
   * Se valida ANTES de escribir nada. Si faltara el territorio o el
   * aprendizaje despues de guardar los numeros, la pantalla diria "no se
   * guardo" habiendo guardado la mitad, que es la peor de las respuestas.
   *
   * La lectura del banco es el aprendizaje que ya se pide aqui: por que
   * funciono la pieza. Pedirlo dos veces con dos nombres seria pedir lo mismo.
   */
  const alBanco = datos.get("guardarReferencia") === "on";
  const territorio = comoTerritorio(datos.get("territorioReferencia"));

  if (alBanco) {
    const fallos: ErroresCampo = {};

    if (territorio === null) {
      fallos.territorioReferencia = "Elige el territorio de la referencia";
    }

    if (!aprendizaje) {
      fallos.aprendizaje =
        "Para guardarla como referencia hace falta explicar por que funciono";
    }

    if (Object.keys(fallos).length > 0) return { ok: false, errores: fallos };
  }

  await resultados.guardar(fichaId, {
    impresiones,
    vistas3s,
    meGusta: comoContador(datos.get("meGusta")),
    compartidos: comoContador(datos.get("compartidos")),
    clics: comoContador(datos.get("clics")),
    guardados: comoContador(datos.get("guardados")),
    aprendizaje,
  });

  // Registrar numeros mueve la ficha a `medida`, asi que cuenta como cambio y
  // se anota igual que auditarla o editarla.
  await ediciones.registrar(fichaId, usuario.id, "medida");

  /*
   * El hablado y la plataforma salen de la BASE, no del formulario: el
   * formulario de metricas no los lleva, y aunque los llevara serian datos
   * que escribe el navegador sobre una pieza que ya existe.
   *
   * `yaGuardadas` evita el duplicado por si la pieza ya estaba en el banco,
   * guardada a mano desde el historial antes de llegar aqui.
   */
  let alBancoHecho = false;

  if (alBanco && territorio !== null && aprendizaje) {
    const yaGuardadas = await referencias.fichasGuardadas([fichaId]);

    if (!yaGuardadas.has(fichaId)) {
      await referencias.crear({
        hablado: ficha.hablado,
        insertTitulo: ficha.insertTitulo,
        plataforma: ficha.plataforma,
        territorio,
        urlFuente: null,
        lectura: aprendizaje,
        etiquetas: [],
        fichaId,
        creadoPor: usuario.id,
      });

      alBancoHecho = true;
    }
  }

  revalidatePath(RUTA_MODULO, "layout");

  const tasa = impresiones > 0 ? (vistas3s * 100) / impresiones : 0;

  return {
    ok: true,
    mensaje: alBancoHecho
      ? `Resultados registrados. Hook rate ${tasa.toFixed(1)}%. La pieza queda terminada y guardada en el banco de referencias.`
      : `Resultados registrados. Hook rate ${tasa.toFixed(1)}%. La pieza queda terminada.`,
  };
}
