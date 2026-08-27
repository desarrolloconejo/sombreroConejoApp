import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fija la raiz del proyecto: sin esto Turbopack sube por el arbol buscando
  // lockfiles y puede tomar una carpeta ajena como raiz del workspace.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
