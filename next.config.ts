import type { NextConfig } from "next";

/**
 * Cabeceras que no cambian de una peticion a otra.
 *
 * La politica de contenido NO esta aqui: lleva un nonce distinto en cada
 * peticion y por eso la pone `src/proxy.ts`.
 */
const CABECERAS_DE_SEGURIDAD = [
  // Nadie puede incrustar la aplicacion en un marco. `frame-ancestors` de la
  // politica de contenido dice lo mismo; esta cubre a los navegadores viejos.
  { key: "X-Frame-Options", value: "DENY" },

  // El navegador no adivina el tipo de un archivo: se fia del que se declara.
  { key: "X-Content-Type-Options", value: "nosniff" },

  // Hacia otro sitio solo viaja el origen, nunca la ruta: una ruta del panel
  // puede llevar el nombre de un cliente.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  // La aplicacion no usa camara, microfono ni ubicacion.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },

  // Solo por HTTPS durante dos anos. El navegador la ignora si la pagina llego
  // por http, asi que en desarrollo no molesta.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  // Fija la raiz del proyecto: sin esto Turbopack sube por el arbol buscando
  // lockfiles y puede tomar una carpeta ajena como raiz del workspace.
  turbopack: {
    root: import.meta.dirname,
  },

  // No hay por que anunciar con que esta hecha la aplicacion.
  poweredByHeader: false,

  // `next dev` no escribe su bloque de instrucciones en AGENTS.md: lo que
  // dice (leer la documentacion local de Next 16) ya esta en el propio
  // AGENTS.md, con el resto de herramientas del asistente.
  agentRules: false,

  experimental: {
    serverActions: {
      // Una version de una pieza llega en una Server Action: 4 MB de archivo
      // (lo que cabe en una peticion de Vercel) mas el resto del formulario.
      // Lo que pase de 4 MB lo rechaza la action; los videos van por enlace.
      bodySizeLimit: "5mb",
    },
  },

  async headers() {
    return [{ source: "/:path*", headers: CABECERAS_DE_SEGURIDAD }];
  },
};

export default nextConfig;
