/**
 * A donde se manda a alguien despues de iniciar sesion.
 *
 * El destino llega en la URL (`volverA`), asi que lo controla quien envia el
 * enlace. Sin comprobarlo se podria construir un enlace al login propio que,
 * tras entrar, deje a la persona en un sitio ajeno: el clasico redirect
 * abierto, muy usado para phishing.
 */

/** A donde se va cuando el destino pedido no es de fiar. */
const DESTINO_POR_DEFECTO = "/dashboard";

/**
 * Un origen que no existe, solo para poder interpretar la ruta.
 *
 * `.invalid` esta reservado y nunca resuelve. Lo unico que importa es que sea
 * distinto de cualquier sitio real: si tras interpretar el valor el origen ya
 * no es este, el valor apuntaba fuera.
 */
const ORIGEN_DE_PRUEBA = "http://interno.invalid";

/**
 * Devuelve el destino solo si es una ruta interna del panel.
 *
 * Se INTERPRETA el valor, no se mira su texto. Mirar el texto no basta: el
 * navegador descarta tabuladores y saltos de linea y trata `\` como `/`, asi
 * que `/<tabulador>/sitio.com` empieza por una sola barra y aun asi se lee
 * como `//sitio.com`, que es otro dominio. `URL` aplica esas mismas reglas, y
 * por eso lo que se devuelve es la ruta ya interpretada y no el valor crudo.
 */
export function destinoSeguro(valor: unknown): string {
  if (typeof valor !== "string" || !valor.startsWith("/")) {
    return DESTINO_POR_DEFECTO;
  }

  let url: URL;

  try {
    url = new URL(valor, ORIGEN_DE_PRUEBA);
  } catch {
    return DESTINO_POR_DEFECTO;
  }

  if (url.origin !== ORIGEN_DE_PRUEBA) return DESTINO_POR_DEFECTO;

  // Solo el panel. El login y la raiz redirigen por su cuenta, y volver a
  // ellos despues de entrar seria una vuelta inutil.
  const dentroDelPanel =
    url.pathname === DESTINO_POR_DEFECTO ||
    url.pathname.startsWith(`${DESTINO_POR_DEFECTO}/`);

  if (!dentroDelPanel) return DESTINO_POR_DEFECTO;

  return `${url.pathname}${url.search}${url.hash}`;
}
