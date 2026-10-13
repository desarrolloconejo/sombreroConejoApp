"use client";

import { useEffect } from "react";

/**
 * La ultima red: lo que se ve cuando falla el propio layout raiz.
 *
 * `error.tsx` cubre los fallos DENTRO del layout, asi que nunca se pinta si lo
 * que se rompio fue el layout mismo. Para eso existe este archivo, y por eso
 * tiene que traer su propio <html> y su propio <body>: sustituye al layout
 * entero, no cuelga de el.
 *
 * ESTA ESCRITO CON ESTILOS EN LINEA A PROPOSITO
 * ---------------------------------------------
 * Es la pagina que aparece cuando ya ha fallado todo lo demas. Si dependiera de
 * la hoja de estilos, del proveedor de tema o de un componente compartido,
 * bastaria con que el fallo estuviera ahi para quedarse sin nada que mostrar.
 * Aqui no se importa nada del proyecto: se pinta con los colores de marca
 * escritos a mano y sirve aunque no cargue una sola linea de CSS.
 *
 * Sin este archivo Next usa una pagina interna por defecto, en ingles y sin
 * relacion con la marca. Este existe para que el peor momento de la aplicacion
 * no sea ademas el unico que no se parece a ella.
 *
 * El mensaje del error no se pinta nunca: puede llevar dentro una consulta o
 * una ruta del servidor. Va a la consola, y en pantalla queda el `digest`, que
 * es con lo que se encuentra el fallo en el registro del servidor.
 */

const NAVY = "#051a2a";
const GOLD = "#fae890";

export default function ErrorGlobal({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Fallo irrecuperable en la aplicacion:", error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          backgroundColor: NAVY,
          color: "#ffffff",
          fontFamily:
            "Poppins, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <main style={{ maxWidth: "480px", textAlign: "center" }}>
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: GOLD,
            }}
          >
            Conejo App
          </p>

          <h1
            style={{
              margin: "12px 0 0",
              fontSize: "28px",
              lineHeight: 1.15,
              fontWeight: 800,
              letterSpacing: "-0.03em",
            }}
          >
            La aplicacion no pudo arrancar
          </h1>

          <p
            style={{
              margin: "14px 0 0",
              fontSize: "14px",
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.7)",
            }}
          >
            El fallo es nuestro, no tuyo, y ya quedo registrado. Vuelve a
            intentarlo: si se repite, avisa al equipo de tecnologia con la
            referencia de abajo.
          </p>

          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: "28px",
              padding: "12px 22px",
              border: "none",
              borderRadius: "12px",
              backgroundColor: GOLD,
              color: NAVY,
              fontSize: "14px",
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>

          {error.digest && (
            <p
              style={{
                margin: "28px 0 0",
                paddingTop: "16px",
                borderTop: "1px solid rgba(255,255,255,0.12)",
                fontSize: "12px",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              Referencia del fallo:{" "}
              <span style={{ fontFamily: "monospace", wordBreak: "break-all" }}>
                {error.digest}
              </span>
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
