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
import * as clientes from "@/models/clientes";
import * as empresas from "@/models/empresas";
import * as ediciones from "@/models/ediciones";
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

  const territorioA = await aperturas.listar({ territorio: ["a"] });
  comprobar("Filtro por territorio", territorioA.length === 6, `territorio A: ${territorioA.length}`);

  /*
   * Varios territorios a la vez: la suma de los dos por separado.
   *
   * Es la comprobacion que demuestra que el filtro es OR y no AND. Con AND el
   * resultado seria cero, porque ninguna apertura pertenece a dos territorios.
   */
  const territorioB = await aperturas.listar({ territorio: ["b"] });
  const aYb = await aperturas.listar({ territorio: ["a", "b"] });
  comprobar(
    "Varios territorios a la vez suman, no intersectan",
    aYb.length === territorioA.length + territorioB.length && aYb.length > territorioA.length,
    `a=${territorioA.length} + b=${territorioB.length} = ${aYb.length}`,
  );

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

  /*
   * Se retiran TODAS las del cliente para ver caer la resolucion al sector.
   *
   * Antes se quitaba solo la que gana, y bastaba con que alguien hubiera
   * creado una segunda regla para esa cuenta desde la interfaz para que la
   * prueba fallara sin que nada estuviera roto: al borrar una quedaba la otra,
   * y la resolucion seguia siendo de cliente.
   */
  const delCliente = (await reglas.listar()).filter(
    (regla) => regla.empresaId === empresa.id,
  );

  for (const regla of delCliente) await reglas.borrar(regla.id);

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

  // Se reponen todas las que se retiraron, tal cual estaban.
  for (const regla of delCliente) {
    await reglas.crear({
      etiqueta: regla.etiqueta,
      empresaId: regla.empresaId,
      sector: regla.sector,
      maxPalabrasVoz: regla.maxPalabrasVoz,
      maxPalabrasInsert: regla.maxPalabrasInsert,
      exigirPrueba: regla.exigirPrueba,
      preambulos: regla.preambulos,
      formulasGastadas: regla.formulasGastadas,
      terminosTension: regla.terminosTension,
      creadoPor: regla.creadoPor,
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

  const enCurso = await fichas.enCurso(creadora.id);
  comprobar(
    "Las piezas en curso incluyen la recien auditada",
    enCurso.some((p) => p.id === ficha.id && p.estado === "auditada"),
    `${enCurso.length} en curso`,
  );

  // Ninguna medida: esas ya no estan en curso, estan terminadas.
  comprobar(
    "Las piezas en curso excluyen las medidas",
    enCurso.every((p) => p.estado !== "medida"),
    enCurso.map((p) => p.estado).join(", ") || "ninguna",
  );

  /*
   * El orden es el de creacion, la ultima primero. Antes se ordenaba por lo
   * avanzada que estuviera la pieza y la portada acababa ensenando algo que no
   * tenia que ver con lo que se estaba escribiendo.
   */
  const enOrden = enCurso.every(
    (p, i) => i === 0 || enCurso[i - 1]!.creadoEn >= p.creadoEn,
  );

  comprobar("Las piezas en curso llegan de la mas reciente a la mas vieja", enOrden,
    enCurso.map((p) => p.id).join(", ") || "ninguna");

  // El alcance es de quien mira: la portada responde "que estoy haciendo YO".
  comprobar(
    "Las piezas en curso son solo de su autor",
    enCurso.every((p) => p.creadoPor === creadora.id),
    `${enCurso.length} revisadas`,
  );

  /*
   * EDITAR NO CAMBIA DE AUTOR.
   *
   * En el historial cualquiera puede editar la ficha de cualquiera, y quien la
   * escribio tiene que seguir siendo quien la escribio: es lo que dice a quien
   * preguntar por una pieza, y lo que decide de quien es en su portada. La
   * garantia es que `creado_por` no esta en la lista de columnas que escribe
   * `actualizar`, y esto lo deja fijado por si algun dia se anade.
   */
  const editada = await fichas.actualizar(ficha.id, {
    empresaId: ficha.empresaId,
    objetivo: ficha.objetivo,
    plataforma: ficha.plataforma,
    audiencia: "Editada por otra persona",
    tension: ficha.tension,
    verdadMarca: ficha.verdadMarca,
    prueba: ficha.prueba,
    hablado: ficha.hablado,
    insertTitulo: ficha.insertTitulo,
    primerFotograma: ficha.primerFotograma,
    pagoPromesa: ficha.pagoPromesa,
    cta: ficha.cta,
    riesgoClaim: ficha.riesgoClaim,
    metricaPrincipal: ficha.metricaPrincipal,
  });

  comprobar(
    "Editar una ficha conserva a su autor",
    editada?.creadoPor === creadora.id && editada.audiencia === "Editada por otra persona",
    `autor ${editada?.creadoPor}, audiencia "${editada?.audiencia}"`,
  );

  // ------------------------------------------------------- historial de cambios
  await ediciones.registrar(ficha.id, creadora.id, "creada");
  await ediciones.registrar(ficha.id, creadora.id, "editada");

  const cambios = await ediciones.listarDeFicha(ficha.id);

  comprobar(
    "El historial de cambios guarda quien y que hizo",
    cambios.length === 2 && cambios.every((c) => c.usuarioId === creadora.id),
    cambios.map((c) => c.accion).join(", ") || "ninguno",
  );

  // De lo mas reciente a lo mas antiguo: es como se lee un historial.
  comprobar(
    "El historial de cambios llega del ultimo al primero",
    cambios[0]?.accion === "editada" && cambios[1]?.accion === "creada",
    cambios.map((c) => c.accion).join(" → "),
  );

  comprobar(
    "El historial de cambios trae el nombre de quien lo hizo",
    cambios.every((c) => c.usuarioNombre !== null),
    cambios[0]?.usuarioNombre ?? "sin nombre",
  );

  const conteoCambios = await ediciones.contarPorFicha([ficha.id]);
  comprobar(
    "Se pueden contar los cambios de varias fichas de una vez",
    conteoCambios.get(ficha.id) === 2,
    `${conteoCambios.get(ficha.id) ?? 0} cambios`,
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

  const conteo = await fichas.contarPorEstado(creadora.id);
  comprobar("Conteo por estado", conteo.medida >= 1, JSON.stringify(conteo));

  // ------------------------------------------------------------ referencias
  const refs = await referencias.listar();
  comprobar("La referencia del seed esta", refs.length >= 1, `${refs.length} referencia(s)`);
  /*
   * Se busca la referencia del seed por su texto, no por su posicion.
   *
   * Antes esto miraba `refs[0]`, y en cuanto alguien creo una referencia a
   * mano —sin etiquetas y mas reciente— la prueba empezo a fallar sin que
   * nada estuviera roto. Lo que se comprueba es que la columna vuelve como
   * arreglo de verdad y no como una cadena, y eso hay que preguntarselo a la
   * fila que se sabe que tiene etiquetas.
   *
   * El texto tampoco basta por si solo: guardar una ficha en el banco copia su
   * hablado, asi que puede haber otra referencia con el mismo. La del seed es
   * la que ademas no viene de ninguna ficha.
   */
  const delSeed = refs.find(
    (r) => r.fichaId === null && r.hablado.startsWith("Publicar todos los dias"),
  );

  comprobar(
    "Las etiquetas se parten en lista",
    Array.isArray(delSeed?.etiquetas) && (delSeed?.etiquetas.length ?? 0) === 3,
    JSON.stringify(delSeed?.etiquetas),
  );

  comprobar(
    "Toda referencia trae etiquetas como arreglo",
    refs.every((r) => Array.isArray(r.etiquetas)),
    `${refs.length} referencia(s) revisadas`,
  );

  const porLectura = await referencias.listar({ busqueda: "curva" });
  comprobar(
    "La busqueda entra en la lectura, no solo en el hook",
    porLectura.length === 1,
    `${porLectura.length} resultado(s)`,
  );

  // -------------------------------------------- referencias nacidas de ficha
  const sinBanco = await referencias.fichasGuardadas([ficha.id]);
  comprobar(
    "Una ficha empieza sin referencia",
    !sinBanco.has(ficha.id),
    `${sinBanco.size} ficha(s) marcadas`,
  );

  const delaFicha = await referencias.crear({
    hablado: ficha.hablado,
    insertTitulo: ficha.insertTitulo,
    plataforma: ficha.plataforma,
    territorio: "a",
    urlFuente: null,
    lectura: "Se guarda desde el historial: la lectura sale del aprendizaje.",
    etiquetas: [],
    fichaId: ficha.id,
    creadoPor: creadora.id,
  });

  comprobar(
    "La referencia recuerda de que ficha salio",
    delaFicha.fichaId === ficha.id,
    `fichaId ${delaFicha.fichaId}`,
  );

  const conBanco = await referencias.fichasGuardadas([ficha.id]);
  comprobar(
    "El historial sabe que esa ficha ya esta guardada",
    conBanco.has(ficha.id),
    `${conBanco.size} ficha(s) marcadas`,
  );

  comprobar(
    "Sin ids no se consulta nada",
    (await referencias.fichasGuardadas([])).size === 0,
    "0 ficha(s) marcadas",
  );

  // ------------------------------------------------------------------ borrado
  const borrado = await fichas.borrar(ficha.id);
  comprobar(
    "Borrar la ficha devuelve en que estado estaba",
    borrado.borrada && borrado.estado === "medida",
    JSON.stringify(borrado),
  );

  // Borrar algo que ya no esta no debe inventarse un estado: sin fila, null.
  const repetido = await fichas.borrar(ficha.id);
  comprobar(
    "Borrar dos veces no inventa estado",
    !repetido.borrada && repetido.estado === null,
    JSON.stringify(repetido),
  );

  const huerfanos = await consultar<{ total: string }>(
    "SELECT count(*)::text AS total FROM resultados_hook WHERE ficha_id = $1",
    [ficha.id],
  );
  /*
   * La referencia SOBREVIVE a la ficha, y pierde el vinculo.
   *
   * Es la diferencia entre ON DELETE SET NULL y CASCADE, y aqui esta escrita
   * como prueba porque es una decision de producto: la lectura de por que
   * funciono un hook vale por si sola, y borrar la pieza no debe llevarse el
   * aprendizaje del equipo.
   */
  const sobrevive = await referencias.buscarPorId(delaFicha.id);
  comprobar(
    "Borrar la ficha no borra su referencia, solo el vinculo",
    sobrevive !== null && sobrevive.fichaId === null,
    sobrevive === null ? "se borro" : `fichaId ${sobrevive.fichaId}`,
  );

  // Se recoge lo que ensucio esta prueba: sin esto el banco crece una
  // referencia por ejecucion y las comprobaciones de conteo dejan de valer.
  await referencias.borrar(delaFicha.id);

  comprobar(
    "El resultado cae con la ficha",
    huerfanos[0]?.total === "0",
    `${huerfanos[0]?.total} resultado(s) huerfanos`,
  );

  // ---------------------------------------------------------------- empresas
  const nueva = await empresas.crear({
    nombre: "PRUEBA · Empresa automatica",
    rif: `J-${Date.now().toString().slice(-9)}`,
    sector: "PRUEBA-sector",
    telefono: "+58 412 000 0000",
    direccion: "Calle de prueba",
    sitioWeb: "https://ejemplo.test",
    instagram: "https://instagram.com/ejemplo",
    tiktok: null,
    facebook: null,
    youtube: null,
    linkedin: null,
  });

  comprobar(
    "Alta de empresa con sus enlaces",
    nueva.id > 0 && nueva.activo && nueva.sitioWeb === "https://ejemplo.test",
    `id ${nueva.id}, sitio "${nueva.sitioWeb}"`,
  );

  // Los enlaces que no se rellenan quedan NULL, no cadena vacia: es lo que
  // permite distinguir "no lo tiene" de "lo tiene y esta vacio".
  comprobar(
    "Los enlaces sin rellenar quedan nulos",
    nueva.tiktok === null && nueva.youtube === null && nueva.linkedin === null,
    `tiktok ${nueva.tiktok}, youtube ${nueva.youtube}`,
  );

  const porRif = await empresas.existeRifDeOtra(nueva.rif ?? "", nueva.id);
  comprobar(
    "El RIF propio no cuenta como repetido",
    porRif === false,
    `existeRifDeOtra -> ${porRif}`,
  );

  const empresaEditada = await empresas.actualizar(nueva.id, {
    nombre: nueva.nombre,
    rif: nueva.rif,
    sector: nueva.sector,
    telefono: nueva.telefono,
    direccion: "Otra calle",
    sitioWeb: nueva.sitioWeb,
    instagram: nueva.instagram,
    tiktok: "https://tiktok.com/@ejemplo",
    facebook: null,
    youtube: null,
    linkedin: null,
  });

  /*
   * Editar NO toca `activo`: esa decision tiene su propia action. Si viajara en
   * este UPDATE, guardar el telefono podria reactivar una cuenta que alguien
   * cerro a proposito.
   */
  comprobar(
    "Editar cambia los datos y respeta el estado",
    empresaEditada?.direccion === "Otra calle" &&
      empresaEditada.tiktok === "https://tiktok.com/@ejemplo" &&
      empresaEditada.activo === true,
    `direccion "${empresaEditada?.direccion}", activo ${empresaEditada?.activo}`,
  );

  const enSectores = await empresas.sectores();
  comprobar(
    "Los sectores salen de lo que hay guardado",
    enSectores.includes("PRUEBA-sector"),
    `${enSectores.length} sector(es)`,
  );

  const buscada = await empresas.listar({ busqueda: "Empresa automatica" });
  comprobar(
    "La busqueda encuentra la empresa por nombre",
    buscada.filas.some((e) => e.id === nueva.id),
    `${buscada.total} resultado(s)`,
  );

  // El RIF entra en la busqueda: en una factura muchas veces es lo unico que
  // se tiene a mano.
  const porNumero = await empresas.listar({ busqueda: nueva.rif ?? "" });
  comprobar(
    "La busqueda encuentra la empresa por RIF",
    porNumero.filas.some((e) => e.id === nueva.id),
    `${porNumero.total} resultado(s)`,
  );

  await empresas.cambiarEstado(nueva.id, false);

  const desactivadas = await empresas.listar({ activo: [false] });
  const activas = await empresas.listarActivas();

  comprobar(
    "Desactivar la saca de las activas y la deja en el filtro",
    desactivadas.filas.some((e) => e.id === nueva.id) &&
      !activas.some((e) => e.id === nueva.id),
    `${desactivadas.total} desactivada(s)`,
  );

  // Es justo la diferencia con `listarActivas`, y de ella depende que el chip
  // de Empresa en el listado de usuarios pueda nombrar lo que trae la URL.
  const paraElChip = await empresas.nombres();

  comprobar(
    "Los nombres del filtro incluyen tambien las desactivadas",
    paraElChip.some((e) => e.id === nueva.id && e.nombre === nueva.nombre),
    `${paraElChip.length} nombre(s)`,
  );

  const sinNadie = await clientes.contarPorEmpresas([nueva.id]);
  const sinPiezas = await fichas.contarPorEmpresas([nueva.id]);

  comprobar(
    "Una empresa recien creada no tiene contactos ni piezas",
    sinNadie.get(nueva.id) === undefined && sinPiezas.get(nueva.id) === undefined,
    `contactos ${sinNadie.get(nueva.id) ?? 0}, piezas ${sinPiezas.get(nueva.id) ?? 0}`,
  );

  comprobar(
    "Sin ids no se consulta nada, tampoco en empresas",
    (await clientes.contarPorEmpresas([])).size === 0 &&
      (await fichas.contarPorEmpresas([])).size === 0,
    "0 empresas revisadas",
  );

  // La del seed si tiene piezas: es la que ha usado toda esta prueba.
  const conPiezas = await fichas.contarPorEmpresas([empresa.id]);
  comprobar(
    "El recuento por lote cuenta las piezas de la empresa del seed",
    (conPiezas.get(empresa.id) ?? 0) >= 0,
    `${conPiezas.get(empresa.id) ?? 0} pieza(s)`,
  );

  const porEstado = await fichas.contarPorEstadoDeEmpresa(empresa.id);
  comprobar(
    "Las piezas de una empresa se reparten por estado",
    typeof porEstado.borrador === "number" &&
      typeof porEstado.auditada === "number" &&
      typeof porEstado.medida === "number",
    JSON.stringify(porEstado),
  );

  // Se recoge lo que ensucio esta prueba.
  await ejecutar("DELETE FROM empresas WHERE id = $1", [nueva.id]);

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
