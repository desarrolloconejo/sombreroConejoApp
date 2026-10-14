import { expect, test } from "@playwright/test";
import { FASES, PLANTILLAS, SERVICIOS } from "@/lib/portal/catalogo";
import {
  alertasDePieza,
  aplicarCorreccion,
  faseActual,
  faseQueSePuedeRegresar,
  hoyEnCaracas,
  motivoParaNoCompletar,
  porcentajePieza,
  porcentajeProyecto,
  rutaDeCorreccion,
  sumarDias,
  textoDeRuta,
  rutaAjustable,
  rutaConAnadidas,
  faltaVersionEnviada,
  type EstadoDeFase,
} from "@/lib/portal/fases";
import type { NumeroFase } from "@/types";

/**
 * Las reglas de la bateria (docs/reglasBateria.md). Los ejemplos A y B son
 * los del paquete original, y son obligatorios.
 */

/** Una pieza con las primeras `completas` fases completadas. */
function piezaCon(completas: number): EstadoDeFase[] {
  return FASES.map((fase) => ({
    fase,
    estado: fase <= completas ? "completada" : fase === completas + 1 ? "en_curso" : "pendiente",
  }));
}

function activa(fases: EstadoDeFase[]) {
  return { estado: "activa" as const, fases };
}

test.describe("avance", () => {
  test("una pieza suma veinte puntos por fase completada", () => {
    expect(porcentajePieza(piezaCon(0))).toBe(0);
    expect(porcentajePieza(piezaCon(3))).toBe(60);
    expect(porcentajePieza(piezaCon(5))).toBe(100);
  });

  test("ejemplo A: 10 piezas en distintas fases dan 60 %", () => {
    const piezas = [
      ...Array.from({ length: 2 }, () => activa(piezaCon(5))),
      ...Array.from({ length: 3 }, () => activa(piezaCon(4))),
      ...Array.from({ length: 3 }, () => activa(piezaCon(2))),
      ...Array.from({ length: 2 }, () => activa(piezaCon(1))),
    ];

    expect(porcentajeProyecto(piezas)).toBe(60);
  });

  test("ejemplo B: 7 aprobadas y 3 corregidas dan 76 %", () => {
    const enFase5 = piezaCon(4);

    const piezas = [
      ...Array.from({ length: 7 }, () => activa(piezaCon(5))),
      activa(aplicarCorreccion(enFase5, rutaDeCorreccion("redes_sociales", "redaccion").reabre)),
      activa(aplicarCorreccion(enFase5, rutaDeCorreccion("redes_sociales", "diseno").reabre)),
      activa(aplicarCorreccion(enFase5, rutaDeCorreccion("redes_sociales", "ambas").reabre)),
    ];

    expect(porcentajeProyecto(piezas)).toBe(76);
  });

  test("una pieza cancelada no cuenta", () => {
    const piezas = [
      activa(piezaCon(5)),
      { estado: "cancelada" as const, fases: piezaCon(0) },
    ];

    expect(porcentajeProyecto(piezas)).toBe(100);
  });

  test("un proyecto sin piezas va en 0 %", () => {
    expect(porcentajeProyecto([])).toBe(0);
  });
});

test.describe("completar y regresar", () => {
  test("la fase actual es la primera no completada", () => {
    expect(faseActual(piezaCon(0))).toBe(1);
    expect(faseActual(piezaCon(2))).toBe(3);
    expect(faseActual(piezaCon(5))).toBeNull();
  });

  test("solo se completa la fase en curso", () => {
    expect(motivoParaNoCompletar(piezaCon(1), 2, [])).toBeNull();
    expect(motivoParaNoCompletar(piezaCon(1), 3, [])).toContain("la 2");
    expect(motivoParaNoCompletar(piezaCon(1), 1, [])).toContain("la 2");
  });

  test("la fase 5 no la completa el equipo", () => {
    expect(motivoParaNoCompletar(piezaCon(4), 5, [])).toContain("cliente");
  });

  test("una pieza aprobada no se mueve", () => {
    expect(motivoParaNoCompletar(piezaCon(5), 4, [])).toContain("aprobada");
    expect(faseQueSePuedeRegresar(piezaCon(5))).toBeNull();
  });

  test("una fase de trabajo espera a que sus tareas esten listas", () => {
    const tareas = [{ estado: "lista" as const }, { estado: "pendiente" as const }];

    expect(motivoParaNoCompletar(piezaCon(0), 1, tareas)).toContain("una tarea");
    expect(
      motivoParaNoCompletar(piezaCon(0), 1, [{ estado: "lista" }, { estado: "lista" }]),
    ).toBeNull();
  });

  test("una fase de trabajo sin tareas se completa directamente", () => {
    expect(motivoParaNoCompletar(piezaCon(2), 3, [])).toBeNull();
  });

  test("las tareas no frenan una fase de control", () => {
    expect(motivoParaNoCompletar(piezaCon(1), 2, [{ estado: "pendiente" }])).toBeNull();
  });

  test("se regresa la ultima completada", () => {
    expect(faseQueSePuedeRegresar(piezaCon(0))).toBeNull();
    expect(faseQueSePuedeRegresar(piezaCon(3))).toBe(3);
  });
});

test.describe("correccion", () => {
  const enFase5 = piezaCon(4);

  function reabiertas(fases: EstadoDeFase[]): NumeroFase[] {
    return fases.filter((fase) => fase.estado !== "completada").map((fase) => fase.fase);
  }

  test("solo redaccion reabre 1, 2, 4 y 5 y conserva la 3", () => {
    const fases = aplicarCorreccion(enFase5, rutaDeCorreccion("redes_sociales", "redaccion").reabre);

    expect(reabiertas(fases)).toEqual([1, 2, 4, 5]);
    expect(faseActual(fases)).toBe(1);
    expect(fases.filter((fase) => fase.estado === "en_curso")).toHaveLength(1);
  });

  test("solo diseno reabre 3, 4 y 5", () => {
    const fases = aplicarCorreccion(enFase5, rutaDeCorreccion("redes_sociales", "diseno").reabre);

    expect(reabiertas(fases)).toEqual([3, 4, 5]);
    expect(faseActual(fases)).toBe(3);
  });

  test("las dos reabren todas", () => {
    const fases = aplicarCorreccion(enFase5, rutaDeCorreccion("redes_sociales", "ambas").reabre);

    expect(reabiertas(fases)).toEqual([1, 2, 3, 4, 5]);
  });

  test("en un proyecto especial cualquier correccion vuelve a produccion", () => {
    for (const tipo of ["redaccion", "diseno", "ambas"] as const) {
      expect(rutaDeCorreccion("especial", tipo).reabre).toEqual([3, 4, 5]);
    }
  });

  test("toda ruta repite las fases de control por las que pasa", () => {
    for (const rutas of Object.values({
      redes: rutaDeCorreccion("redes_sociales", "redaccion"),
      diseno: rutaDeCorreccion("redes_sociales", "diseno"),
      ambas: rutaDeCorreccion("redes_sociales", "ambas"),
    })) {
      const desde = Math.min(...rutas.reabre);
      if (desde <= 2) expect(rutas.reabre).toContain(2);
      expect(rutas.reabre).toContain(4);
      expect(rutas.reabre).toContain(5);
    }
  });
});

test.describe("alertas", () => {
  const hoy = "2026-10-14";
  const base = { estado: "activa" as const, ronda: 1, faseActual: 3 as NumeroFase };

  test("por vencer: de hoy a dos dias", () => {
    expect(alertasDePieza({ ...base, fechaEstimadaActual: hoy }, hoy)).toEqual(["por_vencer"]);
    expect(alertasDePieza({ ...base, fechaEstimadaActual: "2026-10-16" }, hoy)).toEqual(["por_vencer"]);
    expect(alertasDePieza({ ...base, fechaEstimadaActual: "2026-10-17" }, hoy)).toEqual([]);
  });

  test("atrasada: la fecha ya paso", () => {
    expect(alertasDePieza({ ...base, fechaEstimadaActual: "2026-10-13" }, hoy)).toEqual(["atrasada"]);
  });

  test("esperando al cliente y en correccion", () => {
    expect(
      alertasDePieza({ ...base, faseActual: 5, ronda: 2, fechaEstimadaActual: null }, hoy),
    ).toEqual(["esperando_cliente", "en_correccion"]);
  });

  test("una pieza aprobada o cancelada no alerta", () => {
    expect(alertasDePieza({ ...base, faseActual: null, fechaEstimadaActual: "2020-01-01" }, hoy)).toEqual([]);
    expect(
      alertasDePieza({ ...base, estado: "cancelada", fechaEstimadaActual: "2020-01-01" }, hoy),
    ).toEqual([]);
  });

  test("el dia se cuenta en Caracas", () => {
    // 02:00 UTC del 15 son las 22:00 del 14 en Caracas.
    expect(hoyEnCaracas(new Date("2026-10-15T02:00:00Z"))).toBe("2026-10-14");
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
  });
});

test.describe("catalogo", () => {
  test("las dos plantillas nombran las cinco fases", () => {
    for (const plantilla of Object.values(PLANTILLAS)) {
      expect(Object.keys(plantilla)).toEqual(["1", "2", "3", "4", "5"]);
    }
  });

  test("las tareas sugeridas solo caen en las fases de trabajo", () => {
    for (const servicio of SERVICIOS) {
      for (const tipo of servicio.tiposDePieza) {
        for (const tarea of servicio.tareasSugeridas(tipo)) {
          expect([1, 3]).toContain(tarea.fase);
        }
      }
    }
  });

  test("un servicio de pieza unica ofrece ese tipo", () => {
    for (const servicio of SERVICIOS) {
      if (servicio.piezaUnica) {
        expect(servicio.tiposDePieza).toContain(servicio.piezaUnica.tipo);
        expect(servicio.tipo).toBe("especial");
      }
    }
  });
});

test.describe("revision del cliente", () => {
  test("el texto de la ruta dice a donde vuelve y que se conserva", () => {
    expect(textoDeRuta("redes_sociales", [1, 2, 4, 5])).toBe(
      "La pieza vuelve a redaccion de contenido (fase 1) y repite las fases 1, 2, 4 y 5. Se conserva lo hecho en la fase 3.",
    );
    expect(textoDeRuta("redes_sociales", [1, 2, 3, 4, 5])).toContain("No se conserva ninguna fase.");
  });

  test("la ruta se ajusta solo mientras no se complete nada de la ronda nueva", () => {
    const fases = [
      { estado: "completada" as const, rondaCompletada: 1 },
      { estado: "en_curso" as const, rondaCompletada: null },
    ];
    expect(rutaAjustable(fases, 2)).toBe(true);
    expect(rutaAjustable([...fases, { estado: "completada" as const, rondaCompletada: 2 }], 2)).toBe(false);
    expect(rutaAjustable(fases, 1)).toBe(false);
  });

  test("al ajustar solo se anaden fases, en orden", () => {
    expect(rutaConAnadidas([1, 2, 4, 5], [3])).toEqual([1, 2, 3, 4, 5]);
    expect(rutaConAnadidas([3, 4, 5], [])).toEqual([3, 4, 5]);
  });

  test("la fase 4 no se completa sin version enviada", () => {
    expect(faltaVersionEnviada(4, false)).not.toBeNull();
    expect(faltaVersionEnviada(4, true)).toBeNull();
    expect(faltaVersionEnviada(3, false)).toBeNull();
  });
});
