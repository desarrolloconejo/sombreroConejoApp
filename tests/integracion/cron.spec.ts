import { expect, test } from "@playwright/test";

/**
 * Las tareas programadas, vistas desde fuera.
 *
 * No traen sesion: lo unico que las protege es su secreto. Aqui se comprueba
 * la puerta, no la tarea: que sin el secreto nadie pasa, y que la respuesta es
 * un rechazo y no una redireccion al login.
 *
 * Lo que la tarea hace por dentro —leer la pagina, validar, guardar— se
 * prueba en tests/unitarias/tasaBcv.spec.ts y en `prueba:permisos`. Ejecutarla
 * de verdad aqui haria depender las pruebas de un servidor ajeno.
 */

test("la tarea de la tasa no responde sin su secreto", async ({ request }) => {
  const respuesta = await request.get("/api/cron/tasa", { maxRedirects: 0 });

  // 401 con el secreto configurado; 503 si el entorno no lo tiene. Nunca 200,
  // y nunca un 307 hacia el login: no es una pantalla.
  expect([401, 503]).toContain(respuesta.status());
  expect(await respuesta.json()).toEqual({ ok: false });
});

test("un secreto equivocado tampoco pasa", async ({ request }) => {
  const respuesta = await request.get("/api/cron/tasa", {
    maxRedirects: 0,
    headers: { Authorization: "Bearer este-no-es-el-secreto-de-la-aplicacion-0000" },
  });

  expect([401, 503]).toContain(respuesta.status());
});

test("tener sesion iniciada no abre la tarea", async ({ page }) => {
  // Con una cookie de sesion cualquiera —aqui, invalida— la ruta sigue
  // exigiendo su secreto y no redirige a ningun sitio.
  await page.context().addCookies([
    { name: "conejo_sesion", value: "no-es-un-token", url: "http://localhost:3100" },
  ]);

  const respuesta = await page.request.get("/api/cron/tasa", { maxRedirects: 0 });

  expect([401, 503]).toContain(respuesta.status());
});
