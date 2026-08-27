/**
 * Comprobaciones de los modelos del modulo de hooks contra la base real.
 *
 *   docker compose exec app-dev npm run prueba:modelos
 *
 * No es un test unitario: es una pasada end-to-end sobre datos de verdad, que
 * es donde salen los problemas que el typecheck no ve — un alias mal escrito,
 * un JOIN que pierde filas, un UPSERT que duplica.
 *
 * Lo que crea lo borra al terminar, incluso si algo falla por el camino.
 */
import { consultar, ejecutar, obtenerPool } from "@/lib/db";
import * as aperturas from "@/models/aperturas";
import * as fichas from "@/models/fichas";
import * as referencias from "@/models/referencias";
import * as reglas from "@/models/reglasHook";
import * as resultados from "@/models/resultados";

let pasan = 0;
const fallan: string[] = [];

function comprobar(nombre: string, ok: boolean, detalle: string): void {
  if (ok) {
    pasan++;
    console.log(`  OK    ${nombre}  ->  ${detalle}`);
  } else {
    fallan.push(nombre);
    console.log(`  FALLA ${nombre}  ->  ${detalle}`);
  }
}

async function principal(): Promise<void> {
  const [empresa] = await consultar<{ id: number; sector: string | null }>(
    "SELECT id, sector FROM empresas ORDER BY id LIMIT 1",
  );
  const [creadora] = await consultar<{ id: number }>(
    "SELECT id FROM usuarios WHERE lower(email) = lower($1)",
    ["redes@conejo.test"],
  );

  if (!empresa || !creadora) throw new Error("Falta el seed: ejecuta npm run seed");

  console.log(`\nModelos de hooks — empresa ${empresa.id} (${empresa.sector})\n`);

  // ---------------------------------------------------------------- aperturas
  const todas = await aperturas.listar();
  comprobar("Las 42 aperturas estan sembradas", todas.length === 42, `${todas.length} activas`);

  const territorioA = await aperturas.listar({ territorio: "a" });
  comprobar("Filtro por territorio", territorioA.length === 6, `territorio A: ${territorioA.length}`);

  const porMecanismo = await aperturas.listar({ mecanismo: "comparacion" });
  comprobar(
    "Filtro por mecanismo usa contencion de arrays",
    porMecanismo.length > 0 && porMecanismo.every((a) => a.mecanismos.includes("comparacion")),
    `comparacion: ${porMecanismo.length}`,
  );

  const buscadas = await aperturas.listar({ busqueda: "levadura" });
  comprobar(
    "Busqueda entra tambien en el ejemplo",
    buscadas.length === 1 && buscadas[0]?.numero === 38,
    buscadas.map((a) => a.numero).join(", ") || "ninguna",
  );

  // ------------------------------------------------------------------ reglas
  const resuelta = await reglas.resolverParaEmpresa(empresa.id);
  comprobar(
    "La regla del CLIENTE gana sobre la del sector",
    resuelta?.empresaId === empresa.id,
    resuelta ? `${resuelta.etiqueta} (empresaId ${resuelta.empresaId})` : "ninguna",
  );

  // Se retira la del cliente para ver caer la resolucion al sector
  const guardada = resuelta;
  if (guardada) await reglas.borrar(guardada.id);

  const porSector = await reglas.resolverParaEmpresa(empresa.id);
  comprobar(
    "Sin regla de cliente cae a la del SECTOR",
    porSector?.sector === empresa.sector && porSector?.empresaId === null,
    porSector ? `${porSector.etiqueta} (sector ${porSector.sector})` : "ninguna",
  );

  const limites = await reglas.limitesDeEmpresa(empresa.id);
  comprobar(
    "Los limites del sector llegan ampliados",
    limites?.maxPalabrasVoz === 16 && limites.maxPalabrasInsert === 8,
    limites ? `voz ${limites.maxPalabrasVoz}, insert ${limites.maxPalabrasInsert}` : "ninguno",
  );

  // Se repone la que se retiro
  if (guardada) {
    await reglas.crear({
      etiqueta: guardada.etiqueta,
      empresaId: guardada.empresaId,
      sector: guardada.sector,
      maxPalabrasVoz: guardada.maxPalabrasVoz,
      maxPalabrasInsert: guardada.maxPalabrasInsert,
      exigirPrueba: guardada.exigirPrueba,
      preambulos: guardada.preambulos,
      formulasGastadas: guardada.formulasGastadas,
      terminosTension: guardada.terminosTension,
      creadoPor: guardada.creadoPor,
    });
  }

  const repuesta = await reglas.resolverParaEmpresa(empresa.id);
  comprobar(
    "La regla de cliente vuelve a ganar tras reponerla",
    repuesta?.empresaId === empresa.id,
    repuesta?.etiqueta ?? "ninguna",
  );

  // ------------------------------------------------------------------ fichas
  const ficha = await fichas.crear(
    {
      empresaId: empresa.id,
      objetivo: "guardados",
      plataforma: "reels",
      audiencia: "Prueba automatica",
      tension: null,
      verdadMarca: "Se persiste, al contrario que en la herramienta original",
      prueba: "Dos etiquetas en macro",
      hablado: "Tu cafe no es el grano: son los 2 minutos finales",
      insertTitulo: "No es el grano",
      primerFotograma: null,
      pagoPromesa: "Segundo 3",
      cta: null,
      riesgoClaim: null,
      metricaPrincipal: "Guardados por alcance",
    },
    creadora.id,
  );

  comprobar("Alta de ficha", ficha.id > 0 && ficha.estado === "borrador", `id ${ficha.id}, ${ficha.estado}`);
  comprobar(
    "Se persisten los tres campos que el original tiraba",
    ficha.verdadMarca !== null && ficha.pagoPromesa !== null,
    `verdad "${ficha.verdadMarca?.slice(0, 24)}...", pago "${ficha.pagoPromesa}"`,
  );
  comprobar("El JOIN trae el nombre de la empresa", ficha.empresaNombre !== null, ficha.empresaNombre ?? "null");

  await fichas.guardarNota(ficha.id, 88);
  const auditada = await fichas.buscarPorId(ficha.id);
  comprobar(
    "Guardar la nota sube el estado a auditada",
    auditada?.notaAuditor === 88 && auditada.estado === "auditada",
    `nota ${auditada?.notaAuditor}, ${auditada?.estado}`,
  );

  const enCurso = await fichas.enCurso();
  comprobar(
    "La pieza en curso prefiere la que espera numeros",
    enCurso?.id === ficha.id && enCurso.estado === "auditada",
    enCurso ? `id ${enCurso.id} (${enCurso.estado})` : "ninguna",
  );

  // -------------------------------------------------------------- resultados
  await resultados.guardar(ficha.id, {
    impresiones: 12480,
    vistas3s: 3994,
    meGusta: 980,
    compartidos: 148,
    clics: 0,
    guardados: 612,
    aprendizaje: "Primera pasada",
  });

  const medida = await fichas.buscarConResultado(ficha.id);
  comprobar(
    "Guardar resultados deja la ficha medida",
    medida?.estado === "medida",
    medida?.estado ?? "null",
  );
  comprobar(
    "El hook rate se calcula en SQL",
    medida?.hookRate === 32,
    `${medida?.hookRate}%`,
  );
  comprobar(
    "El resultado viaja como objeto, no como columnas sueltas",
    medida?.resultado?.guardados === 612,
    `guardados ${medida?.resultado?.guardados}`,
  );

  /*
   * Cada metrica en SU columna.
   *
   * No es una comprobacion de adorno. El formulario rotulaba el campo de
   * `guardados` con la metrica del objetivo de la ficha, asi que con objetivo
   * "compartidos" ponia "Compartidos" y escribia en `guardados`: habia datos
   * en la columna equivocada. Los cuatro valores de la prueba son distintos a
   * proposito, para que un cruce se vea.
   */
  comprobar(
    "Cada metrica cae en su columna",
    medida?.resultado?.meGusta === 980 &&
      medida?.resultado?.compartidos === 148 &&
      medida?.resultado?.guardados === 612,
    `me gusta ${medida?.resultado?.meGusta}, compartidos ${medida?.resultado?.compartidos}, guardados ${medida?.resultado?.guardados}`,
  );

  // El caso que justifica el UNIQUE sobre ficha_id
  await resultados.guardar(ficha.id, {
    impresiones: 13000,
    vistas3s: 4100,
    meGusta: 1010,
    compartidos: 150,
    clics: 2,
    guardados: 640,
    aprendizaje: "Segunda pasada, corrigiendo cifras",
  });

  const [cuantos] = await consultar<{ total: string }>(
    "SELECT count(*)::text AS total FROM resultados_hook WHERE ficha_id = $1",
    [ficha.id],
  );
  const relei = await resultados.buscarPorFicha(ficha.id);
  comprobar(
    "Registrar dos veces ACTUALIZA, no duplica",
    cuantos?.total === "1" && relei?.impresiones === 13000,
    `${cuantos?.total} fila(s), impresiones ${relei?.impresiones}`,
  );

  const conteo = await fichas.contarPorEstado();
  comprobar("Conteo por estado", conteo.medida >= 1, JSON.stringify(conteo));

  // ------------------------------------------------------------ referencias
  const refs = await referencias.listar();
  comprobar("La referencia del seed esta", refs.length >= 1, `${refs.length} referencia(s)`);
  comprobar(
    "Las etiquetas se parten en lista",
    Array.isArray(refs[0]?.etiquetas) && (refs[0]?.etiquetas.length ?? 0) === 3,
    JSON.stringify(refs[0]?.etiquetas),
  );

  const porLectura = await referencias.listar({ busqueda: "curva" });
  comprobar(
    "La busqueda entra en la lectura, no solo en el hook",
    porLectura.length === 1,
    `${porLectura.length} resultado(s)`,
  );

  // ------------------------------------------------------------------ borrado
  const borrado = await fichas.borrar(ficha.id);
  comprobar(
    "Borrar la ficha dice si estaba medida",
    borrado.borrada && borrado.estabaMedida,
    JSON.stringify(borrado),
  );

  const huerfanos = await consultar<{ total: string }>(
    "SELECT count(*)::text AS total FROM resultados_hook WHERE ficha_id = $1",
    [ficha.id],
  );
  comprobar(
    "El resultado cae con la ficha",
    huerfanos[0]?.total === "0",
    `${huerfanos[0]?.total} resultado(s) huerfanos`,
  );

  console.log(`\n${pasan}/${pasan + fallan.length} comprobaciones correctas`);
  if (fallan.length > 0) {
    console.error(`\nFallan: ${fallan.join(", ")}`);
    process.exitCode = 1;
  }
}

principal()
  .catch((error: unknown) => {
    console.error("\nFallo:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Por si algun caso dejo una ficha de prueba a medias
    await ejecutar("DELETE FROM fichas_hook WHERE audiencia = $1", [
      "Prueba automatica",
    ]);
    await obtenerPool().end();
  });
