/**
 * Esqueleto del home del panel.
 *
 * Copia la geometria de la page real hueco por hueco (mismos altos, radios,
 * margenes y rejilla) para que al llegar los datos nada salte de sitio. La
 * barra lateral y la cabecera no se esqueletizan: viven en el layout y ya
 * estan pintadas cuando esto aparece.
 *
 * POR QUE ESTO VIVE EN UN GRUPO DE RUTAS
 * --------------------------------------
 * Estaba en dashboard/ a secas, y desde ahi hacia dos trabajos a la vez: era
 * el esqueleto del inicio Y la frontera de Suspense que envolvia a TODOS los
 * modulos que cuelgan de /dashboard.
 *
 * La consecuencia se veia al ir de un modulo a otro: primero aparecia este
 * esqueleto, el del inicio, y solo despues el de la pagina a la que se iba.
 * Dos cargas seguidas y ninguna de las dos correspondia al destino.
 *
 * El grupo (inicio) no anade segmento a la URL (/dashboard sigue siendo
 * /dashboard), pero si acota la frontera: ahora solo envuelve al inicio, y
 * cada modulo espera con su propio esqueleto.
 *
 * OJO: al no quedar frontera en dashboard/, un modulo nuevo que NO traiga su
 * loading.tsx no tendra ninguna: la navegacion se quedara quieta hasta que el
 * servidor responda, sin aviso. Cada modulo trae el suyo.
 *
 * Las piezas van ocultas al lector de pantalla y el unico anuncio es la linea
 * con role="status": un esqueleto leido en voz alta es una lista de nada.
 */
export default function CargandoInicio() {
  return (
    <>
      <div
        aria-hidden="true"
        className="mb-3 flex items-center gap-[7px] lg:mb-[13px]"
      >
        <div className="hueso h-[13px] w-[78px]" />
        <div className="hueso size-[9px]" />
        <div className="hueso h-[13px] w-[62px]" />
      </div>

      {/* La cabecera del inicio no lleva accion: el enlace al perfil ya esta
          en la barra lateral, asi que aqui tampoco hay hueso de boton. */}
      <div
        aria-hidden="true"
        className="mb-5 border-b border-borde pb-[18px] lg:mb-6 lg:pb-5"
      >
        <div className="hueso h-[13px] w-full max-w-[168px]" />
        <div className="hueso mt-3 h-[30px] w-full max-w-[402px] rounded-[9px] lg:h-10" />
        <div className="hueso mt-3.5 h-3.5 w-full max-w-[470px]" />
      </div>

      <p
        role="status"
        className="mb-4 flex items-center gap-2.5 text-[12.5px] text-suave"
      >
        <i
          aria-hidden="true"
          className="size-[15px] shrink-0 animate-spin rounded-full border-2 border-borde border-t-acento"
        />
        Cargando tu espacio de trabajo
      </p>

      {/* Los bloques de lo que le toca a cada uno, en dos columnas. */}
      <div aria-hidden="true" className="mb-8 grid gap-4 md:grid-cols-2">
        <BloqueHueso />
        <BloqueHueso />
      </div>

      {/* Tres cifras en fila, con la misma rejilla que EstadoCuenta */}
      <div
        aria-hidden="true"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5"
      >
        <TarjetaCifra />
        <TarjetaCifra conBarra />
        <TarjetaCifra />
      </div>
    </>
  );
}

/**
 * Una tarjeta de cifra: rotulo con icono, numero grande y linea de apoyo.
 * La del medio lleva ademas la barra de progreso del perfil.
 */
function TarjetaCifra({ conBarra }: { conBarra?: boolean }) {
  return (
    <div className="rounded-[15px] border border-borde bg-superficie p-5 shadow-[var(--sombra)]">
      <div className="mb-3 flex items-center gap-[9px]">
        <div className="hueso size-[15px] shrink-0 rounded" />
        <div className="hueso h-3 w-[104px]" />
      </div>

      <div className="hueso h-[22px] w-[112px] lg:h-6" />

      {conBarra && <div className="hueso mt-[13px] h-[7px] w-full rounded-full" />}

      <div className="hueso mt-[7px] h-[11px] w-full max-w-[172px]" />
    </div>
  );
}

/** Un bloque del inicio: titulo, cifra, nota, unas filas y su enlace. */
function BloqueHueso() {
  return (
    <div className="rounded-[15px] border border-borde bg-superficie p-5 shadow-[var(--sombra)]">
      <div className="hueso h-4 w-[150px]" />
      <div className="hueso mt-3 h-7 w-[60px]" />
      <div className="hueso mt-2 h-3 w-[180px]" />
      {[0, 1, 2].map((fila) => (
        <div key={fila} className="mt-3.5 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="hueso h-3.5 w-[70%]" />
            <div className="hueso mt-1.5 h-3 w-[45%]" />
          </div>
          <div className="hueso h-3 w-[56px]" />
        </div>
      ))}
      <div className="hueso mt-4 h-3 w-[90px]" />
    </div>
  );
}
