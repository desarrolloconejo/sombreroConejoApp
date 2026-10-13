import type { Metadata } from "next";

import { RenovarSesion } from "@/components/auth";
import { destinoSeguro } from "@/lib/redireccion";

export const metadata: Metadata = {
  title: "Renovando la sesion",
};

/**
 * La parada de quien llega con el acceso vencido y la sesion aun viva.
 *
 * Las guardias mandan aqui en lugar de al login. La page no comprueba nada: no
 * puede, porque renovar escribe cookies y eso solo lo puede hacer una action.
 * Se limita a decir a donde hay que volver; el componente pide la renovacion
 * y navega.
 *
 * No lleva guardia a proposito: quien llega aqui es justo quien no la pasaria.
 * Tampoco muestra ningun dato.
 */
export default async function PaginaRenovar(props: PageProps<"/renovar">) {
  const parametros = await props.searchParams;

  return <RenovarSesion volverA={destinoSeguro(parametros.volverA)} />;
}
