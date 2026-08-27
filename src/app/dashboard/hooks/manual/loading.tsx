/**
 * Esqueleto de el criterio de la casa.
 *
 * Copia la geometria del Wrapper: migas, kicker, titular y bajada. La barra
 * lateral y la cabecera no se esqueletizan porque viven en el layout y ya
 * estan pintadas cuando esto aparece.
 *
 * Las piezas van ocultas al lector de pantalla y el unico anuncio es la linea
 * con role="status": un esqueleto leido en voz alta es una lista de nada.
 */
export default function Cargando() {
  return (
    <>
      <div
        aria-hidden="true"
        className="mb-3 flex items-center gap-[7px] lg:mb-[13px]"
      >
        <div className="hueso h-[13px] w-[78px]" />
        <div className="hueso size-[9px]" />
        <div className="hueso h-[13px] w-[52px]" />
        <div className="hueso size-[9px]" />
        <div className="hueso h-[13px] w-[64px]" />
      </div>

      <div
        aria-hidden="true"
        className="mb-5 border-b border-borde pb-[18px] lg:mb-6 lg:pb-5"
      >
        <div className="hueso h-[13px] w-full max-w-[132px]" />
        <div className="hueso mt-3 h-[30px] w-full max-w-[420px] rounded-[9px] lg:h-10" />
        <div className="hueso mt-3.5 h-3.5 w-full max-w-[520px]" />
      </div>

      <p role="status" className="sr-only">
        Cargando el criterio de la casa
      </p>

      <div aria-hidden="true" className="hueso h-[220px] rounded-[15px]" />
    </>
  );
}
