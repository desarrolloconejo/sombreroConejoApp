import type { CSSProperties } from "react";

/**
 * La marca de la agencia.
 *
 * NO va como <img>, sino como MASCARA de CSS, y la razon es concreta: el
 * archivo es una silueta blanca sobre transparente. Puesta como imagen solo se
 * veria sobre navy, y desapareceria en cuanto la barra lateral se vuelve clara
 * al cambiar de tema.
 *
 * Como mascara, lo unico que se aprovecha del archivo es su canal alfa, que es
 * justo la forma. El color lo pone `currentColor`, asi que la marca se tine
 * con el texto de su contenedor y funciona sobre cualquier fondo.
 *
 * Va con aria-hidden porque siempre la acompana el texto "Conejo App": para un
 * lector de pantalla repetirla seria ruido.
 */

const ARCHIVO = "url(/images/LOGOCONEJO.webp)";

const MASCARA: CSSProperties = {
  WebkitMaskImage: ARCHIVO,
  maskImage: ARCHIVO,
  WebkitMaskSize: "contain",
  maskSize: "contain",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskPosition: "center",
  maskPosition: "center",
};

export function Marca({
  tamano = 34,
  className,
}: {
  tamano?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      style={{ ...MASCARA, width: tamano, height: tamano }}
      className={["block shrink-0 bg-current", className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
