import type {
  FormatoBrief,
  PasoBrief,
  Pregunta,
  RespuestaCongelada,
  Respuestas,
  ValorRespuesta,
} from "@/types";
import desarrolloProducto from "./formatos/desarrollo-producto.v1.json" with { type: "json" };

/**
 * El criterio de los briefs, como funciones puras: que formatos hay, que
 * pasos se ven, que falta para enviar y como se congela lo enviado.
 *
 * Sin dependencias de Node: lo usan tambien el formulario en el navegador
 * (pasos visibles, contador de «No lo se») y las pruebas. El hash del
 * contenido, que si necesita Node, esta en briefsHash.ts.
 *
 * Reglas: appFacturas/docs/05-briefs.md y config/briefs/README.md.
 */

/**
 * Los formatos publicados. Diagnostico no esta: solo hay sus respuestas, no
 * el texto de sus preguntas, y no se publica hasta tenerlo (B4).
 *
 * Un formato publicado no se edita: un cambio es una version nueva, y los
 * briefs enviados se siguen leyendo con el texto que congelaron.
 */
export const FORMATOS: readonly FormatoBrief[] = [desarrolloProducto as FormatoBrief];

export function formatoPor(clave: string, version: number): FormatoBrief | null {
  return FORMATOS.find((f) => f.clave === clave && f.version === version) ?? null;
}

/** La ultima version de cada formato: la que se ofrece para un brief nuevo. */
export function formatosVigentes(): FormatoBrief[] {
  const porClave = new Map<string, FormatoBrief>();
  for (const formato of FORMATOS) {
    const actual = porClave.get(formato.clave);
    if (!actual || formato.version > actual.version) porClave.set(formato.clave, formato);
  }
  return [...porClave.values()];
}

/** Las preguntas de un formato, en orden. */
export function preguntasDe(formato: FormatoBrief): Pregunta[] {
  return formato.pasos.flatMap((paso) => paso.preguntas);
}

/** Los pasos que una regla oculta con estas respuestas. */
export function pasosOcultos(formato: FormatoBrief, respuestas: Respuestas): Set<string> {
  const ocultos = new Set<string>();

  for (const regla of formato.reglas ?? []) {
    const cumple = regla.cuando.todas.every((condicion) => {
      const valor = respuestas[condicion.pregunta];
      if (condicion.fila) {
        return (
          typeof valor === "object" &&
          valor !== null &&
          !Array.isArray(valor) &&
          (valor as Record<string, string>)[condicion.fila] === condicion.igual
        );
      }
      return valor === condicion.igual;
    });

    if (cumple) ocultos.add(regla.entonces.ocultarPaso);
  }

  return ocultos;
}

/** Los pasos que cuentan: los que no oculta ninguna regla. */
export function pasosVisibles(formato: FormatoBrief, respuestas: Respuestas): PasoBrief[] {
  const ocultos = pasosOcultos(formato, respuestas);
  return formato.pasos.filter((paso) => !ocultos.has(paso.id));
}

/** El aviso de la regla que oculta un paso, si lo hay. */
export function avisosDeReglas(formato: FormatoBrief, respuestas: Respuestas): string[] {
  const ocultos = pasosOcultos(formato, respuestas);
  return (formato.reglas ?? [])
    .filter((regla) => ocultos.has(regla.entonces.ocultarPaso) && regla.entonces.avisoAlUsuario)
    .map((regla) => regla.entonces.avisoAlUsuario as string);
}

/** Un texto vacio no es una respuesta. */
function texto(valor: ValorRespuesta | undefined): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  return limpio === "" ? null : limpio;
}

/** Si una pregunta tiene respuesta. Para la matriz: todas sus filas. */
export function respondida(pregunta: Pregunta, valor: ValorRespuesta | undefined): boolean {
  switch (pregunta.tipo) {
    case "opcion_multiple":
      return Array.isArray(valor) && valor.length > 0;
    case "confirmacion":
      return valor === true;
    case "matriz_alcance":
      return (
        typeof valor === "object" &&
        valor !== null &&
        !Array.isArray(valor) &&
        (pregunta.filas ?? []).every((fila) => Boolean((valor as Record<string, string>)[fila.clave]))
      );
    default:
      return texto(valor) !== null;
  }
}

/** Cuantas respuestas son «No lo se», en los pasos visibles. Para el contador. */
export function contarNoSe(formato: FormatoBrief, respuestas: Respuestas): number {
  let cuenta = 0;

  for (const paso of pasosVisibles(formato, respuestas)) {
    for (const pregunta of paso.preguntas) {
      const valor = respuestas[pregunta.clave];
      if (pregunta.tipo === "matriz_alcance" && typeof valor === "object" && !Array.isArray(valor)) {
        cuenta += Object.values(valor as Record<string, string>).filter((v) => v === "no_se").length;
      } else if (valor === formato.valorNoSe || valor === "no_se") {
        cuenta++;
      }
    }
  }

  return cuenta;
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEFONO = /^[+\d][\d\s().-]{5,}$/;

/**
 * Lo que falta o esta mal para poder enviar: obligatorias de los pasos
 * visibles, y el formato de correos y telefonos. Clave de pregunta -> mensaje.
 * Un «No lo se» cuenta como respuesta donde la pregunta lo permite.
 */
export function erroresParaEnviar(formato: FormatoBrief, respuestas: Respuestas): Record<string, string> {
  const errores: Record<string, string> = {};

  for (const paso of pasosVisibles(formato, respuestas)) {
    for (const pregunta of paso.preguntas) {
      const valor = respuestas[pregunta.clave];

      if (pregunta.obligatoria && !respondida(pregunta, valor)) {
        errores[pregunta.clave] =
          pregunta.tipo === "confirmacion"
            ? "Confirma que la informacion es correcta"
            : pregunta.tipo === "matriz_alcance"
              ? "Elige una opcion en cada fila"
              : "Esta pregunta es obligatoria";
        continue;
      }

      const valorTexto = texto(valor);
      if (valorTexto === null || valorTexto === formato.valorNoSe) continue;

      if (pregunta.tipo === "email" && !CORREO.test(valorTexto)) {
        errores[pregunta.clave] = "No parece un correo valido";
      }
      if (pregunta.tipo === "telefono" && !TELEFONO.test(valorTexto)) {
        errores[pregunta.clave] = "No parece un telefono valido";
      }
    }
  }

  return errores;
}

/** El texto de una opcion, o el valor si ya no esta en el formato. */
function textoDeOpcion(opciones: { valor: string; texto: string }[] | undefined, valor: string): string {
  return opciones?.find((opcion) => opcion.valor === valor)?.texto ?? valor;
}

const SIN_RESPUESTA = "Sin respuesta";

/**
 * El contenido congelado de un envio: cada pregunta de los pasos visibles,
 * con el texto exacto de su pregunta y lo que se respondio. Las respuestas de
 * un paso oculto no entran, aunque se hubieran escrito.
 *
 * `confirmadoPor` es el nombre de quien envia: la confirmacion sustituye a la
 * firma del papel.
 */
export function congelar(
  formato: FormatoBrief,
  respuestas: Respuestas,
  confirmadoPor: string,
): RespuestaCongelada[] {
  const contenido: RespuestaCongelada[] = [];

  for (const paso of pasosVisibles(formato, respuestas)) {
    for (const pregunta of paso.preguntas) {
      const valor = respuestas[pregunta.clave];
      const base = {
        paso: paso.titulo,
        numero: pregunta.numero ?? null,
        ayuda: pregunta.ayuda ?? null,
      };

      if (pregunta.tipo === "matriz_alcance") {
        const filas = typeof valor === "object" && !Array.isArray(valor) ? (valor as Record<string, string>) : {};
        for (const fila of pregunta.filas ?? []) {
          const elegido = filas[fila.clave] || null;
          contenido.push({
            ...base,
            clave: `${pregunta.clave}.${fila.clave}`,
            numero: null,
            pregunta: fila.titulo,
            ayuda: fila.descripcion ?? null,
            tipo: "matriz_alcance_fila",
            valor: elegido,
            textoMostrado: elegido ? textoDeOpcion(pregunta.columnas, elegido) : SIN_RESPUESTA,
          });
        }
        continue;
      }

      const comun = { ...base, clave: pregunta.clave, pregunta: pregunta.texto, tipo: pregunta.tipo };

      if (pregunta.tipo === "opcion_multiple") {
        const lista = Array.isArray(valor) && valor.length > 0 ? valor : null;
        contenido.push({
          ...comun,
          valor: lista,
          textoMostrado: lista
            ? lista.map((v) => textoDeOpcion(pregunta.opciones, v)).join("; ")
            : SIN_RESPUESTA,
        });
      } else if (pregunta.tipo === "confirmacion") {
        contenido.push({
          ...comun,
          valor: valor === true ? true : null,
          textoMostrado: valor === true ? `Confirmado por ${confirmadoPor}` : SIN_RESPUESTA,
        });
      } else if (pregunta.tipo === "opcion_unica") {
        const elegido = texto(valor);
        contenido.push({
          ...comun,
          valor: elegido,
          textoMostrado: elegido ? textoDeOpcion(pregunta.opciones, elegido) : SIN_RESPUESTA,
        });
      } else {
        const escrito = texto(valor);
        contenido.push({ ...comun, valor: escrito, textoMostrado: escrito ?? SIN_RESPUESTA });
      }
    }
  }

  return contenido;
}

/**
 * JSON canonico: claves ordenadas en todos los niveles, sin espacios, sin
 * escapar lo que no es ASCII, arreglos en su orden. Es lo que se resume con
 * SHA-256 (briefsHash.ts) y lo que hace el hash reproducible.
 */
export function canonico(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(",")}]`;
  if (valor !== null && typeof valor === "object") {
    const objeto = valor as Record<string, unknown>;
    return `{${Object.keys(objeto)
      .sort()
      .map((clave) => `${JSON.stringify(clave)}:${canonico(objeto[clave])}`)
      .join(",")}}`;
  }
  return JSON.stringify(valor);
}

/** Que respuestas cambiaron entre dos versiones, por clave. */
export function cambiosEntre(
  anterior: RespuestaCongelada[],
  nueva: RespuestaCongelada[],
): { clave: string; pregunta: string; antes: string; despues: string }[] {
  const previas = new Map(anterior.map((r) => [r.clave, r]));
  const actuales = new Map(nueva.map((r) => [r.clave, r]));
  const claves = [...new Set([...previas.keys(), ...actuales.keys()])];

  return claves
    .map((clave) => {
      const antes = previas.get(clave);
      const despues = actuales.get(clave);
      return {
        clave,
        pregunta: (despues ?? antes)?.pregunta ?? clave,
        antes: antes?.textoMostrado ?? "No estaba",
        despues: despues?.textoMostrado ?? "Ya no esta",
      };
    })
    .filter((cambio) => cambio.antes !== cambio.despues);
}

const PATRON_CODIGO = /^ECS-\d{8}-[0-9A-F]{6}$/;

/** Si un codigo tiene la forma ECS-AAAAMMDD-XXXXXX. La base lo vuelve a mirar. */
export function codigoValido(codigo: string): boolean {
  return PATRON_CODIGO.test(codigo);
}

/**
 * Las respuestas de una version, rearmadas desde lo congelado: lo que hace
 * falta para contar sus «No lo se» o para mirarla con las reglas del formato.
 * Las filas de la matriz («alcance.naming») vuelven a ser un objeto.
 */
export function respuestasDesdeContenido(contenido: RespuestaCongelada[]): Respuestas {
  const respuestas: Respuestas = {};

  for (const respuesta of contenido) {
    if (respuesta.valor === null) continue;
    const [clave, fila] = respuesta.clave.split(".");

    if (fila) {
      const actual = (respuestas[clave] as Record<string, string> | undefined) ?? {};
      respuestas[clave] = { ...actual, [fila]: String(respuesta.valor) };
    } else {
      respuestas[clave] = respuesta.valor;
    }
  }

  return respuestas;
}
