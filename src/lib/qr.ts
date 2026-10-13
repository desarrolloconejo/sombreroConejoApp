import qrcode from "qrcode-generator";

/**
 * Convierte un texto en un codigo QR, listo para pintarse como SVG.
 *
 * Es la unica pieza del proyecto que usa una libreria para algo que no viene
 * con Node: codificar un QR no es trivial, y escribirlo a mano seria mucho
 * codigo para un solo uso. `qrcode-generator` no tiene dependencias propias.
 *
 * Se calcula en el SERVIDOR y lo que viaja al navegador es solo el dibujo: la
 * libreria no entra en el bundle de cliente.
 */

/** Lo que hace falta para dibujar el codigo. */
export type DibujoQr = {
  /** Cuantos modulos tiene de lado, sin contar el margen. */
  lado: number;

  /** El `d` de un `<path>`: un rectangulo por cada tramo de modulos oscuros. */
  trazo: string;
};

/**
 * Dibuja el QR de un texto.
 *
 * El nivel de correccion es el medio (`M`): tolera que un 15 % del codigo no
 * se lea bien, que sobra para una pantalla, y a cambio el codigo sale con
 * menos modulos y cada uno mas grande.
 *
 * Los modulos oscuros seguidos de una misma fila se unen en un solo
 * rectangulo: el trazo queda mucho mas corto que con uno por modulo, y no
 * aparecen rayas finas entre ellos al escalar.
 */
export function dibujarQr(texto: string): DibujoQr {
  // El 0 deja que la libreria elija el tamano mas pequeno en el que cabe.
  const codigo = qrcode(0, "M");
  codigo.addData(texto);
  codigo.make();

  const lado = codigo.getModuleCount();
  const tramos: string[] = [];

  for (let fila = 0; fila < lado; fila++) {
    let columna = 0;

    while (columna < lado) {
      if (!codigo.isDark(fila, columna)) {
        columna++;
        continue;
      }

      const inicio = columna;
      while (columna < lado && codigo.isDark(fila, columna)) columna++;

      const largo = columna - inicio;
      tramos.push(`M${inicio},${fila}h${largo}v1h-${largo}z`);
    }
  }

  return { lado, trazo: tramos.join("") };
}
