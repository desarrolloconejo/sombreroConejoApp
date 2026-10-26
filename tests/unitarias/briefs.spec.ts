import { expect, test } from "@playwright/test";
import {
  avisosDeReglas,
  cambiosEntre,
  codigoValido,
  congelar,
  contarNoSe,
  erroresParaEnviar,
  formatoPor,
  formatosVigentes,
  pasoCompleto,
  pasosVisibles,
  respuestasDesdeContenido,
} from "@/lib/portal/briefs";
import { hashDelContenido } from "@/lib/portal/briefsHash";
import type { Respuestas } from "@/types";
import fixture from "../fixtures/brief-desarrollo-producto.json";

/**
 * Los briefs como funciones puras, contra el caso de prueba del paquete
 * (appFacturas/fixtures): con estas respuestas, el contenido congelado y su
 * hash tienen que ser EXACTAMENTE los esperados. Es lo que garantiza que un
 * brief enviado se pueda verificar despues.
 */

const formato = formatoPor("desarrollo-producto", 1)!;
const respuestas = fixture.entrada.respuestas as Respuestas;
const quien = fixture.entrada.solicitante.nombre;

test("el formato de producto esta publicado; el de diagnostico no", () => {
  expect(formato).not.toBeNull();
  expect(formatosVigentes().map((f) => f.clave)).toEqual(["desarrollo-producto"]);
});

test("marcar el empaque como propio oculta su paso", () => {
  const visibles = pasosVisibles(formato, respuestas).map((p) => p.id);
  expect(visibles).not.toContain("empaque");
  expect(visibles).toHaveLength(8);
  expect(avisosDeReglas(formato, respuestas)[0]).toMatch(/empaque/);

  const conAgencia = { ...respuestas, alcance: { ...(respuestas.alcance as object), disenoEmpaque: "agencia" } };
  expect(pasosVisibles(formato, conAgencia as Respuestas).map((p) => p.id)).toContain("empaque");
});

test("el contenido congelado es el del caso de prueba, pregunta a pregunta", () => {
  const contenido = congelar(formato, respuestas, quien);

  expect(contenido).toHaveLength(fixture.salidaEsperada.preguntasCongeladas);
  expect(contenido).toEqual(fixture.salidaEsperada.contenidoCongelado);
  // Lo escrito en el paso oculto no entra.
  expect(contenido.some((r) => r.clave === "q18Estilo")).toBe(false);
});

test("y su hash es exactamente el esperado", () => {
  expect(hashDelContenido(congelar(formato, respuestas, quien))).toBe(
    fixture.salidaEsperada.contenidoSha256,
  );
});

test("el caso de prueba se puede enviar; sin la confirmacion, no", () => {
  expect(erroresParaEnviar(formato, respuestas)).toEqual({});

  const sinConfirmar = erroresParaEnviar(formato, { ...respuestas, confirmacion: false });
  expect(Object.keys(sinConfirmar)).toEqual(["confirmacion"]);
});

test("faltan las obligatorias de los pasos visibles, no las del paso oculto", () => {
  const errores = erroresParaEnviar(formato, { alcance: respuestas.alcance });
  expect(errores.empresa).toBeDefined();
  expect(errores.q01Producto).toBeDefined();
  // El empaque esta oculto: su obligatoria no cuenta.
  expect(errores.q17EstadoEmpaque).toBeUndefined();
  // La matriz completa si cuenta.
  expect(erroresParaEnviar(formato, { alcance: { concepto: "agencia" } }).alcance).toBeDefined();
});

test("valida el correo y el telefono, y acepta «No lo se» donde se permite", () => {
  const errores = erroresParaEnviar(formato, {
    ...respuestas,
    responsableCorreo: "no-es-un-correo",
    responsableTelefono: "abc",
    q01Producto: "No lo sé",
  });
  expect(Object.keys(errores).sort()).toEqual(["responsableCorreo", "responsableTelefono"]);
});

test("cuenta las respuestas «No lo se», tambien las de la matriz", () => {
  // q03 y q34, y dos filas de la matriz (identidad de marca, punto de venta, publicidad = 3).
  expect(contarNoSe(formato, respuestas)).toBe(5);
});

test("las diferencias entre versiones salen por pregunta", () => {
  const v1 = congelar(formato, respuestas, quien);
  const v2 = congelar(formato, { ...respuestas, q16Precio: "Igual que la competencia." }, quien);

  expect(cambiosEntre(v1, v2)).toEqual([
    {
      clave: "q16Precio",
      pregunta: formato.pasos.flatMap((p) => p.preguntas).find((q) => q.clave === "q16Precio")?.texto,
      antes: "Un poco más caro, pero mejor.",
      despues: "Igual que la competencia.",
    },
  ]);
});

test("el codigo tiene la forma ECS-AAAAMMDD-XXXXXX", () => {
  expect(codigoValido(fixture.contexto.codigoEsperado)).toBe(true);
  expect(codigoValido("ECS-20261006-4c9e1a")).toBe(false);
  expect(codigoValido("ECS-2026106-4C9E1A")).toBe(false);
});

test("las respuestas se rearman desde lo congelado y cuentan igual", () => {
  const rearmadas = respuestasDesdeContenido(congelar(formato, respuestas, quien));
  expect(contarNoSe(formato, rearmadas)).toBe(contarNoSe(formato, respuestas));
  expect((rearmadas.alcance as Record<string, string>).naming).toBe("agencia");
});

test("un paso sin obligatorias no sale listo hasta que tiene alguna respuesta", () => {
  const opcional = formato.pasos.find((paso) => paso.preguntas.every((pregunta) => !pregunta.obligatoria))!;
  expect(opcional).toBeDefined();
  expect(pasoCompleto(opcional, {})).toBe(false);

  const primera = opcional.preguntas.find((pregunta) => pregunta.tipo === "texto_corto" || pregunta.tipo === "texto_largo")!;
  expect(pasoCompleto(opcional, { [primera.clave]: "   " })).toBe(false);
  expect(pasoCompleto(opcional, { [primera.clave]: "Cacao al 70 %" })).toBe(true);
});

test("un paso con obligatorias sale listo cuando estan todas, como antes", () => {
  const conObligatorias = formato.pasos.find((paso) => paso.preguntas.some((pregunta) => pregunta.obligatoria))!;
  expect(pasoCompleto(conObligatorias, {})).toBe(false);
  expect(pasoCompleto(conObligatorias, respuestas)).toBe(true);
});
