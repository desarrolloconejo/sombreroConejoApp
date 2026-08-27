import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { ProveedorTema } from "@/components/layout/ProveedorTema";
import { atributoTema, temaActual } from "@/lib/tema";
import "./globals.css";

/**
 * Poppins es la unica tipografia de la aplicacion: cuerpo, navegacion,
 * botones, formularios y titulares. Una sola familia, bien usada en sus
 * distintos pesos, da mas cohesion que dos compitiendo.
 */
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--fuente-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Conejo App",
    template: "%s · Conejo App",
  },
  description:
    "Plataforma interna de El Conejo del Sombrero para clientes y trabajadores",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f4f6" },
    { media: "(prefers-color-scheme: dark)", color: "#041521" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // El tema se lee de la cookie en el servidor y se pinta ya en el html.
  // Por eso no hace falta ningun script inline anti-parpadeo: el navegador
  // recibe el documento con el tema correcto desde el primer byte.
  const tema = await temaActual();

  return (
    <html
      lang="es"
      data-tema={atributoTema(tema)}
      className={`${poppins.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ProveedorTema inicial={tema}>{children}</ProveedorTema>
      </body>
    </html>
  );
}
