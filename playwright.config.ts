import { defineConfig, devices } from "@playwright/test";

/**
 * Dos baterias, y se ejecutan en el HOST, no en el contenedor: la imagen de
 * desarrollo es Alpine y los navegadores de Playwright no corren sobre musl.
 *
 *   unitarias    funciones puras. No abren navegador ni tocan la base, asi que
 *                no necesitan que la aplicacion este levantada
 *   integracion  recorren la aplicacion real en un navegador. Necesitan
 *                `docker compose up -d` y la base sembrada
 *
 * La direccion sale de APP_URL, o del puerto que publica docker compose.
 */
const URL_APP =
  process.env.APP_URL ?? `http://localhost:${process.env.APP_PORT ?? "3100"}`;

export default defineConfig({
  testDir: "tests",
  outputDir: "test-results",
  reporter: [["list"]],

  // Un `test.only` olvidado dejaria la bateria en verde ejecutando una sola
  // prueba. En CI se convierte en error.
  forbidOnly: Boolean(process.env.CI),

  projects: [
    {
      name: "unitarias",
      testDir: "tests/unitarias",
    },
    {
      name: "integracion",
      testDir: "tests/integracion",

      // El servidor de desarrollo compila cada ruta la primera vez que se
      // pide, y con webpack por sondeo eso puede pasar del minuto.
      timeout: 180_000,

      // Esa primera compilacion puede dejar un formulario sin hidratar cuando la
      // prueba ya esta escribiendo en el. Un reintento lo absorbe; un fallo de
      // verdad falla las dos veces.
      retries: 1,

      use: {
        ...devices["Desktop Chrome"],
        baseURL: URL_APP,
        navigationTimeout: 150_000,
        trace: "retain-on-failure",
      },
    },
  ],
});
