import type { ReactNode } from "react";

/**
 * Las tres piezas que solo usa el Manual.
 *
 * Viven aparte de SeccionesDocumentacion porque no comparten nada con ellas:
 * alli se listan registros de la base, aqui se presenta texto fijo. Mezclarlas
 * obligaria a importar media pantalla de listados para dibujar una tabla.
 */

/* ===========================================================================
   TABLA

   El manual es sobre todo tabular: pares termino/explicacion y la matriz de
   objetivos. Una sola tabla parametrizada evita repetir el mismo <table> siete
   veces con clases ligeramente distintas.

   Con tres o mas columnas se fija un ancho minimo y se deja rodar en
   horizontal dentro de su caja: partir una matriz de cuatro columnas en un
   movil la vuelve ilegible, y la tabla nunca debe empujar el ancho de la
   pagina.
   =========================================================================== */

const MINIMOS: Record<number, string> = { 3: "min-w-[520px]", 4: "min-w-[680px]" };

export function Tabla({
  rotulo,
  titulo,
  cabeceras,
  anchos,
  filas,
  plana = false,
}: {
  rotulo?: string;
  titulo?: string;
  cabeceras?: string[];
  /** Ancho de cada columna; la cadena vacia deja que ocupe el resto. */
  anchos?: string[];
  filas: ReactNode[][];
  /** Sin caja propia: para anidarla dentro de otro panel. */
  plana?: boolean;
}) {
  const columnas = cabeceras?.length ?? anchos?.length ?? filas[0]?.length ?? 2;

  const tabla = (
    <div className="overflow-x-auto">
      <table
        className={[
          "w-full border-collapse text-left text-[12.5px]",
          MINIMOS[columnas] ?? "",
        ].join(" ")}
      >
        {anchos && (
          <colgroup>
            {anchos.map((ancho, i) => (
              <col key={i} style={ancho ? { width: ancho } : undefined} />
            ))}
          </colgroup>
        )}

        {cabeceras && (
          <thead>
            <tr>
              {cabeceras.map((cabecera) => (
                <th
                  key={cabecera}
                  scope="col"
                  className="border-b border-borde px-[15px] py-2.5 text-[10.5px] font-bold tracking-[0.06em] text-suave uppercase"
                >
                  {cabecera}
                </th>
              ))}
            </tr>
          </thead>
        )}

        <tbody>
          {filas.map((fila, i) => (
            <tr key={i}>
              {fila.map((celda, j) => (
                <td
                  key={j}
                  className="border-b border-borde px-[15px] py-3 align-top leading-relaxed"
                >
                  {celda}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (plana) return tabla;

  return (
    <div className="surge overflow-hidden rounded-[15px] border border-borde bg-superficie shadow-[var(--sombra)]">
      {(rotulo || titulo) && (
        <div className="border-b border-borde px-[22px] py-[15px]">
          {rotulo && (
            <p className="mb-1 text-[10.5px] font-bold tracking-[0.1em] text-suave uppercase">
              {rotulo}
            </p>
          )}
          {titulo && (
            <p className="text-[15px] font-extrabold tracking-[-0.018em]">{titulo}</p>
          )}
        </div>
      )}
      {tabla}
    </div>
  );
}

/* ===========================================================================
   TARJETA DE FUNDAMENTO
   =========================================================================== */

export function TarjetaFundamento({
  rotulo,
  titulo,
  children,
}: {
  rotulo: string;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[13px] bg-campo px-[19px] py-[17px]">
      <p className="mb-2 text-[10.5px] font-bold tracking-[0.1em] text-acento uppercase">
        {rotulo}
      </p>
      <h3 className="mb-2 text-[15px] leading-snug font-bold tracking-[-0.018em]">
        {titulo}
      </h3>
      <p className="text-[12.5px] leading-relaxed text-suave">{children}</p>
    </div>
  );
}

/* ===========================================================================
   EL MAPA DE LA VENTANA

   La curva es ilustrativa, no un dato medido, y por eso no lleva eje de
   porcentaje: dibujar cifras en el eje daria a entender que salen de una
   medicion de esta cuenta. Lo que si es exacto son los cuatro hitos, que van
   en la lista de debajo y no dentro del SVG: ahi el texto no escalaria con el
   ancho ni lo leeria un lector de pantalla.
   =========================================================================== */

const HITOS_VENTANA = [
  {
    tiempo: "0 – 0,5 s",
    titulo: "El primer fotograma",
    texto:
      "Sin sonido tiene que decir de que va. Si hace falta escuchar para entender la imagen, medio publico ya se ha ido.",
  },
  {
    tiempo: "0,5 – 1,5 s",
    titulo: "El Insert-Titulo",
    texto:
      "Seis palabras o menos, y completo desde el fotograma uno. Animado letra a letra consume la ventana entera sin comunicar nada.",
  },
  {
    tiempo: "1,5 – 3 s",
    titulo: "La primera frase",
    texto:
      "Sin saludo ni presentacion: la primera palabra es la primera idea. El saludo se paga con la unica ventana que hay.",
  },
  {
    tiempo: "antes de 4 s",
    titulo: "La prueba",
    texto:
      "Algo real en pantalla: el resultado, la cifra, el gesto o el detalle. Prometer sin ensenar convierte la retencion en abandono.",
  },
];

export function MapaRetencion() {
  return (
    <div className="surge overflow-hidden rounded-[15px] border border-borde bg-superficie shadow-[var(--sombra)]">
      <div className="border-b border-borde px-[26px] py-5">
        <p className="mb-1.5 text-[10.5px] font-bold tracking-[0.1em] text-suave uppercase">
          La ventana
        </p>
        <p className="text-[19px] leading-snug font-extrabold tracking-[-0.022em]">
          La audiencia decide antes de que termines la primera frase.
        </p>
        <p className="mt-1.5 max-w-[68ch] text-[12.5px] leading-relaxed text-suave">
          La caida de espectadores es mas pronunciada al principio que en
          cualquier otro momento de la pieza. La curva es ilustrativa; los cuatro
          hitos no.
        </p>
      </div>

      <div className="px-[26px] pt-5">
        {/*
          Escala uniforme, sin `preserveAspectRatio="none"`: estirando solo el
          eje X los cuatro puntos de la curva salen ovalados en pantallas
          estrechas, que es justo donde mas se mira.
        */}
        <svg viewBox="0 0 720 210" aria-hidden="true" className="h-auto w-full">
          <defs>
            <linearGradient id="relleno-retencion" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fae890" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#fae890" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[42, 90, 138, 186].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="720"
              y2={y}
              stroke="#ffffff"
              strokeOpacity="0.08"
              strokeWidth="1"
            />
          ))}

          {/* La zona de los tres segundos: donde ocurre todo lo del manual. */}
          <rect x="8" y="0" width="352" height="210" fill="#fae890" fillOpacity="0.06" />

          <path
            d="M8 26 C 70 30 120 92 200 120 S 340 162 430 172 S 600 184 712 188 L712 210 L8 210 Z"
            fill="url(#relleno-retencion)"
          />
          <path
            d="M8 26 C 70 30 120 92 200 120 S 340 162 430 172 S 600 184 712 188"
            fill="none"
            stroke="#fae890"
            strokeWidth="3"
            strokeLinecap="round"
          />

          <line
            x1="360"
            y1="0"
            x2="360"
            y2="210"
            stroke="#fae890"
            strokeOpacity="0.45"
            strokeWidth="1.5"
            strokeDasharray="5 5"
          />

          {[
            [64, 40],
            [192, 116],
            [360, 160],
            [472, 175],
          ].map(([cx, cy]) => (
            <circle
              key={cx}
              cx={cx}
              cy={cy}
              r="6"
              fill="#051a2a"
              stroke="#fae890"
              strokeWidth="3"
            />
          ))}
        </svg>

        {/* Tres columnas y no `justify-between`: asi el rotulo del medio cae
            exactamente sobre la linea de los 3 s, que esta en la mitad. */}
        <div className="mt-2 grid grid-cols-3 text-[10.5px] font-semibold text-suave">
          <span>0 s</span>
          <span className="text-center text-acento">3 s · la ventana</span>
          <span className="text-right">6 s</span>
        </div>
      </div>

      <ol className="grid gap-x-px gap-y-5 p-[26px] pt-5 sm:grid-cols-2 xl:grid-cols-4">
        {HITOS_VENTANA.map((hito, i) => (
          <li key={hito.titulo} className="xl:px-[18px] xl:first:pl-0 xl:last:pr-0">
            <div className="mb-2.5 flex items-center gap-2.5">
              <span className="grid size-[26px] shrink-0 place-items-center rounded-lg bg-acento text-[11.5px] font-extrabold text-acento-contraste">
                {i + 1}
              </span>
              <span className="text-[11.5px] font-bold text-acento">{hito.tiempo}</span>
            </div>
            <h4 className="mb-1.5 text-[13.5px] font-bold tracking-[-0.012em]">
              {hito.titulo}
            </h4>
            <p className="text-[12px] leading-relaxed text-suave">{hito.texto}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
