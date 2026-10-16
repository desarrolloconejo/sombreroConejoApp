import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const SIN_SELECT = {
  selector: "JSXOpeningElement[name.name='select']",
  message: "Nada de <select> nativo: usa Selector de @/components/ui.",
};
const SIN_FECHA = {
  selector: "JSXAttribute[name.name='type'][value.value='date']",
  message: "Nada de fecha nativa: usa CampoFecha de @/components/ui.",
};
const SIN_ARCHIVO = {
  selector: "JSXAttribute[name.name='type'][value.value='file']",
  message: "Nada de archivo nativo: usa CampoArchivo de @/components/ui.",
};

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
  {
    // La lista de un <select>, el calendario de un <input type="date"> y el
    // boton de un <input type="file"> los pinta el sistema operativo, con sus
    // colores e idioma y no con los del tema.
    files: ["src/**/*.tsx"],
    rules: {
      "no-restricted-syntax": ["error", SIN_SELECT, SIN_FECHA, SIN_ARCHIVO],
    },
  },
  {
    // CampoArchivo envuelve el input real. La foto de perfil esta apagada
    // hasta la mudanza al VPS: su codigo se conserva tal cual.
    files: ["src/components/ui/CampoArchivo.tsx", "src/components/perfil/TarjetaFoto.tsx"],
    rules: {
      "no-restricted-syntax": ["error", SIN_SELECT, SIN_FECHA],
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
