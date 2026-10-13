import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // La frontera servidor/cliente, hecha regla. Un componente recibe sus
    // datos por props y habla con el servidor a traves de las actions: si
    // importara un modelo o la infraestructura, el dia que ese componente sea
    // de cliente el codigo de servidor viajaria al navegador.
    files: ["src/components/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/models", "@/models/*"],
              message: "Los componentes no consultan la base: reciben props.",
            },
            {
              group: ["@/lib/db", "@/lib/jwt", "@/lib/sesion", "@/lib/password"],
              message:
                "Infraestructura de servidor: no se importa desde un componente.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Skills de terceros para el asistente y salidas de Playwright: no son
    // codigo del proyecto.
    ".claude/**",
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
