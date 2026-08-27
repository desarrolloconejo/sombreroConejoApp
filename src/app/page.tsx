import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";

/**
 * La raiz nunca muestra contenido: reparte segun haya sesion o no.
 *
 * El proxy ya hace esta misma redireccion antes de llegar aqui. Se repite a
 * proposito: si algun dia el matcher cambia y deja de cubrir la raiz, el
 * comportamiento sigue siendo el correcto en lugar de mostrar una pagina vacia.
 */
export default async function Inicio() {
  const sesion = await obtenerSesion();
  redirect(sesion ? "/dashboard" : "/login");
}
