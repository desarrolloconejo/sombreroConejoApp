/**
 * Comprobaciones del modelo de sesiones contra la base real.
 *
 *   docker compose exec app-dev npm run prueba:sesiones
 *
 * Lo que aqui se fija es la parte que no se puede ver desde fuera: que rotar
 * un token invalide el anterior, que reutilizarlo cierre la sesion entera, y
 * que cada revocacion alcance justo a quien tiene que alcanzar.
 *
 * Lo que crea lo borra al terminar, incluso si algo falla por el camino.
 */
import { consultar, consultarUno, ejecutar, obtenerPool } from "@/lib/db";
import { generarToken, hashDeToken, describirNavegador } from "@/lib/tokens";
import * as sesiones from "@/models/sesiones";
import * as usuarios from "@/models/usuarios";

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

/** Marca de las sesiones de esta pasada, para poder recogerlas despues. */
const MARCA = "prueba-sesiones";

async function abrir(usuarioId: number, duracionSegundos = 3600) {
  const token = generarToken();
  const sesion = await sesiones.crear({
    usuarioId,
    tokenHash: hashDeToken(token),
    navegador: MARCA,
    duracionSegundos,
  });

  return { ...sesion, token };
}

async function estadoDe(id: number) {
  return consultarUno<{ revocada: boolean; motivo: string | null }>(
    `SELECT revocada_en IS NOT NULL AS revocada, motivo_revocacion AS motivo
     FROM sesiones WHERE id = $1`,
    [id],
  );
}

async function principal(): Promise<void> {
  const [persona] = await consultar<{ id: number }>(
    "SELECT id FROM usuarios WHERE lower(email) = lower($1)",
    ["redes@conejo.test"],
  );
  const [cliente] = await consultar<{ id: number; empresaId: number }>(
    `SELECT u.id, c.empresa_id AS "empresaId"
     FROM usuarios u JOIN clientes c ON c.usuario_id = u.id
     ORDER BY u.id LIMIT 1`,
  );

  if (!persona || !cliente) throw new Error("Falta el seed: ejecuta npm run seed");

  console.log("\nModelo de sesiones\n");

  // ------------------------------------------------------------------ tokens
  const uno = generarToken();
  const otro = generarToken();
  comprobar("Dos tokens no coinciden", uno !== otro, `${uno.length} caracteres`);
  comprobar(
    "El hash es estable y tiene la forma que exige la base",
    hashDeToken(uno) === hashDeToken(uno) && /^[0-9a-f]{64}$/.test(hashDeToken(uno)),
    hashDeToken(uno).slice(0, 12),
  );
  comprobar(
    "El navegador se resume en algo legible",
    describirNavegador(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    ) === "Chrome en Windows" && describirNavegador(null) === null,
    "Chrome en Windows",
  );

  // ----------------------------------------------------------------- guardia
  const viva = await abrir(persona.id);
  const conSesion = await usuarios.buscarPorIdConSesion(persona.id, viva.id);
  comprobar(
    "La guardia ve una sesion viva",
    conSesion?.sesionCaducaEn instanceof Date,
    String(conSesion?.sesionCaducaEn?.toISOString()),
  );

  const ajena = await usuarios.buscarPorIdConSesion(cliente.id, viva.id);
  comprobar(
    "La sesion de una persona no vale para otra",
    ajena !== null && ajena.sesionCaducaEn === null,
    "sesion de redes pedida para el cliente",
  );

  const caducada = await abrir(persona.id, -60);
  const conCaducada = await usuarios.buscarPorIdConSesion(persona.id, caducada.id);
  comprobar(
    "Una sesion caducada no pasa la guardia",
    conCaducada?.sesionCaducaEn === null,
    "caduco hace un minuto",
  );

  // ---------------------------------------------------------------- rotacion
  const nuevo = generarToken();
  const primera = await sesiones.rotar(hashDeToken(viva.token), hashDeToken(nuevo));
  comprobar(
    "Rotar con el token vigente devuelve la sesion y lo cambia",
    primera?.sesionId === viva.id && primera.rotada === true,
    JSON.stringify({ sesionId: primera?.sesionId, rotada: primera?.rotada }),
  );

  const carrera = await sesiones.rotar(hashDeToken(viva.token), hashDeToken(generarToken()));
  comprobar(
    "El token anterior, dentro del margen, no rota ni revoca",
    carrera?.sesionId === viva.id && carrera.rotada === false,
    JSON.stringify({ rotada: carrera?.rotada }),
  );

  const sigue = await sesiones.rotar(hashDeToken(nuevo), hashDeToken(generarToken()));
  comprobar(
    "El token nuevo sigue valiendo tras la carrera",
    sigue?.rotada === true,
    JSON.stringify({ rotada: sigue?.rotada }),
  );

  // Se envejece la rotacion para salir del margen de carrera.
  const robada = await abrir(persona.id);
  const tras = generarToken();
  await sesiones.rotar(hashDeToken(robada.token), hashDeToken(tras));
  await ejecutar(
    "UPDATE sesiones SET rotada_en = now() - interval '5 minutes' WHERE id = $1",
    [robada.id],
  );

  const reuso = await sesiones.rotar(hashDeToken(robada.token), hashDeToken(generarToken()));
  const trasReuso = await estadoDe(robada.id);
  comprobar(
    "Reutilizar un token ya rotado cierra la sesion entera",
    reuso === null && trasReuso?.revocada === true && trasReuso.motivo === "token_reutilizado",
    JSON.stringify(trasReuso),
  );

  const conElBueno = await sesiones.rotar(hashDeToken(tras), hashDeToken(generarToken()));
  comprobar(
    "Y el token bueno deja de valer tambien",
    conElBueno === null,
    "la sesion ya esta revocada",
  );

  const inventado = await sesiones.rotar(hashDeToken(generarToken()), hashDeToken(generarToken()));
  comprobar("Un token que no existe no renueva nada", inventado === null, "null");

  const conCaducado = await sesiones.rotar(
    hashDeToken(caducada.token),
    hashDeToken(generarToken()),
  );
  comprobar("Una sesion caducada no se renueva", conCaducado === null, "null");

  // -------------------------------------------------------------- revocacion
  const a = await abrir(persona.id);
  const b = await abrir(persona.id);
  const c = await abrir(persona.id);

  const cerradas = await sesiones.revocarDeUsuario(persona.id, "clave_cambiada", a.id);
  const [estadoA, estadoB, estadoC] = await Promise.all([
    estadoDe(a.id),
    estadoDe(b.id),
    estadoDe(c.id),
  ]);
  comprobar(
    "Cerrar las demas deja abierta solo la propia",
    estadoA?.revocada === false &&
      estadoB?.revocada === true &&
      estadoC?.motivo === "clave_cambiada" &&
      cerradas >= 2,
    `cerradas: ${cerradas}`,
  );

  const abiertas = await sesiones.listarAbiertas(persona.id);
  comprobar(
    "La lista de abiertas no trae revocadas ni caducadas",
    abiertas.some((s) => s.id === a.id) &&
      !abiertas.some((s) => s.id === b.id || s.id === caducada.id),
    `${abiertas.length} abiertas`,
  );

  await sesiones.revocarPorToken(hashDeToken(a.token), "salida");
  const trasSalir = await estadoDe(a.id);
  comprobar(
    "Cerrar sesion revoca por el token de renovacion",
    trasSalir?.revocada === true && trasSalir.motivo === "salida",
    JSON.stringify(trasSalir),
  );

  await sesiones.revocar(a.id, "usuario_desactivado");
  const sinPisar = await estadoDe(a.id);
  comprobar(
    "Revocar dos veces no pisa el primer motivo",
    sinPisar?.motivo === "salida",
    String(sinPisar?.motivo),
  );

  const delCliente = await abrir(cliente.id);
  const deOtro = await abrir(persona.id);
  const porEmpresa = await sesiones.revocarDeEmpresa(cliente.empresaId, "empresa_desactivada");
  const [estadoCliente, estadoOtro] = await Promise.all([
    estadoDe(delCliente.id),
    estadoDe(deOtro.id),
  ]);
  comprobar(
    "Desactivar una empresa cierra las sesiones de sus personas y solo esas",
    estadoCliente?.motivo === "empresa_desactivada" &&
      estadoOtro?.revocada === false &&
      porEmpresa >= 1,
    `cerradas: ${porEmpresa}`,
  );

  // ----------------------------------------------------------------- bloqueo
  // Se usa la cuenta del cliente y se deja como estaba al terminar.
  const correoCliente = (
    await consultarUno<{ email: string }>("SELECT email FROM usuarios WHERE id = $1", [
      cliente.id,
    ])
  )?.email;

  if (!correoCliente) throw new Error("No se encontro el correo del cliente");

  await usuarios.registrarAcceso(cliente.id);

  const fallos: boolean[] = [];
  for (let intento = 0; intento < 4; intento++) {
    fallos.push(await usuarios.registrarFallo(cliente.id, 5, 15));
  }
  const aunLibre = await usuarios.buscarPorEmailConCredenciales(correoCliente);
  comprobar(
    "Cuatro fallos no bloquean",
    fallos.every((bloqueada) => !bloqueada) && aunLibre?.bloqueado === false,
    "4 de 5",
  );

  const quinto = await usuarios.registrarFallo(cliente.id, 5, 15);
  const yaBloqueada = await usuarios.buscarPorEmailConCredenciales(correoCliente);
  comprobar(
    "El quinto bloquea la cuenta",
    quinto === true && yaBloqueada?.bloqueado === true,
    "bloqueada 15 minutos",
  );

  await ejecutar(
    "UPDATE usuarios SET bloqueado_hasta = now() - interval '1 second' WHERE id = $1",
    [cliente.id],
  );
  const vencido = await usuarios.buscarPorEmailConCredenciales(correoCliente);
  comprobar(
    "Pasado el plazo, la cuenta vuelve a admitir intentos",
    vencido?.bloqueado === false,
    "el bloqueo ya vencio",
  );

  await usuarios.registrarFallo(cliente.id, 5, 15);
  await usuarios.registrarAcceso(cliente.id);
  const [contador] = await consultar<{ intentos: number; bloqueado: boolean }>(
    `SELECT intentos_fallidos AS intentos, bloqueado_hasta IS NOT NULL AS bloqueado
     FROM usuarios WHERE id = $1`,
    [cliente.id],
  );
  comprobar(
    "Entrar bien pone el contador a cero",
    contador?.intentos === 0 && contador.bloqueado === false,
    JSON.stringify(contador),
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
    await ejecutar("DELETE FROM sesiones WHERE navegador = $1", [MARCA]).catch(() => {});
    await obtenerPool().end();
  });
