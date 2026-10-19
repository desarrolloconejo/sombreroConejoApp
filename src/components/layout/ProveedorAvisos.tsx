"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CircleAlert, CircleCheck, PartyPopper, X } from "lucide-react";

/**
 * Los avisos de que algo se guardo o fallo, flotando sobre la pantalla.
 *
 * POR QUE EXISTE
 * --------------
 * Hasta ahora el resultado de cada accion se pintaba como una alerta ARRIBA
 * del formulario. En un formulario largo —el canvas de un hook, el alta de un
 * usuario— quien pulsa "Guardar" esta abajo, y el aviso aparecia fuera de la
 * vista: se guardaba bien y no se veia, o fallaba y tampoco. Es el mismo
 * fallo que tenia la contrasena provisional.
 *
 * QUE NO VIENE AQUI
 * -----------------
 * Los errores de CAMPO se quedan junto a su campo. Un aviso flotante que diga
 * "revisa el correo" obliga a buscar cual es; el mensaje pegado al campo ya
 * dice donde. Aqui solo llegan los mensajes generales: "guardado", "esa ficha
 * ya no existe", "no se pudo conectar".
 */

type Tono = "exito" | "error" | "logro";

type Aviso = {
  id: number;
  tono: Tono;
  texto: string;
};

type ContextoAvisos = {
  /** Muestra un aviso. Devuelve nada: no hay que esperarlo. */
  avisar: (texto: string, tono?: Tono) => void;
};

const Contexto = createContext<ContextoAvisos | null>(null);

/** Cuanto vive un aviso antes de irse solo. */
const DURACION = 5000;

/** Cuantos caben a la vez. Mas que esto tapa la pantalla en lugar de informar. */
const MAXIMO = 3;

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  // El id no puede salir de la longitud del arreglo: dos avisos seguidos tras
  // quitar uno reutilizarian el mismo numero y React los trataria como el
  // mismo elemento.
  const siguienteId = useRef(1);

  const quitar = useCallback((id: number) => {
    setAvisos((previos) => previos.filter((aviso) => aviso.id !== id));
  }, []);

  const avisar = useCallback((texto: string, tono: Tono = "exito") => {
    const id = siguienteId.current++;

    setAvisos((previos) => [...previos, { id, tono, texto }].slice(-MAXIMO));
  }, []);

  return (
    <Contexto.Provider value={{ avisar }}>
      {children}

      {/*
        `aria-live="polite"` y no "assertive": un lector de pantalla anuncia el
        aviso cuando termine lo que este diciendo, sin interrumpir a media
        frase. Lo que se guarda bien no es una urgencia.

        La region existe SIEMPRE, tambien vacia. Si se montara solo al haber
        avisos, el lector no tendria nada que vigilar y no anunciaria el
        primero.
      */}
      {/*
        ABAJO A LA IZQUIERDA.

        Abajo a la DERECHA es justo donde los paneles laterales ponen su pie de
        botones —cancelar, corregir, guardar—, asi que el aviso de "se guardo"
        tapaba el boton que se acababa de pulsar y el siguiente que hacia falta.
        La esquina opuesta es la unica que no compite con nada: el panel esta a
        la derecha y el sidebar arriba a la izquierda.

        En escritorio se desplaza los 268 px del sidebar para no montarse
        encima de el.
      */}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className={[
          "pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2.5 p-4",
          "lg:inset-x-auto lg:left-[268px] lg:items-start",
        ].join(" ")}
      >
        {avisos.map((aviso) => (
          <Notificacion key={aviso.id} aviso={aviso} alCerrar={quitar} />
        ))}
      </div>
    </Contexto.Provider>
  );
}

/**
 * Un aviso. Se retira solo, y tambien a mano.
 *
 * El temporizador vive en el propio aviso y no en el proveedor: asi cada uno
 * cuenta su tiempo desde que aparecio, en lugar de irse todos a la vez.
 */
function Notificacion({
  aviso,
  alCerrar,
}: {
  aviso: Aviso;
  alCerrar: (id: number) => void;
}) {
  const esError = aviso.tono === "error";
  const esLogro = aviso.tono === "logro";

  useEffect(() => {
    // Un logro se queda un poco mas: se lee con gusto, no con prisa.
    const temporizador = window.setTimeout(() => alCerrar(aviso.id), esLogro ? DURACION + 2000 : DURACION);
    return () => window.clearTimeout(temporizador);
  }, [aviso.id, alCerrar, esLogro]);

  if (esLogro) {
    return (
      <div
        className={[
          "pointer-events-auto logro-entrar flex w-full max-w-[440px] items-center gap-3.5",
          "rounded-2xl bg-acento px-4 py-4 text-acento-contraste shadow-[var(--sombra-alta)]",
        ].join(" ")}
      >
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-acento-contraste/15 [&>svg]:size-5"
        >
          <PartyPopper />
        </span>
        <p className="min-w-0 flex-1 text-[13.5px] leading-snug font-semibold">{aviso.texto}</p>
        <button
          type="button"
          onClick={() => alCerrar(aviso.id)}
          aria-label="Cerrar aviso"
          className="suave -mr-1 grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg opacity-80 hover:bg-acento-contraste/15 hover:opacity-100"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={[
        // Recupera los eventos que el contenedor desactiva: el contenedor no
        // debe bloquear los clics de la pagina que hay debajo, pero el aviso
        // si tiene que poder cerrarse.
        "pointer-events-auto surge flex w-full max-w-[420px] items-start gap-3",
        "rounded-xl border border-l-[3px] px-4 py-3.5 shadow-[var(--sombra-alta)]",
        esError
          ? "border-blackberry/30 border-l-blackberry bg-superficie dark-tema:border-acento/30 dark-tema:border-l-gold"
          : "border-borde border-l-navy bg-superficie dark-tema:border-l-gold",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={[
          "mt-px shrink-0 [&>svg]:size-[17px]",
          esError ? "text-blackberry dark-tema:text-acento" : "text-navy dark-tema:text-acento",
        ].join(" ")}
      >
        {esError ? <CircleAlert /> : <CircleCheck />}
      </span>

      <p className="min-w-0 flex-1 text-[13px] leading-relaxed">{aviso.texto}</p>

      <button
        type="button"
        onClick={() => alCerrar(aviso.id)}
        aria-label="Cerrar aviso"
        className="suave -mt-0.5 -mr-1 grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg text-suave hover:bg-acento-tenue hover:text-acento"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

export function useAvisos(): ContextoAvisos {
  const contexto = useContext(Contexto);

  if (!contexto) {
    throw new Error("useAvisos debe usarse dentro de ProveedorAvisos");
  }

  return contexto;
}

/**
 * Los avisos si la pantalla los tiene, o null. Para las piezas de `ui`, que
 * pueden aparecer fuera de un ProveedorAvisos y no deben romperse por ello.
 */
export function useAvisosSiHay(): ContextoAvisos | null {
  return useContext(Contexto);
}
