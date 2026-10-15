import { EsqueletoDocumento } from "@/components/finanzas";

/**
 * Esqueleto de la ficha de un brief recibido. Tiene la geometria de las
 * fichas de documentos: el contenido a la izquierda y la columna de estado y
 * decisiones a la derecha.
 */
export default function CargandoBrief() {
  return <EsqueletoDocumento etiqueta="Cargando el brief" />;
}
